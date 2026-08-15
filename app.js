const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const messages = document.getElementById("messages");

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

function getAIResponse(message) {
  const text = message.toLowerCase();

  if (text.includes("muraho") || text.includes("hello") || text.includes("hi")) {
    return "Muraho! 👋 Ndi Nkwasibwe IRHCF. Nakora iki kugira ngo ngufashe?";
  }

  if (text.includes("witwa nde")) {
    return "Nitwa Nkwasibwe IRHCF 🤖.";
  }

  if (text.includes("nkwasibwe")) {
    return "Yego! Ndi hano. Mbwira task ushaka ko dukora.";
  }

  if (text.includes("app")) {
    return "Ndumva ushaka gukora application. 🚀 Mu ntambwe zikurikira tuzashyiramo Agent Core izajya itunganya tasks.";
  }

  return "Nabyakiriye. 🤖 Ubu ndi muri MVP y'ibanze. Mu ntambwe zikurikira tuzahuza AI model nyayo kugira ngo nshobore gusubiza no gukora tasks zikomeye.";
}

function sendMessage() {
  const text = userInput.value.trim();

  if (text === "") {
    return;
  }

  addMessage(text, "user");

  userInput.value = "";

  sendButton.disabled = true;

  setTimeout(() => {
    const response = getAIResponse(text);

    addMessage(response, "ai");

    sendButton.disabled = false;
    userInput.focus();
  }, 500);
}

sendButton.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});