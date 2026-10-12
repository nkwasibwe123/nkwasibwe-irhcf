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
  let fallbackRecognition = null;

  const cleanupLive = (message = "Live voice conversation ended.") => {
    live = false;
    starting = false;
    if (fallbackRecognition) { try { fallbackRecognition.stop(); } catch (_) {} fallbackRecognition = null; }
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

  function startBrowserFallback(reason) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setBusy(false);
      setStatus(reason + " Browser speech recognition is unavailable. Use the regular chat microphone.");
      return;
    }
    const recognition = new Recognition();
    fallbackRecognition = recognition;
    // Respect an explicitly selected app language; otherwise follow the
    // device/browser locale instead of hard-coding Kinyarwanda. Hard-coding
    // rw-RW caused short English utterances such as "hi hi" to be misheard.
    const savedLanguage = String(localStorage.getItem("nkwasibwe_language_preference") || "auto").trim().toLowerCase();
    const browserLanguage = String(navigator.languages?.[0] || navigator.language || "en-US").trim();
    const selectedLanguage = savedLanguage && savedLanguage !== "auto" ? savedLanguage : browserLanguage;
    const languageTag = selectedLanguage.includes("-")
      ? selectedLanguage
      : ({ rw: "rw-RW", en: "en-US", fr: "fr-FR", sw: "sw-KE" }[selectedLanguage] || selectedLanguage);
    recognition.lang = languageTag;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let submitted = false;
    setBusy(true);
    setStatus("Browser voice fallback ready. Speak now; the recognized words will be sent once to IRHCF chat.");
    recognition.onresult = event => {
      if (submitted) return;
      const text = Array.from(event.results || []).filter(r => r.isFinal).map(r => r[0]?.transcript || "").join(" ").trim();
      if (!text) return;
      submitted = true;
      const input = document.getElementById("userInput");
      const send = document.getElementById("sendButton");
      if (!input || !send) { setStatus("Chat input was not found."); return; }
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setStatus("Sending recognized speech to IRHCF…");
      send.click();
      setBusy(false);
      fallbackRecognition = null;
    };
    recognition.onerror = event => {
      setBusy(false);
      fallbackRecognition = null;
      setStatus("Browser voice error: " + (event.error || "microphone error") + ". You can use the normal chat.");
    };
    recognition.onend = () => {
      if (!submitted && fallbackRecognition === recognition) {
        fallbackRecognition = null;
        setBusy(false);
      }
    };
    try { recognition.start(); } catch (error) {
      fallbackRecognition = null;
      setBusy(false);
      setStatus("Browser voice could not start: " + (error.message || "microphone unavailable"));
    }
  }

  liveButton.addEventListener("click", async () => {
    // The button also controls browser fallback recording. Stop it on the
    // next tap rather than launching a second recognition session.
    if (live || starting || fallbackRecognition) {
      cleanupLive("Live voice conversation ended.");
      return;
    }
    if (!getToken()) {
      setStatus("Please sign in before starting live voice.");
      return;
    }
    // WebRTC may be missing even when the browser's SpeechRecognition works.
    // Fall back instead of making Live Voice unavailable in that browser.
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      startBrowserFallback("Realtime voice is unavailable in this browser.");
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
      const reason = error.message || "Live voice could not start.";
      cleanupLive(reason);
      // Provider 4xx errors (including billing/model access) do not throw at fetch level;
      // this catch handles the explicit !response.ok branch too and starts the no-Realtime fallback.
      startBrowserFallback("Realtime unavailable: " + reason);
    }
  });

  window.addEventListener("beforeunload", () => {
    if (live || starting) cleanupLive("Live voice session closed.");
  });
})();
