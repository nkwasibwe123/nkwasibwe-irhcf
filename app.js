// ============================================================
// NKWASIBWE IRHCF
// AI AGENT PLATFORM - FRONTEND APPLICATION
//
// Vision:
// Understand → Plan → Execute → Test → Repair → Verify → Deliver
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

const chat =
  document.getElementById("chat");

const welcomeElement =
  document.getElementById("welcome");

const workflowElement =
  document.getElementById("agentWorkflow");

const suggestionsElement =
  document.getElementById("suggestions");

const conversationList =
  document.getElementById("conversationList");

const newChatButton =
  document.getElementById("newChatButton");

const headerNewChatButton =
  document.getElementById("headerNewChatButton");

const clearChatButton =
  document.getElementById("clearChatButton");

const mobileMenuButton =
  document.getElementById("mobileMenuButton");

const sidebar =
  document.getElementById("sidebar");

const statusText =
  document.getElementById("statusText");

const statusIndicator =
  document.getElementById("statusIndicator");

const connectionStatus =
  document.getElementById("connectionStatus");

const agentStatusText =
  document.getElementById("agentStatusText");

const agentStatusDot =
  document.getElementById("agentStatusDot");

const suggestionButtons =
  document.querySelectorAll(".suggestion");

const workflowSteps =
  document.querySelectorAll(".workflow-step");


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


let conversations =
  [];


// ============================================================
// LOCAL STORAGE KEYS
// ============================================================

const STORAGE_KEYS = {

  sessionId:
    "nkwasibwe_session_id",

  authToken:
    "nkwasibwe_auth_token",

  user:
    "nkwasibwe_user",

  conversations:
    "nkwasibwe_conversations"

};


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


// ============================================================
// ENSURE SESSION ID
// ============================================================

function ensureSessionId() {

  if (!sessionId) {

    sessionId =
      createLocalSessionId();


    localStorage.setItem(
      STORAGE_KEYS.sessionId,
      sessionId
    );

  }


  return sessionId;

}


// ============================================================
// SAVE SESSION
// ============================================================

function saveSessionId(
  newSessionId
) {

  if (!newSessionId) {
    return;
  }


  sessionId =
    newSessionId;


  localStorage.setItem(
    STORAGE_KEYS.sessionId,
    sessionId
  );

}


// ============================================================
// STATUS MANAGEMENT
// ============================================================

function setStatus(
  message,
  type = "normal"
) {

  // ----------------------------------------------------------
  // STATUS TEXT
  // ----------------------------------------------------------

  if (statusText) {

    statusText.textContent =
      message;

  }


  // ----------------------------------------------------------
  // STATUS INDICATOR
  // ----------------------------------------------------------

  if (statusIndicator) {

    statusIndicator.classList.remove(
      "working",
      "error"
    );


    if (type === "loading") {

      statusIndicator.classList.add(
        "working"
      );

    }


    if (type === "error") {

      statusIndicator.classList.add(
        "error"
      );

    }

  }


  // ----------------------------------------------------------
  // CONNECTION STATUS
  // ----------------------------------------------------------

  if (connectionStatus) {

    if (type === "online") {

      connectionStatus.textContent =
        "Connected";

    } else if (type === "loading") {

      connectionStatus.textContent =
        "Working...";

    } else if (type === "error") {

      connectionStatus.textContent =
        "Disconnected";

    } else {

      connectionStatus.textContent =
        backendOnline
          ? "Connected"
          : "Checking...";

    }

  }


  // ----------------------------------------------------------
  // AGENT STATUS
  // ----------------------------------------------------------

  if (agentStatusText) {

    if (type === "online") {

      agentStatusText.textContent =
        "AI Agent Ready";

    } else if (type === "loading") {

      agentStatusText.textContent =
        "AI Agent Working";

    } else if (type === "error") {

      agentStatusText.textContent =
        "Connection Problem";

    } else {

      agentStatusText.textContent =
        message;

    }

  }


  // ----------------------------------------------------------
  // AGENT STATUS DOT
  // ----------------------------------------------------------

  if (agentStatusDot) {

    if (type === "error") {

      agentStatusDot.style.background =
        "var(--danger)";

    } else if (type === "loading") {

      agentStatusDot.style.background =
        "var(--warning)";

    } else {

      agentStatusDot.style.background =
        "var(--success)";

    }

  }

}


// ============================================================
// SCROLL TO BOTTOM
// ============================================================

function scrollToBottom() {

  if (!chat) {
    return;
  }


  requestAnimationFrame(() => {

    chat.scrollTo({

      top:
        chat.scrollHeight,

      behavior:
        "smooth"

    });

  });

}


// ============================================================
// UPDATE WELCOME VISIBILITY
// ============================================================

function updateWelcomeVisibility() {

  if (!welcomeElement) {
    return;
  }


  const hasMessages =
    messages &&
    messages.children.length > 0;


  if (hasMessages) {

    welcomeElement.classList.add(
      "hidden"
    );


    if (suggestionsElement) {

      suggestionsElement.classList.add(
        "hidden"
      );

    }

  } else {

    welcomeElement.classList.remove(
      "hidden"
    );


    if (suggestionsElement) {

      suggestionsElement.classList.remove(
        "hidden"
      );

    }

  }

}


// ============================================================
// CREATE MESSAGE AVATAR
// ============================================================

function createMessageAvatar(
  type
) {

  const avatar =
    document.createElement("div");


  avatar.classList.add(
    "message-avatar"
  );


  if (type === "user") {

    avatar.classList.add(
      "user-avatar"
    );


    avatar.textContent =
      currentUser?.name
        ? currentUser.name
            .charAt(0)
            .toUpperCase()
        : "U";

  } else {

    avatar.classList.add(
      "ai-avatar"
    );


    avatar.textContent =
      "N";

  }


  return avatar;

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
      "Messages container not found."
    );

    return null;

  }


  // ----------------------------------------------------------
  // MESSAGE ROW
  // ----------------------------------------------------------

  const row =
    document.createElement("div");


  row.classList.add(
    "message-row"
  );


  if (type === "user") {

    row.classList.add(
      "user"
    );

  } else {

    row.classList.add(
      "ai"
    );

  }


  // ----------------------------------------------------------
  // AVATAR
  // ----------------------------------------------------------

  const avatar =
    createMessageAvatar(
      type === "user"
        ? "user"
        : "ai"
    );


  // ----------------------------------------------------------
  // MESSAGE WRAPPER
  // ----------------------------------------------------------

  const contentWrapper =
    document.createElement("div");


  contentWrapper.classList.add(
    "message-content-wrapper"
  );


  // ----------------------------------------------------------
  // MESSAGE
  // ----------------------------------------------------------

  const message =
    document.createElement("div");


  message.classList.add(
    "message"
  );


  if (type === "user") {

    message.classList.add(
      "user-message"
    );

  } else {

    message.classList.add(
      "ai-message"
    );


    if (type === "system") {

      message.classList.add(
        "system-message"
      );

    }

  }


  message.textContent =
    String(text);


  // ----------------------------------------------------------
  // MESSAGE META
  // ----------------------------------------------------------

  const meta =
    document.createElement("div");


  meta.classList.add(
    "message-meta"
  );


  const now =
    new Date();


  meta.textContent =
    now.toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit"
      }
    );


  // ----------------------------------------------------------
  // BUILD MESSAGE
  // ----------------------------------------------------------

  contentWrapper.appendChild(
    message
  );


  contentWrapper.appendChild(
    meta
  );


  if (type === "user") {

    row.appendChild(
      contentWrapper
    );


    row.appendChild(
      avatar
    );

  } else {

    row.appendChild(
      avatar
    );


    row.appendChild(
      contentWrapper
    );

  }


  messages.appendChild(
    row
  );


  updateWelcomeVisibility();

  scrollToBottom();


  return row;

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


  const row =
    document.createElement("div");


  row.classList.add(
    "message-row",
    "ai",
    "typing-row"
  );


  const avatar =
    createMessageAvatar(
      "ai"
    );


  const typing =
    document.createElement("div");


  typing.classList.add(
    "typing-indicator"
  );


  typing.setAttribute(
    "aria-label",
    "Nkwasibwe IRHCF is thinking"
  );


  for (
    let i = 0;
    i < 3;
    i++
  ) {

    const dot =
      document.createElement("span");


    dot.classList.add(
      "typing-dot"
    );


    typing.appendChild(
      dot
    );

  }


  row.appendChild(
    avatar
  );


  row.appendChild(
    typing
  );


  messages.appendChild(
    row
  );


  updateWelcomeVisibility();

  scrollToBottom();


  return row;

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
      STORAGE_KEYS.authToken,
      token
    );

  }


  if (user) {

    currentUser =
      user;


    localStorage.setItem(
      STORAGE_KEYS.user,
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
        STORAGE_KEYS.user
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
    STORAGE_KEYS.authToken
  );


  localStorage.removeItem(
    STORAGE_KEYS.user
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

    ...(options.headers || {})

  };


  // ----------------------------------------------------------
  // CONTENT TYPE
  // ----------------------------------------------------------

  if (
    options.body &&
    !headers["Content-Type"]
  ) {

    headers["Content-Type"] =
      "application/json";

  }


  // ----------------------------------------------------------
  // AUTHORIZATION
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
  // RESPONSE DATA
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
  // UNAUTHORIZED
  // ----------------------------------------------------------

  if (
    response.status === 401 &&
    endpoint !== "/api/login" &&
    endpoint !== "/api/register"
  ) {

    logout();

  }


  // ----------------------------------------------------------
  // ERROR
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
        () => {

          controller.abort();

        },
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


    let data =
      null;


    try {

      data =
        await response.json();

    } catch (error) {

      data =
        null;

    }


    if (
      response.ok &&
      (
        !data ||
        data.success !== false
      )
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
      STORAGE_KEYS.user,
      JSON.stringify(
        currentUser
      )
    );


    return currentUser;

  } catch (error) {

    console.log(
      "Could not get current user:",
      error.message
    );


    return null;

  }

}


// ============================================================
// WORKFLOW
// ============================================================

function resetWorkflow() {

  workflowSteps.forEach(
    step => {

      step.classList.remove(
        "active",
        "completed"
      );

    }
  );

}


function activateWorkflowStep(
  phase
) {

  workflowSteps.forEach(
    step => {

      if (
        step.dataset.phase ===
        phase
      ) {

        step.classList.add(
          "active"
        );

      } else {

        step.classList.remove(
          "active"
        );

      }

    }
  );

}


function completeWorkflowStep(
  phase
) {

  workflowSteps.forEach(
    step => {

      if (
        step.dataset.phase ===
        phase
      ) {

        step.classList.remove(
          "active"
        );


        step.classList.add(
          "completed"
        );

      }

    }
  );

}


// ============================================================
// RUN VISUAL WORKFLOW
// ============================================================

async function runWorkflowAnimation() {

  const phases = [

    "understand",

    "plan",

    "execute",

    "test",

    "repair",

    "verify",

    "deliver"

  ];

resetWorkflow();


  for (
    let i = 0;
    i < phases.length;
    i++
  ) {

    if (!isSending) {
      return;
    }


    const phase =
      phases[i];


    activateWorkflowStep(
      phase
    );


    await new Promise(
      resolve => {

        setTimeout(
          resolve,
          450
        );

      }
    );


    completeWorkflowStep(
      phase
    );

  }

}


// ============================================================
// CONVERSATION STORAGE
// ============================================================

function loadLocalConversations() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEYS.conversations
      );


    if (saved) {

      conversations =
        JSON.parse(saved);

    }

  } catch (error) {

    conversations =
      [];

  }

}


function saveLocalConversations() {

  try {

    localStorage.setItem(
      STORAGE_KEYS.conversations,
      JSON.stringify(conversations)
    );

  } catch (error) {

    console.error(
      "Could not save conversations:",
      error
    );

  }

}


// ============================================================
// ADD OR UPDATE LOCAL CONVERSATION
// ============================================================

function saveCurrentConversation(
  title = null
) {

  if (!sessionId) {
    return;
  }


  const existingIndex =
    conversations.findIndex(
      conversation =>
        conversation.session_id ===
        sessionId
    );


  const conversationTitle =

    title ||

    (
      conversations[existingIndex]
        ?.title
    ) ||

    "New conversation";


  const conversationData = {

    session_id:
      sessionId,

    title:
      conversationTitle,

    updated_at:
      new Date().toISOString()

  };


  if (
    existingIndex >= 0
  ) {

    conversations[
      existingIndex
    ] =
      conversationData;

  } else {

    conversations.unshift(
      conversationData
    );

  }


  conversations.sort(
    (a, b) =>

      new Date(
        b.updated_at
      ) -

      new Date(
        a.updated_at
      )
  );


  conversations =
    conversations.slice(
      0,
      50
    );


  saveLocalConversations();

  renderConversationList();

}


// ============================================================
// RENDER CONVERSATION LIST
// ============================================================

function renderConversationList() {

  if (!conversationList) {
    return;
  }


  conversationList.innerHTML =
    "";


  if (
    conversations.length === 0
  ) {

    const empty =
      document.createElement("div");


    empty.style.padding =
      "15px";


    empty.style.color =
      "var(--text-muted)";


    empty.style.fontSize =
      "12px";


    empty.textContent =
      "Nta conversations zirabikwa hano.";


    conversationList.appendChild(
      empty
    );


    return;

  }


  conversations.forEach(
    conversation => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.classList.add(
        "conversation-item"
      );


      if (
        conversation.session_id ===
        sessionId
      ) {

        button.classList.add(
          "active"
        );

      }


      button.textContent =
        conversation.title ||
        "New conversation";


      button.addEventListener(
        "click",
        async () => {

          await switchConversation(
            conversation.session_id
          );

        }
      );


      conversationList.appendChild(
        button
      );

    }
  );

}


// ============================================================
// CREATE CONVERSATION
// ============================================================

async function createConversation(
  title = "New conversation"
) {

  // ----------------------------------------------------------
  // If backend conversation endpoint exists,
  // use it. Otherwise frontend local session still works.
  // ----------------------------------------------------------

  if (authToken) {

    try {

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

        saveSessionId(
          data.conversation.session_id
        );

      }


      saveCurrentConversation(
        data.conversation?.title ||
        title
      );


      return data;

    } catch (error) {

      console.log(
        "Using local conversation:",
        error.message
      );

    }

  }


  saveSessionId(
    createLocalSessionId()
  );


  saveCurrentConversation(
    title
  );


  return {

    success:
      true,

    conversation: {

      session_id:
        sessionId,

      title

    }

  };

}


// ============================================================
// LOAD CONVERSATION FROM BACKEND
// ============================================================

async function loadConversation(
  requestedSessionId = sessionId
) {

  if (
    !requestedSessionId
  ) {

    return null;

  }


  return await apiRequest(

    `/api/conversations/${encodeURIComponent(
      requestedSessionId
    )}`

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

    return false;

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

      return false;

    }


    messages.innerHTML =
      "";


    data.messages.forEach(
      message => {

        if (!message.content) {
          return;
        }


        addMessage(

          message.content,

          message.role === "user"
            ? "user"
            : "ai"

        );

      }
    );


    updateWelcomeVisibility();


    return true;

  } catch (error) {

    console.log(
      "Previous conversation could not be loaded:",
      error.message
    );


    return false;

  }

}


// ============================================================
// SWITCH CONVERSATION
// ============================================================

async function switchConversation(
  requestedSessionId
) {

  if (
    !requestedSessionId ||
    requestedSessionId ===
      sessionId
  ) {

    return;

  }


  saveSessionId(
    requestedSessionId
  );


  if (messages) {

    messages.innerHTML =
      "";

  }


  updateWelcomeVisibility();

  renderConversationList();


  setStatus(
    "Loading conversation...",
    "loading"
  );


  const loaded =
    await displayConversationHistory();


  if (!loaded) {

    addSystemMessage(
      "Iyi conversation ntirabasha kuboneka muri database."
    );

  }


  setStatus(
    "Server iri online",
    backendOnline
      ? "online"
      : "normal"
  );


  closeMobileSidebar();
}
// ============================================================
// START NEW CONVERSATION
// ============================================================

async function startNewConversation() {

  if (isSending) {
    return;
  }


  if (messages) {

    messages.innerHTML =
      "";

  }


  resetWorkflow();


  try {

    await createConversation(
      "New conversation"
    );

  } catch (error) {

    saveSessionId(
      createLocalSessionId()
    );


    saveCurrentConversation(
      "New conversation"
    );

  }


  updateWelcomeVisibility();

  renderConversationList();

  closeMobileSidebar();


  setStatus(
    "Conversation nshya yatangiye",
    backendOnline
      ? "online"
      : "normal"
  );


  if (userInput) {

    userInput.focus();

  }

}


// ============================================================
// CLEAR CONVERSATION
// ============================================================

function clearConversation() {

  if (
    !messages ||
    isSending
  ) {

    return;

  }


  messages.innerHTML =
    "";


  resetWorkflow();


  updateWelcomeVisibility();


  setStatus(
    "Screen yasukuwe",
    "normal"
  );


  if (userInput) {

    userInput.focus();

  }

}


// ============================================================
// SET SENDING STATE
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


  if (suggestionButtons) {

    suggestionButtons.forEach(
      button => {

        button.disabled =
          sending;

      }
    );

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

      150

    ) +

    "px";

}


// ============================================================
// GENERATE CONVERSATION TITLE
// ============================================================

function generateConversationTitle(
  text
) {

  const cleanText =
    text
      .replace(/\s+/g, " ")
      .trim();


  if (
    cleanText.length <= 35
  ) {

    return cleanText;

  }


  return (
    cleanText
      .substring(
        0,
        35
      ) +
    "..."
  );

}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {


  // ----------------------------------------------------------
  // PREVENT DOUBLE REQUEST
  // ----------------------------------------------------------

  if (isSending) {
    return;
  }


  if (!userInput) {

    console.error(
      "Input element not found."
    );

    return;

  }


  // ----------------------------------------------------------
  // GET MESSAGE
  // ----------------------------------------------------------

  const text =
    userInput.value.trim();


  if (!text) {

    userInput.focus();

    return;

  }


  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  isSending =
    true;


  setSendingState(
    true
  );


  // ----------------------------------------------------------
  // ENSURE SESSION
  // ----------------------------------------------------------

  const activeSessionId =
    ensureSessionId();


  // ----------------------------------------------------------
  // SAVE CONVERSATION
  // ----------------------------------------------------------

  const existingConversation =
    conversations.find(
      conversation =>
        conversation.session_id ===
        activeSessionId
    );


  const title =
    existingConversation?.title ===
    "New conversation"

      ? generateConversationTitle(
          text
        )

      : (
          existingConversation?.title ||
          generateConversationTitle(
            text
          )
        );


  saveCurrentConversation(
    title
  );


  // ----------------------------------------------------------
  // DISPLAY USER MESSAGE
  // ----------------------------------------------------------

  addMessage(
    text,
    "user"
  );


  // ----------------------------------------------------------
  // CLEAR INPUT
  // ----------------------------------------------------------

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
  // START VISUAL WORKFLOW
  // ----------------------------------------------------------

  const workflowPromise =
    runWorkflowAnimation();


  // ----------------------------------------------------------
  // TYPING INDICATOR
  // ----------------------------------------------------------

  const typingIndicator =
    addTypingIndicator();


  try {


    // --------------------------------------------------------
    // SEND REQUEST TO BACKEND
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
    // UPDATE SESSION
    // --------------------------------------------------------

    if (
      data.conversation &&
      data.conversation.session_id
    ) {

      saveSessionId(
        data.conversation.session_id
      );

    }


    // --------------------------------------------------------
    // WAIT FOR WORKFLOW VISUALIZATION
    // --------------------------------------------------------

    await workflowPromise;


    // --------------------------------------------------------
    // REMOVE TYPING
    // --------------------------------------------------------

    removeTypingIndicator(
      typingIndicator
    );


    // --------------------------------------------------------
    // GET RESPONSE
    // --------------------------------------------------------

    const aiResponse =

      data.response ||

      data.reply ||

      data.message?.content ||

      data.result ||

      data.message ||

      "Ntabwo habonetse igisubizo cya AI.";


    // --------------------------------------------------------
    // DISPLAY RESPONSE
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
    // UPDATE CONVERSATION
    // --------------------------------------------------------

    saveCurrentConversation(
      title
    );


    // --------------------------------------------------------
    // SUCCESS
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


    // --------------------------------------------------------
    // ERROR MESSAGE
    // --------------------------------------------------------

    let errorMessage =

      error.message ||

      "Habaye ikibazo.";


    const lowerError =
      errorMessage.toLowerCase();


    // --------------------------------------------------------
    // RENDER / NETWORK WAKE-UP
    // --------------------------------------------------------

    if (

      lowerError.includes(
        "failed to fetch"
      ) ||

      lowerError.includes(
        "ntibyashoboye kugera"
      ) ||

      lowerError.includes(
        "abort"
      )

    ) {

      errorMessage =
        "Server ishobora kuba iri kubyuka cyangwa hari ikibazo cya internet. Tegereza amasegonda make wongere ugerageze.";

    }


    // --------------------------------------------------------
    // DISPLAY ERROR
    // --------------------------------------------------------

    addSystemMessage(

      `Habaye ikibazo: ${errorMessage}`

    );


    backendOnline =
      false;


    setStatus(
      "Hari ikibazo cya connection",
      "error"
    );


  } finally {


    isSending =
      false;


    setSendingState(
      false
    );


    if (userInput) {

      userInput.focus();

    }

  }

}


// ============================================================
// SEND SUGGESTION
// ============================================================

function sendSuggestion(
  prompt
) {

  if (
    !prompt ||
    !userInput
  ) {

    return;

  }


  userInput.value =
    prompt;


  autoResizeInput();


  sendMessage();

}


// ============================================================
// MOBILE SIDEBAR
// ============================================================

function openMobileSidebar() {

  if (!sidebar) {
    return;
  }


  sidebar.classList.add(
    "open"
  );

}


function closeMobileSidebar() {

  if (!sidebar) {
    return;
  }


  sidebar.classList.remove(
    "open"
  );

}


function toggleMobileSidebar() {

  if (!sidebar) {
    return;
  }


  sidebar.classList.toggle(
    "open"
  );

}


// ============================================================
// CLICK OUTSIDE MOBILE SIDEBAR
// ============================================================

document.addEventListener(
  "click",
  function (event) {

    if (
      window.innerWidth > 700
    ) {

      return;

    }


    if (
      !sidebar ||
      !sidebar.classList.contains(
        "open"
      )
    ) {

      return;

    }


    const clickedInsideSidebar =
      sidebar.contains(
        event.target
      );


    const clickedMenuButton =
      mobileMenuButton &&
      mobileMenuButton.contains(
        event.target
      );


    if (
      !clickedInsideSidebar &&
      !clickedMenuButton
    ) {

      closeMobileSidebar();

    }

  }
);


// ============================================================
// EVENT LISTENERS
// ============================================================


// SEND BUTTON

if (sendButton) {

  sendButton.addEventListener(
    "click",
    sendMessage
  );

}


// TEXTAREA INPUT

if (userInput) {

  userInput.addEventListener(
    "input",
    autoResizeInput
  );


  userInput.addEventListener(
    "keydown",
    function (event) {

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


// NEW CONVERSATION BUTTON

if (newChatButton) {

  newChatButton.addEventListener(
    "click",
    startNewConversation
  );

}


// HEADER NEW CONVERSATION

if (headerNewChatButton) {

  headerNewChatButton.addEventListener(
    "click",
    startNewConversation
  );

}


// CLEAR CHAT

if (clearChatButton) {

  clearChatButton.addEventListener(
    "click",
    clearConversation
  );

}


// MOBILE MENU

if (mobileMenuButton) {

  mobileMenuButton.addEventListener(
    "click",
    function (event) {

      event.stopPropagation();

      toggleMobileSidebar();

    }
  );

}


// SUGGESTIONS

suggestionButtons.forEach(
  button => {

    button.addEventListener(
      "click",
      function () {

        const prompt =
          button.dataset.prompt;


        sendSuggestion(
          prompt
        );

      }
    );

  }
);


// ============================================================
// KEYBOARD SHORTCUT
// CTRL + K = FOCUS INPUT
// ============================================================

document.addEventListener(
  "keydown",
  function (event) {

    if (

      (
        event.ctrlKey ||
        event.metaKey
      ) &&

      event.key.toLowerCase() ===
      "k"

    ) {

      event.preventDefault();


      if (userInput) {

        userInput.focus();

      }

    }

  }
);


// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApp() {


  console.log(
    "Initializing Nkwasibwe IRHCF..."
  );


  // ----------------------------------------------------------
  // LOAD LOCAL DATA
  // ----------------------------------------------------------

  loadSavedUser();

  loadLocalConversations();


  // ----------------------------------------------------------
  // ENSURE SESSION
  // ----------------------------------------------------------

  ensureSessionId();


  // ----------------------------------------------------------
  // RENDER SIDEBAR
  // ----------------------------------------------------------

  saveCurrentConversation(
    "New conversation"
  );


  renderConversationList();


  // ----------------------------------------------------------
  // INITIAL UI
  // ----------------------------------------------------------

  updateWelcomeVisibility();

  resetWorkflow();

  autoResizeInput();


  // ----------------------------------------------------------
  // CHECK BACKEND
  // ----------------------------------------------------------

  await checkBackendHealth();


  // ----------------------------------------------------------
  // LOAD USER
  // ----------------------------------------------------------

  if (authToken) {

    await getCurrentUser();

  }


  // ----------------------------------------------------------
  // LOAD CONVERSATION HISTORY
  // ----------------------------------------------------------

  if (

    authToken &&

    currentUser &&

    sessionId

  ) {

    await displayConversationHistory();

  }


  // ----------------------------------------------------------
  // FOCUS INPUT
  // ----------------------------------------------------------

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
// EXPOSE PUBLIC FUNCTIONS
// ============================================================

window.NkwasibweIRHCF = {

  // Authentication

  login,

  register,

  logout,

  getCurrentUser,


  // Conversations

  startNewConversation,

  clearConversation,

  createConversation,

  loadConversation,

  switchConversation,


  // Chat

  sendMessage,


  // System

  checkBackendHealth,


  // Agent

  resetWorkflow,

  activateWorkflowStep,

  completeWorkflowStep

};
