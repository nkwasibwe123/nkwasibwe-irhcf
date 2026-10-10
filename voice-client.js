"use strict";

/**
 * Voice features for the existing IRHCF chat:
 * - Voice notes use the authenticated transcription endpoint and remain editable.
 * - Live voice uses WebRTC speech-to-speech; the API key never reaches the browser.
 */
(() => {
  const noteButton = document.getElementById("voiceButton");
  const liveButton = document.getElementById("liveVoiceButton");
  const input = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  if (!noteButton || !input) return;

  const API_BASE = (() => {
    return String(window.IRHCF_API_BASE_URL || "").replace(/\/$/, "");
  })();
  const getToken = () => localStorage.getItem("nkwasibwe_auth_token") || "";
  const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: "Bearer " + token } : {};
  };
  const setStatus = (message) => {
    const status = document.getElementById("status");
    if (status) status.textContent = message;
    const connection = document.getElementById("connectionStatus");
    if (connection) connection.textContent = message;
  };
  const setBusy = (button, busy, title) => {
    button.classList.toggle("recording", busy);
    button.setAttribute("aria-pressed", String(busy));
    button.title = title;
  };

  // VOICE NOTES: the user reviews the transcript before sending it.
  let recorder = null;
  let recordingStream = null;
  let chunks = [];
  let recording = false;

  const stopTracks = () => {
    if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  };

  noteButton.addEventListener("click", async () => {
    if (recording && recorder) {
      recorder.stop();
      recording = false;
      setBusy(noteButton, false, "Processing voice note...");
      setStatus("Voice note is being transcribed...");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus("This browser does not support voice recording. Try a recent Chrome browser over HTTPS.");
      return;
    }
    if (!getToken()) {
      setStatus("Please sign in before recording a voice note.");
      return;
    }

    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4"
      ];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
      recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);
      chunks = [];
      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        stopTracks();
        recording = false;
        setBusy(noteButton, false, "Record voice note");
        setStatus("Voice recording failed. Please try again.");
      };
      recorder.onstop = async () => {
        stopTracks();
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          chunks = [];
          if (!blob.size) throw new Error("No audio was recorded.");
          if (blob.size > 6 * 1024 * 1024) {
            throw new Error("Voice note is too large. Record a shorter note (maximum 6 MB).");
          }
          const extension = (blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm");
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Could not read the recorded audio."));
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.readAsDataURL(blob);
          });
          const response = await fetch(API_BASE + "/api/media/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ audioBase64: base64, fileName: "voice-note." + extension })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.success || !result.text) {
            throw new Error(result.error || "Voice note transcription failed.");
          }
          input.value = (input.value.trim() ? input.value.trim() + "\n" : "") + result.text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
          setStatus("Voice note transcribed. Review the text, then tap Send.");
        } catch (error) {
          setStatus(error.message || "Voice note transcription failed.");
        } finally {
          setBusy(noteButton, false, "Record voice note");
        }
      };
      recorder.start();
      recording = true;
      setBusy(noteButton, true, "Stop and transcribe voice note");
      setStatus("Recording voice note… tap the microphone again to stop.");
    } catch (error) {
      stopTracks();
      setBusy(noteButton, false, "Record voice note");
      setStatus(error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access in your browser."
        : (error.message || "Could not start microphone."));
    }
  });

  // LIVE VOICE: a single continuous speech-to-speech WebRTC session.
  if (liveButton) {
    let peer = null;
    let micStream = null;
    let dataChannel = null;
    let remoteAudio = null;
    let live = false;

    const cleanupLive = () => {
      live = false;
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
      setBusy(liveButton, false, "Start live voice conversation");
      setStatus("Live voice conversation ended.");
    };

    liveButton.addEventListener("click", async () => {
      if (live) {
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

      try {
        setStatus("Connecting live voice…");
        setBusy(liveButton, true, "End live voice conversation");
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
        dataChannel = peer.createDataChannel("oai-events");
        dataChannel.addEventListener("open", () => {
          live = true;
          setStatus("Live voice is ready. Speak naturally; tap 🔊 to end.");
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

        const answerResponse = await fetch(API_BASE + "/api/voice/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/sdp", ...authHeaders() },
          body: offer.sdp
        });
        if (!answerResponse.ok) {
          const error = await answerResponse.json().catch(() => ({}));
          throw new Error(error.error || "Could not create live voice session. Check provider access and billing.");
        }
        const answerSdp = await answerResponse.text();
        await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
        if (peer.connectionState === "failed") throw new Error("WebRTC connection failed.");
        peer.addEventListener("connectionstatechange", () => {
          if (peer && ["failed", "disconnected", "closed"].includes(peer.connectionState)) cleanupLive();
        });
      } catch (error) {
        cleanupLive();
        setStatus(error.message || "Live voice could not start.");
      }
    });
  }
})();
