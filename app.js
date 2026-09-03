// ============================================================
// NKWASIBWE IRHCF - FRONTEND APPLICATION
// AI AGENT PLATFORM
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

const clearButton =
  document.getElementById("clearButton");

const newChatButton =
  document.getElementById("newChatButton");

const statusElement =
  document.getElementById("status");

const welcomeElement =
  document.querySelector(".welcome");


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

let currentUser =
  null;

let isSending =
  false;

let backendOnline =
  false;


// ============================================================
// CREATE SESSION ID
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


// ============================================================
// ENSURE SESSION ID
// ============================================================

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

function setStatus(
  message,
  type = "normal"
) {

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

  requestAnimationFrame(() => {

    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: "smooth"
    });

  });

}


// ============================================================
// HIDE WELCOME
// ============================================================

function updateWelcomeVisibility() {

  if (!welcomeElement) {
    return;
  }

  if (
    messages &&
    messages.children.length > 0
  ) {

    welcomeElement.style.display =
      "none";

  } else {

    welcomeElement.style.display =
      "";

  }

}


// ============================================================
// ADD MESSAGE
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


  // ----------------------------------------------------------
  // MESSAGE TYPE
  // ----------------------------------------------------------

  if (type === "user") {

    message.classList.add(
      "user-message"
    );

  } else if (type === "system") {

    message.classList.add(
      "ai-message",
      "system-message"
    );

  } else {

    message.classList.add(
      "ai-message"
    );

  }


  // ----------------------------------------------------------
  // CONTENT
  // ----------------------------------------------------------

  message.textContent =
    text;


  // ----------------------------------------------------------
  // ADD TO CHAT
  // ----------------------------------------------------------

  messages.appendChild(
    message
  );

  updateWelcomeVisibility();

  scrollToBottom();

  return message;

}


// ============================================================
// ADD SYSTEM MESSAGE
// ============================================================

function addSystemMessage(
  text
) {

  return addMessage(
    text,
    "system"
  );

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

  typing.setAttribute(
    "aria-live",
    "polite"
  );


  // Simple text version.
  // Works even if CSS animation does not exist.

  typing.textContent =
    "Nkwasibwe IRHCF iri gutekereza...";


  messages.appendChild(
    typing
  );

  updateWelcomeVisibility();

  scrollToBottom();

  return typing;

}


// ============================================================
// REMOVE TYPING INDICATOR
// ============================================================

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
// SAVE AUTHENTICATION
// ============================================================

function saveAuth(
  token,
  user = null
) {

  if (token) {

    authToken =
      token;

    localStorage.setItem(
      "nkwasibwe_auth_token",
      token
    );

  }


  if (user) {

    currentUser =
      user;

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
        JSON.parse(
          savedUser
        );

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

  authToken =
    null;

  currentUser =
    null;


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
// API REQUEST
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


  // ----------------------------------------------------------
  // ADD AUTHORIZATION
  // ----------------------------------------------------------

  if (authToken) {

    headers.Authorization =
      `Bearer ${authToken}`;

  }


  // ----------------------------------------------------------
  // REQUEST
  // ----------------------------------------------------------

  let response;


  try {

    response =
      await fetch(
        `${API_BASE_URL}${endpoint}`,
        {

          ...options,

          headers

        }
      );

  } catch (error) {

    throw new Error(
      "Ntibyashoboye kugera kuri server. Reba internet cyangwa utegereze server ibe imaze kubyuka."
    );

  }


  // ----------------------------------------------------------
  // PARSE RESPONSE
  // ----------------------------------------------------------

  let data;


  try {

    data =
      await response.json();

  } catch (error) {

    throw new Error(
      "Server yasubije response itari JSON."
    );

  }


  // ----------------------------------------------------------
  // HANDLE UNAUTHORIZED
  // ----------------------------------------------------------

  if (
    response.status === 401 &&
    endpoint !== "/api/login" &&
    endpoint !== "/api/register"
  ) {

    logout();

  }


  // ----------------------------------------------------------
  // HANDLE ERRORS
  // ----------------------------------------------------------

  if (!response.ok) {

    throw new Error(

      data.error ||

      data.message ||

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


    const controller =
      new AbortController();


    const timeout =
      setTimeout(
        () => controller.abort(),
        15000
      );


    const response =
      await fetch(
        `${API_BASE_URL}/api/health`,
        {
          signal:
            controller.signal
        }
      );


    clearTimeout(
      timeout
    );


    const data =
      await response.json();


    if (
      response.ok &&
      data.success
    ) {

      backendOnline =
        true;


      setStatus(
        "Server iri online",
        "online"
      );


      return true;

    }


    backendOnline =
      false;


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


    backendOnline =
      false;


    setStatus(
      "Server ntiboneka cyangwa iri kubyuka",
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

        method:
          "POST",

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

        method:
          "POST",

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
      JSON.stringify(
        currentUser
      )
    );


    return currentUser;


  } catch (error) {

    console.error(
      "Could not get current user:",
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

        method:
          "POST",

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


  const encodedSessionId =
    encodeURIComponent(
      requestedSessionId
    );


  return await apiRequest(
    `/api/conversations/${encodedSessionId}`
  );

}


// ============================================================
// DISPLAY CONVERSATION HISTORY
// ============================================================

async function displayConversationHistory() {

  if (
    !authToken ||
    !sessionId ||
    !messages
  ) {

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


    messages.innerHTML =
      "";


    data.messages.forEach(
      message => {

        if (!message.content) {
          return;
        }


        const type =
          message.role === "user"
            ? "user"
            : "ai";


        addMessage(
          message.content,
          type
        );

      }
    );


    updateWelcomeVisibility();


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

  sessionId =
    createLocalSessionId();


  localStorage.setItem(
    "nkwasibwe_session_id",
    sessionId
  );


  if (messages) {

    messages.innerHTML =
      "";

  }


  updateWelcomeVisibility();


  setStatus(
    "Conversation nshya yatangiye",
    "online"
  );


  if (userInput) {

    userInput.focus();

  }

}


// ============================================================
// CLEAR CONVERSATION
// ============================================================

function clearConversation() {

  if (!messages) {
    return;
  }


  messages.innerHTML =
    "";


  updateWelcomeVisibility();


  setStatus(
    "Conversation yasibwe kuri screen",
    "normal"
  );

}


// ============================================================
// DISABLE INPUT
// ============================================================

function setSendingState(
  sending
) {

  if (sendButton) {

    sendButton.disabled =
      sending;

  }


  if (userInput) {

    userInput.disabled =
      sending;

  }

}


// ============================================================
// AUTO RESIZE TEXTAREA
// ============================================================

function autoResizeInput() {

  if (!userInput) {
    return;
  }


  if (
    userInput.tagName
      .toLowerCase() !==
    "textarea"
  ) {

    return;

  }


  userInput.style.height =
    "auto";


  userInput.style.height =
    Math.min(
      userInput.scrollHeight,
      180
    ) + "px";

}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {


  // ----------------------------------------------------------
  // PREVENT DOUBLE REQUESTS
  // ----------------------------------------------------------

  if (isSending) {
    return;
  }


  if (!userInput) {

    console.error(
      "Input element not found"
    );

    return;

  }


  // ----------------------------------------------------------
  // GET TEXT
  // ----------------------------------------------------------

  const text =
    userInput.value.trim();


  if (!text) {

    userInput.focus();

    return;

  }


  // ----------------------------------------------------------
  // START SENDING
  // ----------------------------------------------------------

  isSending =
    true;


  setSendingState(
    true
  );


  // ----------------------------------------------------------
  // SHOW USER MESSAGE
  // ----------------------------------------------------------

  addMessage(
    text,
    "user"
  );


  userInput.value =
    "";


  autoResizeInput();


  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  setStatus(
    "Nkwasibwe IRHCF iri gutekereza...",
    "loading"
  );


  // ----------------------------------------------------------
  // TYPING INDICATOR
  // ----------------------------------------------------------

  const typingIndicator =
    addTypingIndicator();


  try {


    // --------------------------------------------------------
    // ENSURE SESSION
    // --------------------------------------------------------

    const activeSessionId =
      ensureSessionId();


    // --------------------------------------------------------
    // SEND TO BACKEND
    // --------------------------------------------------------

    const data =
      await apiRequest(
        "/api/chat",
        {

          method:
            "POST",

          body:
            JSON.stringify({

              message:
                text,

              sessionId:
                activeSessionId

            })

        }
      );


    // --------------------------------------------------------
    // REMOVE TYPING
    // --------------------------------------------------------

    removeTypingIndicator(
      typingIndicator
    );


    // --------------------------------------------------------
    // UPDATE SESSION ID
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // GET AI RESPONSE
    //
    // Supports multiple backend response formats.
    // --------------------------------------------------------

    const aiResponse =

      data.response ||

      data.reply ||

      data.message?.content ||

      data.message ||

      data.result ||

      "Ntabwo habonetse igisubizo cya AI.";


    // --------------------------------------------------------
    // DISPLAY AI RESPONSE
    // --------------------------------------------------------

    if (
      typeof aiResponse ===
      "string"
    ) {

      addMessage(
        aiResponse,
        "ai"
      );

    } else {

      addMessage(
        JSON.stringify(
          aiResponse,
          null,
          2
        ),
        "ai"
      );

    }


    // --------------------------------------------------------
    // SUCCESS STATUS
    // --------------------------------------------------------

    backendOnline =
      true;


    setStatus(
      "Server iri online",
      "online"
    );


  } catch (error) {


    console.error(
      "Chat error:",
      error
    );


    // --------------------------------------------------------
    // REMOVE TYPING
    // --------------------------------------------------------

    removeTypingIndicator(
      typingIndicator
    );


    let errorMessage =
      error.message ||
      "Habaye ikibazo.";


    const lowerError =
      errorMessage.toLowerCase();


    // --------------------------------------------------------
    // NETWORK ERROR
    // --------------------------------------------------------

    if (
      lowerError.includes(
        "faile
