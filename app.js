// ============================================================
// NKWASIBWE IRHCF - FRONTEND APPLICATION
// Autonomous AI Agent Platform
// ============================================================


// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE_URL =
  "https://nkwasibwe-irhcf.onrender.com";


// ============================================================
// DOM ELEMENTS
// ============================================================

// Main chat input
const userInput =
  document.getElementById("userInput");

// Send button
const sendButton =
  document.getElementById("sendButton");

// Messages container
const messages =
  document.getElementById("messages");

// Chat container
const chat =
  document.getElementById("chat");

// Welcome screen
const welcomeElement =
  document.getElementById("welcome");

// Suggestions
const suggestionsElement =
  document.getElementById("suggestions");

// Workflow
const agentWorkflow =
  document.getElementById("agentWorkflow");

// Conversation controls
const newChatButton =
  document.getElementById("newChatButton");

const headerNewChatButton =
  document.getElementById(
    "headerNewChatButton"
  );

const clearChatButton =
  document.getElementById(
    "clearChatButton"
  );

// Sidebar
const sidebar =
  document.getElementById("sidebar");

const conversationList =
  document.getElementById(
    "conversationList"
  );

const mobileMenuButton =
  document.getElementById(
    "mobileMenuButton"
  );

// Status elements
const statusBar =
  document.getElementById(
    "statusBar"
  );

const statusText =
  document.getElementById(
    "statusText"
  );

const statusIndicator =
  document.getElementById(
    "statusIndicator"
  );

const connectionStatus =
  document.getElementById(
    "connectionStatus"
  );

const agentStatusDot =
  document.getElementById(
    "agentStatusDot"
  );

const agentStatusText =
  document.getElementById(
    "agentStatusText"
  );


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
    "nkwasibwe_session_id",
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

  // Main status text
  if (statusText) {

    statusText.textContent =
      message;

  }


  // Status bar
  if (statusBar) {

    statusBar.dataset.status =
      type;

  }


  // Status indicator
  if (statusIndicator) {

    statusIndicator.dataset.status =
      type;

  }


  // Connection status
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
        "Ready";

    }

  }


  // Agent status
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
        "AI Agent Ready";

    }

  }


  // Agent dot
  if (agentStatusDot) {

    agentStatusDot.dataset.status =
      type;

  }

}


// ============================================================
// BACKEND CONNECTION STATUS
// ============================================================

function setBackendOnline(
  online
) {

  backendOnline =
    online;

  if (online) {

    setStatus(
      "Ready",
      "online"
    );

  } else {

    setStatus(
      "Server ntiboneka",
      "error"
    );

  }

}


// ============================================================
// SCROLL CHAT TO BOTTOM
// ============================================================

function scrollToBottom(
  smooth = true
) {

  if (!messages) {
    return;
  }


  requestAnimationFrame(() => {

    messages.scrollTo({

      top:
        messages.scrollHeight,

      behavior:
        smooth
          ? "smooth"
          : "auto"

    });

  });

}


// ============================================================
// HIDE OR SHOW WELCOME
// ============================================================

function updateWelcomeVisibility() {

  if (!welcomeElement) {
    return;
  }


  const hasMessages =
    messages &&
    messages.children.length > 0;


  if (hasMessages) {

    welcomeElement.style.display =
      "none";

    if (suggestionsElement) {

      suggestionsElement.style.display =
        "none";

    }

    if (agentWorkflow) {

      agentWorkflow.style.display =
        "none";

    }

  } else {

    welcomeElement.style.display =
      "";

    if (suggestionsElement) {

      suggestionsElement.style.display =
        "";

    }

    if (agentWorkflow) {

      agentWorkflow.style.display =
        "";

    }

  }

}


// ============================================================
// CREATE MESSAGE ELEMENT
// ============================================================

function createMessageElement(
  text,
  type = "ai"
) {

  const message =
    document.createElement("article");


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


  return message;

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
    createMessageElement(
      text,
      type
    );


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
    document.createElement("article");


  typing.classList.add(
    "message",
    "ai-message",
    "typing-indicator"
  );


  typing.setAttribute(
    "aria-live",
    "polite"
  );


  typing.setAttribute(
    "aria-label",
    "AI is thinking"
  );


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


  const maxHeight =
    180;


  userInput.style.height =
    Math.min(
      userInput.scrollHeight,
      maxHeight
    ) + "px";


  userInput.style.overflowY =
    userInput.scrollHeight >
    maxHeight
      ? "auto"
      : "hidden";

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
      JSON.stringify(
        user
      )
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

    ...(options.headers || {})

  };


  // ----------------------------------------------------------
  // ADD JSON HEADER WHEN NEEDED
  // ----------------------------------------------------------

  if (
    !headers["Content-Type"] &&
    options.body
  ) {

    headers["Content-Type"] =
      "application/json";

  }


  // ----------------------------------------------------------
  // ADD AUTHORIZATION
  // ----------------------------------------------------------

  if (authToken) {

    headers.Authorization =
      `Bearer ${authToken}`;

  }


  let response;


  // ----------------------------------------------------------
  // REQUEST
  // ----------------------------------------------------------

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
  // READ RESPONSE
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
  // HANDLE HTTP ERROR
  // ----------------------------------------------------------

  if (!response.ok) {

    throw new Error(

      data.error ||

      data.message ||

      `Server error (${response.status})`

    );

  }


  return data;

}


// ============================================================
// CHECK BACKEND HEALTH
// ============================================================

async function checkBackendHealth() {

  const controller =
    new AbortController();


  let timeout;


  try {

    setStatus(
      "Kugenzura server...",
      "loading"
    );


    timeout =
      setTimeout(
        () => controller.abort(),
        20000
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


    let data;


    try {

      data =
        await response.json();

    } catch (error) {

      throw new Error(
        "Health response ntabwo ari JSON."
      );

    }


    if (
      response.ok &&
      data.success
    ) {

      backendOnline =
        true;


      setStatus(
        "Ready",
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

    if (timeout) {

      clearTimeout(
        timeout
      );

    }


    console.error(
      "Health check error:",
      error
    );


    backendOnline =
      false;


    setStatus(
      "Server iri kubyuka cyangwa ntiboneka",
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


    if (!data.user) {

      return null;

    }


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

    saveSessionId(
      data.conversation.session_id
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
// LOAD CONVERSATION LIST
// ============================================================

async function loadConversations() {

  if (!authToken) {

    return [];

  }


  try {

    const data =
      await apiRequest(
        "/api/conversations"
      );


    const list =

      data.conversations ||

      data.items ||

      [];


    conversations =
      Array.isArray(list)
        ? list
        : [];


    renderConversationList();


    return conversations;


  } catch (error) {

    console.log(
      "Could not load conversations:",
      error.message
    );


    return [];

  }

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
    !Array.isArray(
      conversations
    ) ||
    conversations.length === 0
  ) {

    const empty =
      document.createElement("div");


    empty.className =
      "conversation-empty";


    empty.textContent =
      "Nta conversations ziraboneka.";


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


      button.className =
        "conversation-item";


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

          if (
            conversation.session_id
          ) {

            await openConversation(
              conversation.session_id
            );

          }

        }
      );


      conversationList.appendChild(
        button
      );

    }
  );

}


// ============================================================
// OPEN CONVERSATION
// ============================================================

async function openConversation(
  requestedSessionId
) {

  if (!requestedSessionId) {

    return;

  }


  try {

    saveSessionId(
      requestedSessionId
    );


    if (messages) {

      messages.innerHTML =
        "";

    }


    const data =
      await loadConversation(
        requestedSessionId
      );


    const history =

      data.messages ||

      [];


    history.forEach(
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


    renderConversationList();


    setStatus(
      "Conversation yafunguwe",
      "online"
    );


    if (
      window.innerWidth <=
      768
    ) {

      closeMobileSidebar();

    }


  } catch (error) {

    console.error(
      "Could not open conversation:",
      error
    );


    addSystemMessage(
      "Ntibyashoboye gufungura conversation."
    );

  }

}


// ============================================================
// DISPLAY CURRENT CONVERSATION HISTORY
// ============================================================

async function displayConversationHistory() {

  if (
    !authToken ||
    !sessionId
  ) {

    return;

  }


  try {

    await openConversation(
      sessionId
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

async function startNewConversation() {

  // ----------------------------------------------------------
  // CREATE LOCAL SESSION FIRST
  // ----------------------------------------------------------

  const newSessionId =
    createLocalSessionId();


  saveSessionId(
    newSessionId
  );


  // ----------------------------------------------------------
  // CLEAR SCREEN
  // ----------------------------------------------------------

  if (messages) {

    messages.innerHTML =
      "";

  }


  updateWelcomeVisibility();


  // ----------------------------------------------------------
  // CREATE BACKEND CONVERSATION IF AUTHENTICATED
  // ----------------------------------------------------------

  if (authToken) {

    try {

      const data =
        await createConversation(
          "New conversation"
        );


      if (
        data.conversation &&
        data.conversation.session_id
      ) {

        saveSessionId(
          data.conversation.session_id
        );

      }


      await loadConversations();


    } catch (error) {

      console.log(
        "Backend conversation creation skipped:",
        error.message
      );

    }

  }


  setStatus(
    "Conversation nshya yatangiye",
    "online"
  );


  if (userInput) {

    userInput.focus();

  }


  if (
    window.innerWidth <=
    768
  ) {

    closeMobileSidebar();

  }

}


// ============================================================
// CLEAR CHAT SCREEN
// ============================================================

function clearConversation() {

  if (!messages) {

    return;

  }


  messages.innerHTML =
    "";


  updateWelcomeVisibility();


  setStatus(
    "Chat yasibwe kuri screen",
    "normal"
  );


  if (userInput) {

    userInput.focus();

  }

}


// ============================================================
// WORKFLOW MANAGEMENT
// ============================================================

function resetWorkflow() {

  if (!agentWorkflow) {

    return;

  }


  const steps =
    agentWorkflow.querySelectorAll(
      ".workflow-step"
    );


  steps.forEach(
    step => {

      step.classList.remove(
        "active",
        "completed",
        "error"
      );

    }
  );

}


// ============================================================
// SET WORKFLOW PHASE
// ============================================================

function setWorkflowPhase(
  phase,
  state = "active"
) {

  if (!agentWorkflow) {

    return;

  }


  const step =
    agentWorkflow.querySelector(
      `[data-phase="${phase}"]`
    );


  if (!step) {

    return;

  }


  if (state === "active") {

    step.classList.add(
      "active"
    );

  } else if (
    state === "completed"
  ) {

    step.classList.remove(
      "active"
    );


    step.classList.add(
      "completed"
    );

  } else if (
    state === "error"
  ) {

    step.classList.remove(
      "active"
    );


    step.classList.add(
      "error"
    );

  }

}


// ============================================================
// AGENT VISUAL WORKFLOW
// ============================================================

function startWorkflowAnimation() {

  resetWorkflow();


  const phases = [

    "understand",

    "plan",

    "execute",

    "test",

    "repair",

    "verify",

    "deliver"

  ];


  let currentIndex =
    0;


  const interval =
    setInterval(
      () => {

        if (
          currentIndex > 0
        ) {

          setWorkflowPhase(

            phases[
              currentIndex - 1
            ],

            "completed"

          );

        }


        if (
          currentIndex >=
          phases.length
        ) {

          clearInterval(
            interval
          );


          return;

        }


        setWorkflowPhase(

          phases[
            currentIndex
          ],

          "active"

        );


        currentIndex++;

      },
      700
    );


  return interval;

}


// ============================================================
// COMPLETE WORKFLOW
// ============================================================

function completeWorkflow(
  intervalId = null
) {

  if (intervalId) {

    clearInterval(
      intervalId
    );

  }


  const phases = [

    "understand",

    "plan",

    "execute",

    "test",

    "repair",

    "verify",

    "deliver"

  ];


  phases.forEach(
    phase => {

      setWorkflowPhase(
        phase,
        "completed"
      );

    }
  );

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
  // START STATE
  // ----------------------------------------------------------

  isSending =
    true;


  setSendingState(
    true
  );


  // ----------------------------------------------------------
  // DISPLAY USER MESSAGE
  // ----------------------------------------------------------

  addMessage(
    text,
    "user"
  );


  userInput.value =
    "";


  autoResizeInput();


  // ----------------------------------------------------------
  // UPDATE STATUS
  // ----------------------------------------------------------

  setStatus(
    "Nkwasibwe IRHCF iri gutekereza...",
    "loading"
  );


  // ----------------------------------------------------------
  // WORKFLOW ANIMATION
  // ----------------------------------------------------------

  const workflowInterval =
    startWorkflowAnimation();


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
    // SEND REQUEST
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
    // GET AI RESPONSE
    // --------------------------------------------------------

    const aiResponse =

      data.response ||

      data.reply ||

      data.message?.content ||

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
    // COMPLETE WORKFLOW
    // --------------------------------------------------------

    completeWorkflow(
      workflowInterval
    );


    // --------------------------------------------------------
    // BACKEND ONLINE
    // --------------------------------------------------------

    backendOnline =
      true;


    setStatus(
      "Ready",
      "online"
    );


    // --------------------------------------------------------
    // REFRESH CONVERSATIONS
    // --------------------------------------------------------

    if (authToken) {

      loadConversations();

    }


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
    // STOP WORKFLOW
    // --------------------------------------------------------

    clearInterval(
      workflowInterval
    );


    // --------------------------------------------------------
    // GET ERROR MESSAGE
    // --------------------------------------------------------

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
        "failed to fetch"
      ) ||

      lowerError.includes(
        "network"
      ) ||

      lowerError.includes(
        "server"
      )

    ) {

      errorMessage =
        "Ntibyashoboye kuvugana na server. Niba ari ubwa mbere, Render free server ishobora kuba iri kubyuka. Tegereza gato wongere ugerageze.";

    }


    // --------------------------------------------------------
    // SHOW ERROR
    // --------------------------------------------------------

    addSystemMessage(
      `Habaye ikibazo: ${errorMessage}`
    );


    // --------------------------------------------------------
    // WORKFLOW ERROR
    // --------------------------------------------------------

    setWorkflowPhase(
      "execute",
      "error"
    );


    backendOnline =
      false;


    setStatus(
      "Hari ikibazo",
      "error"
    );


  } finally {


    // --------------------------------------------------------
    // RESET STATE
    // --------------------------------------------------------

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
// SUGGESTION BUTTONS
// ============================================================

function initializeSuggestions() {

  const suggestionButtons =
    document.querySelectorAll(
      ".suggestion"
    );


  suggestionButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const prompt =
            button.dataset.prompt;


          if (
            prompt &&
            userInput
          ) {

            userInput.value =
              prompt;


            autoResizeInput();


            userInput.focus();

          }

        }
      );

    }
  );

}


// ============================================================
// MOBILE SIDEBAR
// ============================================================

function openMobileSidebar() {

  if (!sidebar) {

    return;

  }


  sidebar.classList.add(
    "mobile-open"
  );

}


// ============================================================
// CLOSE MOBILE SIDEBAR
// ============================================================

function closeMobileSidebar() {

  if (!sidebar) {

    return;

  }


  sidebar.classList.remove(
    "mobile-open"
  );

}


// ============================================================
// TOGGLE MOBILE SIDEBAR
// ============================================================

function toggleMobileSidebar() {

  if (!sidebar) {

    return;

  }


  sidebar.classList.toggle(
    "mobile-open"
  );

}


// ============================================================
// EVENT LISTENERS
// ============================================================

function initializeEventListeners() {


  // ----------------------------------------------------------
  // SEND BUTTON
  // ----------------------------------------------------------

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      sendMessage
    );

  }


  // ----------------------------------------------------------
  // TEXT INPUT
  // ----------------------------------------------------------

  if (userInput) {

    userInput.addEventListener(
      "input",
      autoResizeInput
    );


    userInput.addEventListener(
      "keydown",
      function(event) {


        // Enter sends message.
        // Shift + Enter creates a new line.

        if (

          event.key ===
          "Enter" &&

          !event.shiftKey

        ) {

          event.preventDefault();


          sendMessage();

        }

      }
    );

  }


  // ----------------------------------------------------------
  // NEW CONVERSATION - SIDEBAR
  // ----------------------------------------------------------

  if (newChatButton) {

    newChatButton.addEventListener(
      "click",
      startNewConversation
    );

  }


  // ----------------------------------------------------------
  // NEW CONVERSATION - HEADER
  // ----------------------------------------------------------

  if (headerNewChatButton) {

    headerNewChatButton.addEventListener(
      "click",
      startNewConversation
    );

  }


  // ----------------------------------------------------------
  // CLEAR CHAT
  // ----------------------------------------------------------

  if (clearChatButton) {

    clearChatButton.addEventListener(
      "click",
      clearConversation
    );

  }


  // ----------------------------------------------------------
  // MOBILE MENU
  // ----------------------------------------------------------

  if (mobileMenuButton) {

    mobileMenuButton.addEventListener(
      "click",
      toggleMobileSidebar
    );

  }

}


// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApp() {


  console.log(
    "================================"
  );


  console.log(
    "Initializing Nkwasibwe IRHCF..."
  );


  console.log(
    "================================"
  );


  // ----------------------------------------------------------
  // LOAD USER
  // ----------------------------------------------------------

  loadSavedUser();


  // ----------------------------------------------------------
  // EVENT LISTENERS
  // ----------------------------------------------------------

  initializeEventListeners();


  // ----------------------------------------------------------
  // SUGGESTIONS
  // ----------------------------------------------------------

  initializeSuggestions();


  // ----------------------------------------------------------
  // AUTO RESIZE
  // ----------------------------------------------------------

  autoResizeInput();


  // ----------------------------------------------------------
  // WELCOME STATE
  // ----------------------------------------------------------

  updateWelcomeVisibility();


  // ----------------------------------------------------------
  // CHECK SERVER
  // ----------------------------------------------------------

  await checkBackendHealth();


  // ----------------------------------------------------------
  // CHECK AUTH USER
  // ----------------------------------------------------------

  if (authToken) {

    await getCurrentUser();


    // --------------------------------------------------------
    // LOAD CONVERSATIONS
    // --------------------------------------------------------

    if (currentUser) {

      await loadConversations();


      if (sessionId) {

        await displayConversationHistory();

      }

    }

  }


  // ----------------------------------------------------------
  // INPUT FOCUS
  // ----------------------------------------------------------

  if (userInput) {

    userInput.focus();

  }


  console.log(
    "Nkwasibwe IRHCF initialized successfully."
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

  // Chat
  sendMessage,

  // Conversation
  startNewConversation,
  clearConversation,
  loadConversation,
  loadConversations,
  openConversation,

  // Backend
  checkBackendHealth,

  // Utility
  addMessage,
  setStatus

};
