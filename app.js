// ============================================================
// NKWASIBWE IRHCF - FRONTEND APPLICATION
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL =
  "https://nkwasibwe-irhcf.onrender.com";

// ============================================================
// DOM ELEMENTS
// ============================================================

const userInput =
  document.getElementById("userInput");

const sendButton =
  document.getElementById("sendButton");

const messages =
  document.getElementById("messages");

// Optional elements.
// The application will still work if these elements
// do not exist in index.html.

const clearButton =
  document.getElementById("clearButton");

const statusElement =
  document.getElementById("status");

// ============================================================
// APPLICATION STATE
// ============================================================

let sessionId =
  localStorage.getItem(
    "nkwasibwe_session_id"
  ) || null;

let authToken =
  localStorage.getItem(
    "nkwasibwe_auth_token"
  ) || null;

let currentUser = null;

let isSending = false;

// ============================================================
// CREATE LOCAL SESSION ID
// ============================================================

function createLocalSessionId() {
  return (
    "session-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 12)
  );
}

function ensureSessionId() {
  if (!sessionId) {
    sessionId =
      createLocalSessionId();

    localStorage.setItem(
      "nkwasibwe_session_id",
      sessionId
    );
  }

  return sessionId;
}

// ============================================================
// STATUS
// ============================================================

function setStatus(message, type = "normal") {
  if (!statusElement) {
    return;
  }

  statusElement.textContent =
    message;

  statusElement.dataset.status =
    type;
}

// ============================================================
// SCROLL TO BOTTOM
// ============================================================

function scrollToBottom() {
  if (!messages) {
    return;
  }

  messages.scrollTo({
    top: messages.scrollHeight,
    behavior: "smooth"
  });
}

// ============================================================
// ADD MESSAGE TO UI
// ============================================================

function addMessage(
  text,
  type = "ai"
) {
  if (!messages) {
    console.error(
      "Messages container not found"
    );

    return null;
  }

  const message =
    document.createElement("div");

  message.classList.add(
    "message"
  );

  if (type === "user") {
    message.classList.add(
      "user-message"
    );
  } else if (type === "system") {
    message.classList.add(
      "system-message"
    );
  } else {
    message.classList.add(
      "ai-message"
    );
  }

  message.textContent =
    text;

  messages.appendChild(message);

  scrollToBottom();

  return message;
}

// ============================================================
// TYPING INDICATOR
// ============================================================

function addTypingIndicator() {
  if (!messages) {
    return null;
  }

  const typing =
    document.createElement("div");

  typing.classList.add(
    "message",
    "ai-message",
    "typing-indicator"
  );

  typing.textContent =
    "Nkwasibwe IRHCF iri gutekereza...";

  messages.appendChild(typing);

  scrollToBottom();

  return typing;
}

function removeTypingIndicator(
  element
) {
  if (
    element &&
    element.parentNode
  ) {
    element.remove();
  }
}

// ============================================================
// SAVE AUTH TOKEN
// ============================================================

function saveAuth(
  token,
  user = null
) {
  if (token) {
    authToken = token;

    localStorage.setItem(
      "nkwasibwe_auth_token",
      token
    );
  }

  if (user) {
    currentUser = user;

    localStorage.setItem(
      "nkwasibwe_user",
      JSON.stringify(user)
    );
  }
}

// ============================================================
// LOAD SAVED USER
// ============================================================

function loadSavedUser() {
  try {
    const savedUser =
      localStorage.getItem(
        "nkwasibwe_user"
      );

    if (savedUser) {
      currentUser =
        JSON.parse(savedUser);
    }
  } catch (error) {
    console.error(
      "Could not load saved user:",
      error
    );
  }
}

// ============================================================
// LOGOUT
// ============================================================

function logout() {
  authToken = null;

  currentUser = null;

  localStorage.removeItem(
    "nkwasibwe_auth_token"
  );

  localStorage.removeItem(
    "nkwasibwe_user"
  );

  setStatus(
    "Wasohotse muri konti.",
    "normal"
  );
}

// ============================================================
// API REQUEST HELPER
// ============================================================

async function apiRequest(
  endpoint,
  options = {}
) {
  const headers = {
    "Content-Type":
      "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization =
      `Bearer ${authToken}`;
  }

  const response =
    await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers
      }
    );

  let data;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      "Server yasubije response itari JSON."
    );
  }

  // Token expired or invalid
  if (
    response.status === 401 &&
    endpoint !== "/api/login" &&
    endpoint !== "/api/register"
  ) {
    logout();
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Backend error"
    );
  }

  return data;
}

// ============================================================
// CHECK BACKEND HEALTH
// ============================================================

async function checkBackendHealth() {
  try {
    setStatus(
      "Kugenzura server...",
      "loading"
    );

    const response =
      await fetch(
        `${API_BASE_URL}/api/health`
      );

    const data =
      await response.json();

    if (
      response.ok &&
      data.success
    ) {
      setStatus(
        "Server iri online",
        "online"
      );

      return true;
    }

    setStatus(
      "Server ifite ikibazo",
      "error"
    );

    return false;

  } catch (error) {
    console.error(
      "Health check error:",
      error
    );

    setStatus(
      "Server ntiboneka",
      "error"
    );

    return false;
  }
}

// ============================================================
// REGISTER
// ============================================================

async function register(
  name,
  email,
  password
) {
  const data =
    await apiRequest(
      "/api/register",
      {
        method: "POST",

        body:
          JSON.stringify({
            name,
            email,
            password
          })
      }
    );

  if (data.token) {
    saveAuth(
      data.token,
      data.user
    );
  }

  return data;
}

// ============================================================
// LOGIN
// ============================================================

async function login(
  email,
  password
) {
  const data =
    await apiRequest(
      "/api/login",
      {
        method: "POST",

        body:
          JSON.stringify({
            email,
            password
          })
      }
    );

  if (data.token) {
    saveAuth(
      data.token,
      data.user
    );
  }

  return data;
}

// ============================================================
// GET CURRENT USER
// ============================================================

async function getCurrentUser() {
  if (!authToken) {
    return null;
  }

  try {
    const data =
      await apiRequest(
        "/api/me"
      );

    currentUser =
      data.user;

    localStorage.setItem(
      "nkwasibwe_user",
      JSON.stringify(currentUser)
    );

    return currentUser;

  } catch (error) {
    console.error(
      "Could not get user:",
      error
    );

    return null;
  }
}

// ============================================================
// CREATE CONVERSATION
// ============================================================

async function createConversation(
  title = "New conversation"
) {
  const data =
    await apiRequest(
      "/api/conversations",
      {
        method: "POST",

        body:
          JSON.stringify({
            title
          })
      }
    );

  if (
    data.conversation &&
    data.conversation.session_id
  ) {
    sessionId =
      data.conversation.session_id;

    localStorage.setItem(
      "nkwasibwe_session_id",
      sessionId
    );
  }

  return data;
}

// ============================================================
// LOAD CONVERSATION
// ============================================================

async function loadConversation(
  requestedSessionId = sessionId
) {
  if (!requestedSessionId) {
    return null;
  }

  const data =
    await apiRequest(
      `/api/conversations/${encodeURIComponent(
        requestedSessionId
      )}`
    );

  return data;
}

// ============================================================
// LOAD CONVERSATION HISTORY INTO UI
// ============================================================

async function displayConversationHistory() {
  if (!authToken || !sessionId) {
    return;
  }

  try {
    const data =
      await loadConversation(
        sessionId
      );

    if (
      !data ||
      !Array.isArray(
        data.messages
      )
    ) {
      return;
    }

    messages.innerHTML = "";

    data.messages.forEach(
      message => {
        addMessage(
          message.content,
          message.role === "user"
            ? "user"
            : "ai"
        );
      }
    );

  } catch (error) {
    console.log(
      "Previous conversation could not be loaded:",
      error.message
    );
  }
}

// ============================================================
// START NEW CONVERSATION
// ============================================================

function startNewConversation() {
  sessionId = null;

  localStorage.removeItem(
    "nkwasibwe_session_id"
  );

  if (messages) {
    messages.innerHTML = "";
  }

  addMessage(
    "Muraho! Ndi Nkwasibwe IRHCF. Nakugirira iki?",
    "ai"
  );

  setStatus(
    "Conversation nshya yatangiye",
    "online"
  );
}

// ============================================================
// CLEAR CONVERSATION
// ============================================================

function clearConversation() {
  startNewConversation();
}

// ============================================================
// SEND CHAT MESSAGE
// ============================================================

async function sendMessage() {

  if (isSending) {
    return;
  }

  if (!userInput) {
    console.error(
      "Input element not found"
    );

    return;
  }

  const text =
    userInput.value.trim();

  if (!text) {
    return;
  }

  // Authentication is required
  if (!authToken) {
    addMessage(
      "Ugomba kubanza kwinjira muri konti yawe kugira ngo ukoreshe AI.",
      "system"
    );

    setStatus(
      "Login required",
      "error"
    );

    return;
  }

  isSending = true;

  sendButton.disabled = true;

  userInput.disabled = true;

  // ==========================================================
  // DISPLAY USER MESSAGE
  // ==========================================================

  addMessage(
    text,
    "user"
  );

  userInput.value = "";

  setStatus(
    "AI iri gutekereza...",
    "loading"
  );

  const typingIndicator =
    addTypingIndicator();

  try {

    // ========================================================
    // ENSURE SESSION EXISTS
    // ========================================================

    const activeSessionId =
      ensureSessionId();

    // ========================================================
    // SEND REQUEST
    // ========================================================

    const data =
      await apiRequest(
        "/api/chat",
        {
          method: "POST",

          body:
            JSON.stringify({
              message: text,

              sessionId:
                activeSessionId
            })
        }
      );

    // ========================================================
    // REMOVE LOADING
    // ========================================================

    removeTypingIndicator(
      typingIndicator
    );

    // ========================================================
    // UPDATE SESSION ID
    // Backend may return a different official session ID.
    // ========================================================

    if (
      data.conversation &&
      data.conversation.session_id
    ) {
      sessionId =
        data.conversation.session_id;

      localStorage.setItem(
        "nkwasibwe_session_id",
        sessionId
      );
    }

    // ========================================================
    // GET AI RESPONSE
    // ========================================================

    const aiResponse =
      data.response ||
      data.message?.content ||
      "Ntabwo habonetse igisubizo.";

    addMessage(
      aiResponse,
      "ai"
    );

    setStatus(
      "Server iri online",
      "online"
    );

  } catch (error) {

    console.error(
      "Chat error:",
      error
    );

    removeTypingIndicator(
      typingIndicator
    );

    let errorMessage =
      error.message ||
      "Habaye ikibazo.";

    // Render free service may take time
    if (
      errorMessage
        .toLowerCase()
        .includes("failed to fetch")
    ) {
      errorMessage =
        "Server iri kubyuka cyangwa hari ikibazo cya internet. Tegereza gato wongere ugerageze.";
    }

    addMessage(
      `Habaye ikibazo: ${errorMessage}`,
      "system"
    );

    setStatus(
      "Hari ikibazo",
      "error"
    );

  } finally {

    isSending = false;

    if (sendButton) {
      sendButton.disabled =
        false;
    }

    userInput.disabled =
      false;

    userInput.focus();
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

if (sendButton) {
  sendButton.addEventListener(
    "click",
    sendMessage
  );
}

if (userInput) {
  userInput.addEventListener(
    "keydown",
    function (event) {

      // Enter sends message.
      // Shift + Enter creates a new line.

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        sendMessage();
      }
    }
  );
}

if (clearButton) {
  clearButton.addEventListener(
    "click",
    clearConversation
  );
}

// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApp() {

  console.log(
    "Initializing Nkwasibwe IRHCF..."
  );

  loadSavedUser();

  // Check backend connection.
  await checkBackendHealth();

  // Check saved authentication.
  if (authToken) {
    await getCurrentUser();

    // Load previous conversation only
    // after authentication succeeds.
    if (currentUser) {
      await displayConversationHistory();
    }
  }

  // Focus input.
  if (userInput) {
    userInput.focus();
  }

  console.log(
    "Nkwasibwe IRHCF initialized."
  );
}

// ============================================================
// START APPLICATION
// ============================================================

initializeApp();

// ============================================================
// EXPOSE IMPORTANT FUNCTIONS
// Useful for login/register buttons in index.html
// ============================================================

window.NkwasibweIRHCF = {
  login,
  register,
  logout,
  getCurrentUser,
  sendMessage,
  startNewConversation,
  clearConversation,
  checkBackendHealth
}; 
