const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");

// Create one session ID for this conversation
let sessionId = localStorage.getItem("nkwasibwe_session_id");

if (!sessionId) {
  sessionId =
    "session-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 10);

  localStorage.setItem("nkwasibwe_session_id", sessionId);
}

function addMessage(text, type) {
  const message = document.createElement("div");

  message.classList.add("message");

  if (type === "user") {
    message.classList.add("user-message");
  } else {
    message.classList.add("ai-message");
  }

  message.textContent = text;

  messages.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
}

async function sendMessage() {
  const text = userInput.value.trim();

  if (text === "") {
    return;
  }

  addMessage(text, "user");

  userInput.value = "";
  sendButton.disabled = true;

  try {
    const response = await fetch(
      "https://nkwasibwe-irhcf.onrender.com/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Backend error");
    }

    addMessage(data.reply, "ai");

  } catch (error) {
    console.error(error);

    addMessage(
      "Habaye ikibazo mu kuvugana na AI. Ongera ugerageze.",
      "ai"
    );
  }

  sendButton.disabled = false;
  userInput.focus();
}

sendButton.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});
