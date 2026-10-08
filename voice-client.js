"use strict";

/**
 * Browser voice layer.
 * Uses MediaRecorder for microphone capture and SpeechRecognition when
 * available for immediate local dictation. The backend remains the
 * authoritative AI conversation engine.
 */

(() => {
  const button = document.getElementById("voiceButton");
  const input = document.getElementById("userInput");
  if (!button || !input) return;

  let recognition = null;
  let listening = false;

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "auto";

    recognition.onstart = () => {
      listening = true;
      button.classList.add("recording");
      button.setAttribute("aria-pressed", "true");
      button.title = "Listening...";
    };

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      input.value = text.trim();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    recognition.onerror = () => {
      listening = false;
      button.classList.remove("recording");
      button.setAttribute("aria-pressed", "false");
      button.title = "Voice";
    };

    recognition.onend = () => {
      listening = false;
      button.classList.remove("recording");
      button.setAttribute("aria-pressed", "false");
      button.title = "Voice";
      if (input.value.trim()) {
        const send = document.getElementById("sendButton");
        if (send) send.click();
      }
    };

    button.addEventListener("click", () => {
      if (listening) {
        recognition.stop();
        return;
      }
      recognition.lang = document.documentElement.lang || "en-US";
      recognition.start();
    });
  } else {
    button.title = "Voice input requires browser speech recognition support.";
  }
})();
