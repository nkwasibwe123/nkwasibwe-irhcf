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
    recognition.lang = navigator.language || "en-US";

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
      const uiLanguage = String(document.documentElement.lang || "").trim();
      recognition.lang = uiLanguage.includes("-") ? uiLanguage : (navigator.language || "en-US");
      recognition.start();
    });
  } else {
    button.title = "Voice input requires browser speech recognition support.";
  }

  // Voice-output mode: speak newly delivered assistant messages when
  // the browser exposes SpeechSynthesis. This makes voice-only use
  // possible without changing the existing chat rendering engine.
  const messages = document.getElementById("messages");
  if ("speechSynthesis" in window && messages) {
    const spoken = new WeakSet();

    const speakAssistantMessage = (node) => {
      if (!node || spoken.has(node)) return;
      const text = String(node.innerText || "").trim();
      if (!text || text.length < 2) return;

      const looksAssistant =
        node.classList.contains("assistant") ||
        node.classList.contains("ai") ||
        node.dataset.role === "assistant" ||
        node.dataset.role === "ai" ||
        /assistant|ai|bot/i.test(node.getAttribute("data-role") || "");

      if (!looksAssistant) return;

      spoken.add(node);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 12000));
      utterance.lang = navigator.language || "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    };

    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            speakAssistantMessage(node);
            node.querySelectorAll?.("[data-role='assistant'], [data-role='ai'], .assistant, .ai").forEach(speakAssistantMessage);
          }
        }
      }
    }).observe(messages, { childList: true, subtree: true });
  }
})();
