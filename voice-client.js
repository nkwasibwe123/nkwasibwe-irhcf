"use strict";

/**
 * Live voice conversation module.
 * Voice-note recording/transcription remains in the existing app.js composer
 * so only one handler owns #voiceButton and its MediaRecorder state.
 */
(() => {
  const liveButton = document.getElementById("liveVoiceButton");
  if (!liveButton) return;

  const API_BASE = String(window.IRHCF_API_BASE_URL || "").replace(/\/$/, "");
  const getToken = () => localStorage.getItem("nkwasibwe_auth_token") || "";
  const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  };
  const setStatus = message => {
    const status = document.getElementById("status");
    if (status) status.textContent = message;
    const connection = document.getElementById("connectionStatus");
    if (connection) connection.textContent = message;
  };
  const setBusy = busy => {
    liveButton.classList.toggle("recording", busy);
    liveButton.setAttribute("aria-pressed", String(busy));
    liveButton.textContent = busy ? "⏹" : "🔊";
    liveButton.title = busy ? "End live voice conversation" : "Start live voice conversation";
  };

  let peer = null;
  let micStream = null;
  let dataChannel = null;
  let remoteAudio = null;
  let live = false;
  let starting = false;

  const cleanupLive = (message = "Live voice conversation ended.") => {
    live = false;
    starting = false;
    if (dataChannel && dataChannel.readyState !== "closed") dataChannel.close();
    dataChannel = null;
    if (peer) peer.close();
    peer = null;
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    micStream = null;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      remoteAudio.remove();
    }
    remoteAudio = null;
    setBusy(false);
    setStatus(message);
  };

  liveButton.addEventListener("click", async () => {
    if (live || starting) {
      cleanupLive();
      return;
    }
    if (!getToken()) {
      setStatus("Please sign in before starting live voice.");
      return;
    }
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      setStatus("Live voice requires a modern browser with WebRTC and microphone support.");
      return;
    }

    starting = true;
    setBusy(true);
    setStatus("Connecting live voice…");
    try {
      peer = new RTCPeerConnection();
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudio.setAttribute("aria-label", "IRHCF voice response");
      remoteAudio.style.display = "none";
      document.body.appendChild(remoteAudio);

      peer.ontrack = event => {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch(() => setStatus("Tap the page once to allow voice playback."));
      };
      peer.addEventListener("connectionstatechange", () => {
        if (peer && ["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          cleanupLive("Live voice connection ended. Tap 🔊 to reconnect.");
        }
      });

      dataChannel = peer.createDataChannel("oai-events");
      dataChannel.addEventListener("open", () => {
        live = true;
        starting = false;
        setStatus("Live voice is ready. Speak naturally; tap ⏹ to end.");
      });
      dataChannel.addEventListener("message", event => {
        try {
          const item = JSON.parse(event.data);
          if (item.type === "error") {
            setStatus(item.error?.message || "Live voice returned an error.");
          } else if (item.type === "response.output_audio_transcript.done") {
            setStatus("IRHCF: " + String(item.transcript || "").slice(0, 180));
          } else if (item.type === "input_audio_buffer.speech_started") {
            setStatus("Listening…");
          }
        } catch (_) {}
      });

      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach(track => peer.addTrack(track, micStream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const response = await fetch(API_BASE + "/api/voice/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/sdp", ...authHeaders() },
        body: offer.sdp
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not create live voice session. Check provider access and billing.");
      }
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (error) {
      cleanupLive(error.message || "Live voice could not start.");
    }
  });

  window.addEventListener("beforeunload", () => {
    if (live || starting) cleanupLive("Live voice session closed.");
  });
})();
