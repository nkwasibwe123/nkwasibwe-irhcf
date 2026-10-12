"use strict";

/**
 * Live voice with a zero-OpenAI-Realtime fallback:
 * - Prefer OpenAI WebRTC when configured.
 * - If that session cannot be created, use browser SpeechRecognition +
 *   the existing authenticated IRHCF chat endpoint + browser SpeechSynthesis.
 * The fallback avoids OpenAI Realtime session charges, but chat answers still
 * depend on the AI provider configured for the existing /api/chat endpoint.
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
  const responseText = data =>
    data?.response || data?.answer || data?.message ||
    data?.data?.response || data?.data?.answer || data?.data?.message ||
    data?.result?.response || data?.result?.text || "";

  let peer = null;
  let micStream = null;
  let dataChannel = null;
  let remoteAudio = null;
  let recognition = null;
  let live = false;
  let starting = false;
  let fallbackActive = false;
  let processingTurn = false;
  let recognitionStarting = false;
  let restartTimer = null;
  let lastSubmittedText = "";
  let lastSubmittedAt = 0;
  let activeSessionId = localStorage.getItem("nkwasibwe_session_id") || null;

  const stopRealtimeResources = () => {
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
  };

  const cleanupLive = (message = "Live voice conversation ended.") => {
    live = false;
    starting = false;
    fallbackActive = false;
    processingTurn = false;
    if (restartTimer) window.clearTimeout(restartTimer);
    restartTimer = null;
    recognitionStarting = false;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      try { recognition.abort(); } catch (_) { try { recognition.stop(); } catch (_) {} }
    }
    recognition = null;
    stopRealtimeResources();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setBusy(false);
    setStatus(message);
  };

  const preferredSpeechLocale = () => {
    const saved = localStorage.getItem("nkwasibwe_language_preference");
    const raw = saved && saved !== "auto" ? saved : (navigator.language || "rw-RW");
    const base = String(raw).toLowerCase().split("-")[0];
    return ({ rw: "rw-RW", en: "en-US", fr: "fr-FR", sw: "sw-KE",
      es: "es-ES", pt: "pt-BR", de: "de-DE", it: "it-IT",
      nl: "nl-NL", pl: "pl-PL", tr: "tr-TR", ar: "ar-SA",
      hi: "hi-IN", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU"
    })[base] || raw;
  };

  const speak = text => {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = preferredSpeechLocale();
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const sendRecognizedSpeech = async transcript => {
    const message = String(transcript || "").replace(/\s+/g, " ").trim();
    const dedupeKey = message.toLocaleLowerCase();
    const now = Date.now();
    if (!message || processingTurn || !live) return;
    if (dedupeKey === lastSubmittedText && now - lastSubmittedAt < 8000) return;
    lastSubmittedText = dedupeKey;
    lastSubmittedAt = now;
    processingTurn = true;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    setStatus("IRHCF iratekereza…");
    try {
      const response = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          message,
          sessionId: activeSessionId,
          session_id: activeSessionId,
          responseLanguage: "auto",
          languagePreference: "auto"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "IRHCF chat ntiyashoboye gusubiza.");
      const answer = responseText(data);
      if (!answer) throw new Error("IRHCF ntiyagaruye igisubizo gisomeka.");
      const session = data.sessionId || data.session_id || data.session?.id ||
        data.data?.sessionId || data.data?.session_id;
      if (session) {
        activeSessionId = session;
        localStorage.setItem("nkwasibwe_session_id", session);
      }
      setStatus("IRHCF: " + answer.slice(0, 220));
      speak(answer);
    } catch (error) {
      setStatus("Ikibazo cya chat: " + (error.message || "ongera ugerageze."));
    } finally {
      processingTurn = false;
      scheduleRecognitionRestart();
    }
  };

  const scheduleRecognitionRestart = () => {
    if (restartTimer) window.clearTimeout(restartTimer);
    if (!live || !fallbackActive || processingTurn || !recognition) return;
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      if (!live || !fallbackActive || processingTurn || !recognition || recognitionStarting) return;
      try {
        recognitionStarting = true;
        recognition.start();
      } catch (_) {
        recognitionStarting = false;
      }
    }, 500);
  };

  const startBrowserFallback = reason => {
    stopRealtimeResources();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      cleanupLive("Live voice ya OpenAI yanze, kandi browser yawe ntishyigikira speech recognition. Gerageza Chrome kuri Android; nta OpenAI Realtime credit yakoreshejwe.");
      return;
    }
    fallbackActive = true;
    live = true;
    starting = false;
    setBusy(true);
    setStatus("OpenAI Live Voice ntiyabonetse. Dukoresha uburyo bwa browser butishyura OpenAI Realtime; vuga…");
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = preferredSpeechLocale();
    recognition.onstart = () => { recognitionStarting = false; };
    recognition.onresult = event => {
      let interim = "";
      const finalParts = [];
      // The results list includes earlier final results. Read only changed
      // entries and submit each turn once, rather than accumulating old words.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const phrase = String(result[0]?.transcript || "").trim();
        if (!phrase) continue;
        if (result.isFinal) finalParts.push(phrase);
        else interim += (interim ? " " : "") + phrase;
      }
      if (interim.trim()) setStatus("Ndumva: " + interim.trim().slice(0, 160));
      if (finalParts.length && !processingTurn) {
        const ready = finalParts.join(" ").replace(/\s+/g, " ").trim();
        // Stop before sending so the same utterance cannot trigger another turn.
        try { recognition.stop(); } catch (_) {}
        void sendRecognizedSpeech(ready);
      }
    };
    recognition.onerror = event => {
      if (!live || !fallbackActive) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        cleanupLive("Browser ntiyemerewe gukoresha microphone. Emera Microphone permission muri browser settings.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("Ikibazo cya microphone (" + event.error + "). Reba internet na permission za microphone.");
      }
    };
    recognition.onend = () => {
      recognitionStarting = false;
      scheduleRecognitionRestart();
    };
    try {
      recognitionStarting = true;
      recognition.start();
    } catch (error) {
      recognitionStarting = false;
      cleanupLive("Browser voice ntiyatangiye: " + (error.message || reason || "ongera ugerageze."));
    }
  };

  liveButton.addEventListener("click", async () => {
    if (live || starting) {
      cleanupLive();
      return;
    }
    if (!getToken()) {
      setStatus("Banza winjire muri konti yawe kugira ngo ukoreshe live voice.");
      return;
    }
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
      startBrowserFallback("WebRTC ntiyabonetse");
      return;
    }

    starting = true;
    setBusy(true);
    setStatus("Turagerageza OpenAI Live Voice…");
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
        remoteAudio.play().catch(() => setStatus("Kanda kuri page kugira ngo wemere kumva ijwi."));
      };
      peer.addEventListener("connectionstatechange", () => {
        if (peer && ["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          if (live) cleanupLive("Live voice connection yarangiye.");
        }
      });
      dataChannel = peer.createDataChannel("oai-events");
      dataChannel.addEventListener("open", () => {
        live = true;
        starting = false;
        setStatus("Live voice irakora. Vuga; ukande ⏹ kugira ngo uhagarike.");
      });
      dataChannel.addEventListener("message", event => {
        try {
          const item = JSON.parse(event.data);
          if (item.type === "error") {
            setStatus((item.error?.message || "Live voice error") + " — tugerageza browser voice.");
            if (!live) startBrowserFallback(item.error?.message || "Realtime provider error");
          } else if (item.type === "response.output_audio_transcript.done") {
            setStatus("IRHCF: " + String(item.transcript || "").slice(0, 180));
          } else if (item.type === "input_audio_buffer.speech_started") {
            setStatus("Ndumva…");
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
        startBrowserFallback(error.error || "Realtime session could not be created");
        return;
      }
      await peer.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (error) {
      startBrowserFallback(error.message || "Realtime session could not be created");
    }
  });

  window.addEventListener("beforeunload", () => {
    if (live || starting) cleanupLive("Live voice session closed.");
  });
})();
