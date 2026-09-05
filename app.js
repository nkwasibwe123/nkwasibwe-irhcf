// ============================================================
// NKWASIBWE IRHCF
// AI AGENT PLATFORM - FRONTEND APPLICATION
//
// Core Vision:
// Understand → Plan → Execute → Test → Repair → Verify → Deliver
//
// Architecture Principle:
// Build a reliable foundation first, then expand capabilities
// through modular backend and agent services.
// ============================================================



// ============================================================
// CONFIGURATION
// ============================================================
const MAX_INPUT_HEIGHT = 180;
const MAX_CONVERSATION_TITLE_LENGTH = 80;
const APP_CONFIG = Object.freeze({

  appName:
    "Nkwasibwe IRHCF",

  apiBaseUrl:
    "https://nkwasibwe-irhcf.onrender.com",

  apiTimeout:
    30000,

  healthTimeout:
    15000,

  maxConversations:
    50,

  maxLocalMessagesPerConversation:
    100,

  workflowStepDelay:
    450,

  storagePrefix:
    "nkwasibwe_"

});


const API_BASE_URL =
  APP_CONFIG.apiBaseUrl;



// ============================================================
// API ENDPOINTS
// ============================================================

const API_ENDPOINTS = Object.freeze({

  health:
    "/api/health",

  chat:
    "/api/chat",

  register:
    "/api/register",

  login:
    "/api/login",

  me:
    "/api/me",

  conversations:
    "/api/conversations"

});



// ============================================================
// DOM ELEMENTS
// ============================================================

const userInput =
  document.getElementById(
    "userInput"
  );


const sendButton =
  document.getElementById(
    "sendButton"
  );


const messages =
  document.getElementById(
    "messages"
  );


const chat =
  document.getElementById(
    "chat"
  );


const welcomeElement =
  document.getElementById(
    "welcome"
  );


const workflowElement =
  document.getElementById(
    "agentWorkflow"
  );


const suggestionsElement =
  document.getElementById(
    "suggestions"
  );


const conversationList =
  document.getElementById(
    "conversationList"
  );


const newChatButton =
  document.getElementById(
    "newChatButton"
  );


const headerNewChatButton =
  document.getElementById(
    "headerNewChatButton"
  );


const clearChatButton =
  document.getElementById(
    "clearChatButton"
  );


const mobileMenuButton =
  document.getElementById(
    "mobileMenuButton"
  );


const sidebar =
  document.getElementById(
    "sidebar"
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


const agentStatusText =
  document.getElementById(
    "agentStatusText"
  );


const agentStatusDot =
  document.getElementById(
    "agentStatusDot"
  );


const suggestionButtons =
  document.querySelectorAll(
    ".suggestion"
  );


const workflowSteps =
  document.querySelectorAll(
    ".workflow-step"
  );



// ============================================================
// APPLICATION STATE
// ============================================================

const appState = {

  sessionId:
    localStorage.getItem(
      "nkwasibwe_session_id"
    ) || null,


  authToken:
    localStorage.getItem(
      "nkwasibwe_auth_token"
    ) || null,


  currentUser:
    null,


  isSending:
    false,


  backendOnline:
    false,


  backendChecked:
    false,


  conversations:
    [],


  currentMessages:
    [],


  activeRequestController:
    null,


  initialized:
    false


};


// ------------------------------------------------------------
// Backward-compatible variables.
//
// These keep the rest of the application easy to read while the
// central state object remains the source of truth.
// ------------------------------------------------------------

let sessionId =
  appState.sessionId;


let authToken =
  appState.authToken;


let currentUser =
  appState.currentUser;


let isSending =
  appState.isSending;


let backendOnline =
  appState.backendOnline;


let conversations =
  appState.conversations;



// ============================================================
// STORAGE KEYS
// ============================================================

const STORAGE_KEYS = Object.freeze({

  sessionId:
    "nkwasibwe_session_id",


  authToken:
    "nkwasibwe_auth_token",


  user:
    "nkwasibwe_user",


  conversations:
    "nkwasibwe_conversations",


  messages:
    "nkwasibwe_conversation_messages",


  appVersion:
    "nkwasibwe_app_version"


});



// ============================================================
// APPLICATION VERSION
// ============================================================

const APP_VERSION =
  "2.0.0";



// ============================================================
// SAFE LOCAL STORAGE
// ============================================================

function safeStorageGet(
  key,
  fallback = null
) {

  try {

    const value =
      localStorage.getItem(
        key
      );


    return value === null
      ? fallback
      : value;

  } catch (error) {

    console.error(
      "Storage read error:",
      error
    );


    return fallback;

  }

}



function safeStorageSet(
  key,
  value
) {

  try {

    localStorage.setItem(
      key,
      value
    );


    return true;

  } catch (error) {

    console.error(
      "Storage write error:",
      error
    );


    return false;

  }

}



function safeStorageRemove(
  key
) {

  try {

    localStorage.removeItem(
      key
    );


    return true;

  } catch (error) {

    console.error(
      "Storage remove error:",
      error
    );


    return false;

  }

}



// ============================================================
// SAFE JSON PARSE
// ============================================================

function safeJsonParse(
  value,
  fallback = null
) {

  if (
    typeof value !== "string" ||
    !value
  ) {

    return fallback;

  }


  try {

    return JSON.parse(
      value
    );

  } catch (error) {

    console.error(
      "JSON parse error:",
      error
    );


    return fallback;

  }

}



// ============================================================
// SAFE JSON STRINGIFY
// ============================================================

function safeJsonStringify(
  value,
  fallback = null
) {

  try {

    return JSON.stringify(
      value
    );

  } catch (error) {

    console.error(
      "JSON stringify error:",
      error
    );


    return fallback;

  }

}



// ============================================================
// UPDATE CENTRAL STATE
// ============================================================

function updateSessionState(
  newSessionId
) {

  if (!newSessionId) {
    return;
  }


  sessionId =
    String(
      newSessionId
    );


  appState.sessionId =
    sessionId;

}



function updateAuthState(
  newToken
) {

  authToken =
    newToken || null;


  appState.authToken =
    authToken;

}



function updateUserState(
  user
) {

  currentUser =
    user || null;


  appState.currentUser =
    currentUser;

}



function updateSendingState(
  sending
) {

  isSending =
    Boolean(
      sending
    );


  appState.isSending =
    isSending;

}



function updateBackendState(
  online
) {

  backendOnline =
    Boolean(
      online
    );


  appState.backendOnline =
    backendOnline;

  appState.backendChecked =
    true;

}



function updateConversationsState(
  newConversations
) {

  conversations =
    Array.isArray(
      newConversations
    )

      ? newConversations

      : [];


  appState.conversations =
    conversations;

}



// ============================================================
// CREATE LOCAL SESSION ID
// ============================================================

function createLocalSessionId() {

  const randomPart =

    Math.random()

      .toString(36)

      .substring(
        2,
        12
      );


  return (

    "session-" +

    Date.now() +

    "-" +

    randomPart

  );

}



// ============================================================
// ENSURE SESSION ID
// ============================================================

function ensureSessionId() {

  if (!sessionId) {

    const newSessionId =
      createLocalSessionId();


    saveSessionId(
      newSessionId
    );

  }


  return sessionId;

}



// ============================================================
// SAVE SESSION ID
// ============================================================

function saveSessionId(
  newSessionId
) {

  if (!newSessionId) {
    return;
  }


  updateSessionState(
    newSessionId
  );


  safeStorageSet(

    STORAGE_KEYS.sessionId,

    sessionId

  );

}



// ============================================================
// CLEAR SESSION ID
// ============================================================

function clearSessionId() {

  updateSessionState(
    null
  );


  safeStorageRemove(
    STORAGE_KEYS.sessionId
  );

}



// ============================================================
// CREATE REQUEST ID
// ============================================================

function createRequestId() {

  return (

    "request-" +

    Date.now() +

    "-" +

    Math.random()
      .toString(36)
      .substring(2, 10)

  );

}



// ============================================================
// DELAY
// ============================================================

function delay(
  milliseconds
) {

  return new Promise(

    resolve => {

      setTimeout(

        resolve,

        milliseconds

      );

    }

  );

}



// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(
    value
  )

    .replace(
      /\r\n/g,
      "\n"
    )

    .trim();

}



// ============================================================
// IS NON-EMPTY STRING
// ============================================================

function isNonEmptyString(
  value
) {

  return (

    typeof value ===
      "string" &&

    value.trim().length >
      0

  );

}



// ============================================================
// GET CURRENT TIME
// ============================================================

function getCurrentTimestamp() {

  return new Date()
    .toISOString();

}



// ============================================================
// FORMAT TIME
// ============================================================

function formatMessageTime(
  dateValue = new Date()
) {

  try {

    const date =
      dateValue instanceof Date

        ? dateValue

        : new Date(
            dateValue
          );


    return date.toLocaleTimeString(

      [],

      {

        hour:
          "2-digit",

        minute:
          "2-digit"

      }

    );

  } catch (error) {

    return "";

  }

}



// ============================================================
// CREATE MESSAGE OBJECT
// ============================================================

function createMessageObject(

  role,

  content,

  options = {}

) {

  return {

    id:

      options.id ||

      (

        "message-" +

        Date.now() +

        "-" +

        Math.random()
          .toString(36)
          .substring(2, 9)

      ),


    role:

      role === "user"
        ? "user"
        : (
            role === "system"
              ? "system"
              : "assistant"
          ),


    content:
      normalizeText(
        content
      ),


    created_at:

      options.created_at ||

      getCurrentTimestamp(),


    metadata:

      options.metadata ||

      {}

  };

}



// ============================================================
// GET LOCAL MESSAGE STORE
// ============================================================

function loadLocalMessageStore() {

  const saved =
    safeStorageGet(
      STORAGE_KEYS.messages,
      "{}"
    );


  const parsed =
    safeJsonParse(
      saved,
      {}
    );


  if (

    !parsed ||

    typeof parsed !==
      "object" ||

    Array.isArray(
      parsed
    )

  ) {

    return {};

  }


  return parsed;

}



// ============================================================
// SAVE LOCAL MESSAGE STORE
// ============================================================

function saveLocalMessageStore(
  store
) {

  const serialized =
    safeJsonStringify(
      store,
      "{}"
    );


  return safeStorageSet(

    STORAGE_KEYS.messages,

    serialized

  );

}



// ============================================================
// LOAD LOCAL MESSAGES
// ============================================================

function loadLocalMessages(
  requestedSessionId = sessionId
) {

  if (!requestedSessionId) {
    return [];
  }


  const store =
    loadLocalMessageStore();


  const conversationMessages =
    store[
      requestedSessionId
    ];


  if (
    !Array.isArray(
      conversationMessages
    )
  ) {

    return [];

  }


  return conversationMessages;

}



// ============================================================
// SAVE LOCAL MESSAGES
// ============================================================

function saveLocalMessages(
  requestedSessionId,
  messageList
) {

  if (
    !requestedSessionId
  ) {

    return false;

  }


  const store =
    loadLocalMessageStore();


  const safeMessages =
    Array.isArray(
      messageList
    )

      ? messageList.slice(
          -APP_CONFIG.maxLocalMessagesPerConversation
        )

      : [];


  store[
    requestedSessionId
  ] =
    safeMessages;


  return saveLocalMessageStore(
    store
  );

}



// ============================================================
// ADD LOCAL MESSAGE
// ============================================================

function addLocalMessage(
  messageObject,
  requestedSessionId = sessionId
) {

  if (
    !requestedSessionId ||
    !messageObject
  ) {

    return;

  }


  const messageList =
    loadLocalMessages(
      requestedSessionId
    );


  messageList.push(
    messageObject
  );


  saveLocalMessages(

    requestedSessionId,

    messageList

  );

}



// ============================================================
// CLEAR LOCAL MESSAGES
// ============================================================

function clearLocalMessages(
  requestedSessionId = sessionId
) {

  if (!requestedSessionId) {
    return;
  }


  const store =
    loadLocalMessageStore();


  delete store[
    requestedSessionId
  ];


  saveLocalMessageStore(
    store
  );

}



// ============================================================
// SAVE AUTHENTICATION
// ============================================================

function saveAuth(
  token,
  user = null
) {

  if (token) {

    updateAuthState(
      token
    );


    safeStorageSet(

      STORAGE_KEYS.authToken,

      authToken

    );

  }


  if (user) {

    updateUserState(
      user
    );


    safeStorageSet(

      STORAGE_KEYS.user,

      safeJsonStringify(
        currentUser,
        "{}"
      )

    );

  }

}



// ============================================================
// LOAD SAVED USER
// ============================================================

function loadSavedUser() {

  const savedUser =
    safeStorageGet(
      STORAGE_KEYS.user
    );


  if (!savedUser) {

    updateUserState(
      null
    );


    return null;

  }


  const parsedUser =
    safeJsonParse(
      savedUser
    );


  if (

    parsedUser &&

    typeof parsedUser ===
      "object"

  ) {

    updateUserState(
      parsedUser
    );


    return currentUser;

  }


  updateUserState(
    null
  );


  return null;

}



// ============================================================
// CLEAR AUTHENTICATION
// ============================================================

function clearAuth() {

  updateAuthState(
    null
  );


  updateUserState(
    null
  );


  safeStorageRemove(
    STORAGE_KEYS.authToken
  );


  safeStorageRemove(
    STORAGE_KEYS.user
  );

}



// ============================================================
// LOGOUT
// ============================================================

function logout() {

  clearAuth();


  setStatus(
    "Wasohotse muri konti.",
    "normal"
  );

}



// ============================================================
// CREATE REQUEST CONTROLLER
// ============================================================

function createRequestController() {

  if (
    appState.activeRequestController
  ) {

    try {

      appState.activeRequestController.abort();

    } catch (error) {

      console.log(
        "Previous request cleanup:",
        error
      );

    }

  }


  const controller =
    new AbortController();


  appState.activeRequestController =
    controller;


  return controller;

}



// ============================================================
// CLEAR REQUEST CONTROLLER
// ============================================================

function clearRequestController(
  controller
) {

  if (
    !controller ||
    appState.activeRequestController ===
      controller
  ) {

    appState.activeRequestController =
      null;

  }

}



// ============================================================
// API REQUEST
// ============================================================

async function apiRequest(

  endpoint,

  options = {}

) {

  const headers = {

    Accept:
      "application/json",


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
  // REQUEST CONTROLLER
  // ----------------------------------------------------------

  const externalSignal =
    options.signal;


  const controller =
    new AbortController();


  const timeout =
    setTimeout(

      () => {

        controller.abort();

      },

      APP_CONFIG.apiTimeout

    );


  // ----------------------------------------------------------
  // HANDLE EXTERNAL ABORT
  // ----------------------------------------------------------

  let externalAbortHandler =
    null;


  if (externalSignal) {

    if (externalSignal.aborted) {

      controller.abort();

    } else {

      externalAbortHandler =
        () => {

          controller.abort();

        };


      externalSignal.addEventListener(

        "abort",

        externalAbortHandler,

        {

          once:
            true

        }

      );

    }

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

          headers,

          signal:
            controller.signal

        }

      );

  } catch (error) {

    if (

      error.name ===
        "AbortError"

    ) {

      throw new Error(
        "Request yafashe igihe kirekire. Gerageza nanone."
      );

    }


    throw new Error(
      "Ntibyashoboye kugera kuri server. Reba internet cyangwa utegereze server ibe imaze kubyuka."
    );

  } finally {

    clearTimeout(
      timeout
    );


    if (

      externalSignal &&

      externalAbortHandler

    ) {

      externalSignal.removeEventListener(

        "abort",

        externalAbortHandler

      );

    }

  }


  // ----------------------------------------------------------
  // READ RESPONSE
  // ----------------------------------------------------------

  const contentType =

    response.headers.get(
      "content-type"
    ) ||

    "";


  let data =
    null;


  if (

    contentType.includes(
      "application/json"
    )

  ) {

    try {

      data =
        await response.json();

    } catch (error) {

      data =
        null;

    }

  } else {

    try {

      const text =
        await response.text();


      data = {

        message:
          text

      };

    } catch (error) {

      data =
        null;

    }

  }


  // ----------------------------------------------------------
  // UNAUTHORIZED
  // ----------------------------------------------------------

  if (

    response.status === 401 &&

    endpoint !==
      API_ENDPOINTS.login &&

    endpoint !==
      API_ENDPOINTS.register

  ) {

    logout();

  }


  // ----------------------------------------------------------
  // ERROR
  // ----------------------------------------------------------

  if (!response.ok) {

    const errorMessage =

      data?.error ||

      data?.message ||

      data?.detail ||

      `Backend error (${response.status})`;


    throw new Error(
      errorMessage
    );

  }


  return data || {

    success:
      true

  };

}



// ============================================================
// CHECK BACKEND HEALTH
// ============================================================
function setStatus(message, type = "info") {
  console.log(`[STATUS] ${message}`);

  const statusElement =
    document.getElementById("status") ||
    document.getElementById("statusText") ||
    document.getElementById("connectionStatus");

  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.dataset.status = type;
}
async function checkBackendHealth() {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => {
      controller.abort();
    },
    APP_CONFIG.healthTimeout
  );

  try {
    setStatus(
      "Kugenzura server...",
      "loading"
    );

    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.health}`,
      {
        method: "GET",

        headers: {
          Accept: "application/json"
        },

        signal: controller.signal
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (
      response.ok &&
      (
        !data ||
        data.success !== false
      )
    ) {
      updateBackendState(true);

      setStatus(
        "Server iri online",
        "online"
      );

      return true;
    }

    updateBackendState(false);

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

    updateBackendState(false);

    setStatus(
      "Server ntiboneka cyangwa iri kubyuka",
      "error"
    );

    return false;

  } finally {
    clearTimeout(timeout);
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

      API_ENDPOINTS.register,

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


  if (data?.token) {

    saveAuth(

      data.token,

      data.user || null

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

      API_ENDPOINTS.login,

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


  if (data?.token) {

    saveAuth(

      data.token,

      data.user || null

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
        API_ENDPOINTS.me
      );


    if (data?.user) {

      updateUserState(
        data.user
      );


      safeStorageSet(

        STORAGE_KEYS.user,

        safeJsonStringify(

          currentUser,

          "{}"

        )

      );

    }


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
// SAVE APP VERSION
// ============================================================

function saveAppVersion() {

  safeStorageSet(

    STORAGE_KEYS.appVersion,

    APP_VERSION

  );

}

// ============================================================
// WORKFLOW MANAGEMENT
// ============================================================

const WORKFLOW_PHASES = [

  "understand",

  "plan",

  "execute",

  "test",

  "repair",

  "verify",

  "deliver"

];


// ============================================================
// RESET WORKFLOW
// ============================================================

function resetWorkflow() {

  workflowSteps.forEach(

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
// ACTIVATE WORKFLOW STEP
// ============================================================

function activateWorkflowStep(
  phase
) {

  if (!phase) {

    return;

  }


  workflowSteps.forEach(

    step => {

      if (

        step.dataset.phase ===
        phase

      ) {

        step.classList.remove(
          "completed",
          "error"
        );


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


// ============================================================
// COMPLETE WORKFLOW STEP
// ============================================================

function completeWorkflowStep(
  phase
) {

  if (!phase) {

    return;

  }


  workflowSteps.forEach(

    step => {

      if (

        step.dataset.phase ===
        phase

      ) {

        step.classList.remove(
          "active",
          "error"
        );


        step.classList.add(
          "completed"
        );

      }

    }

  );

}


// ============================================================
// MARK WORKFLOW STEP AS ERROR
// ============================================================

function errorWorkflowStep(
  phase
) {

  if (!phase) {

    return;

  }


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
          "error"
        );

      }

    }

  );

}


// ============================================================
// COMPLETE ALL WORKFLOW STEPS
// ============================================================

function completeWorkflow() {

  WORKFLOW_PHASES.forEach(

    phase => {

      completeWorkflowStep(
        phase
      );

    }

  );

}


// ============================================================
// SLEEP UTILITY
// ============================================================

function sleep(
  milliseconds
) {

  return new Promise(

    resolve => {

      setTimeout(

        resolve,

        milliseconds

      );

    }

  );

}


// ============================================================
// RUN VISUAL WORKFLOW
// ============================================================

async function runWorkflowAnimation() {

  resetWorkflow();


  for (

    let index = 0;

    index < WORKFLOW_PHASES.length;

    index++

  ) {

    if (!isSending) {

      return false;

    }


    const phase =
      WORKFLOW_PHASES[index];


    activateWorkflowStep(
      phase
    );


    await sleep(
      400
    );


    if (!isSending) {

      return false;

    }


    completeWorkflowStep(
      phase
    );

  }


  return true;

}


// ============================================================
// UPDATE WORKFLOW FROM BACKEND
// ============================================================

function updateWorkflowFromBackend(
  workflow
) {

  if (

    !workflow ||

    !Array.isArray(
      workflow
    )

  ) {

    return;

  }


  resetWorkflow();


  workflow.forEach(

    item => {

      const phase =

        typeof item ===
        "string"

          ? item

          : item.phase;


      const status =

        typeof item ===
        "object"

          ? item.status

          : "completed";


      if (!phase) {

        return;

      }


      if (

        status ===
        "active" ||

        status ===
        "running"

      ) {

        activateWorkflowStep(
          phase
        );

      } else if (

        status ===
        "error" ||

        status ===
        "failed"

      ) {

        errorWorkflowStep(
          phase
        );

      } else {

        completeWorkflowStep(
          phase
        );

      }

    }

  );

}


// ============================================================
// CONVERSATION STORAGE
// ============================================================

function loadLocalConversations() {

  const saved =
    safeStorageGet(
      STORAGE_KEYS.conversations
    );


  if (!saved) {

    conversations =
      [];

    return conversations;

  }


  const parsed =
    safeJsonParse(
      saved,
      []
    );


  conversations =
    Array.isArray(
      parsed
    )

      ? parsed

      : [];


  return conversations;

}


// ============================================================
// SAVE LOCAL CONVERSATIONS
// ============================================================

function saveLocalConversations() {

  const serialized =
    safeJsonStringify(
      conversations,
      "[]"
    );


  return safeStorageSet(

    STORAGE_KEYS.conversations,

    serialized

  );

}


// ============================================================
// NORMALIZE CONVERSATION
// ============================================================

function normalizeConversation(
  conversation
) {

  if (

    !conversation ||

    typeof conversation !==
    "object"

  ) {

    return null;

  }


  const normalizedSessionId =

    conversation.session_id ||

    conversation.sessionId ||

    conversation.id ||

    null;


  if (!normalizedSessionId) {

    return null;

  }


  return {

    ...conversation,

    session_id:
      String(
        normalizedSessionId
      ),

    title:

      String(

        conversation.title ||

        "New conversation"

      ).trim() ||

      "New conversation",

    updated_at:

      conversation.updated_at ||

      conversation.updatedAt ||

      new Date().toISOString()

  };

}


// ============================================================
// SORT CONVERSATIONS
// ============================================================

function sortConversations() {

  conversations.sort(

    (first, second) => {

      const firstDate =
        new Date(
          first.updated_at || 0
        ).getTime();


      const secondDate =
        new Date(
          second.updated_at || 0
        ).getTime();


      return secondDate - firstDate;

    }

  );

}


// ============================================================
// FIND CONVERSATION
// ============================================================

function findConversation(
  requestedSessionId = sessionId
) {

  if (!requestedSessionId) {

    return null;

  }


  return (

    conversations.find(

      conversation =>

        conversation.session_id ===
        requestedSessionId

    ) ||

    null

  );

}


// ============================================================
// SAVE CURRENT CONVERSATION
// ============================================================

function saveCurrentConversation(
  title = null
) {

  const activeSessionId =
    ensureSessionId();


  if (!activeSessionId) {

    return null;

  }


  const existingIndex =
    conversations.findIndex(

      conversation =>

        conversation.session_id ===
        activeSessionId

    );


  const existingConversation =

    existingIndex >= 0

      ? conversations[
          existingIndex
        ]

      : null;


  const conversationTitle =

    String(

      title ||

      existingConversation?.title ||

      "New conversation"

    ).trim() ||

    "New conversation";


  const conversationData = {

    ...(existingConversation || {}),

    session_id:
      activeSessionId,

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


  sortConversations();


  // ----------------------------------------------------------
  // LIMIT LOCAL STORAGE SIZE
  // ----------------------------------------------------------

  conversations =
    conversations.slice(
      0,
      100
    );


  saveLocalConversations();

  renderConversationList();


  return conversationData;

}


// ============================================================
// REMOVE LOCAL CONVERSATION
// ============================================================

function removeLocalConversation(
  requestedSessionId
) {

  if (!requestedSessionId) {

    return false;

  }


  const previousLength =
    conversations.length;


  conversations =
    conversations.filter(

      conversation =>

        conversation.session_id !==
        requestedSessionId

    );


  if (

    conversations.length ===
    previousLength

  ) {

    return false;

  }


  saveLocalConversations();

  renderConversationList();


  return true;

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
      document.createElement(
        "div"
      );


    empty.classList.add(
      "conversation-empty"
    );


    empty.textContent =
      "Nta conversations zirabikwa hano.";


    conversationList.appendChild(
      empty
    );


    return;

  }


  conversations.forEach(

    rawConversation => {

      const conversation =
        normalizeConversation(
          rawConversation
        );


      if (!conversation) {

        return;

      }


      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.classList.add(
        "conversation-item"
      );


      button.setAttribute(

        "aria-label",

        `Open conversation: ${conversation.title}`

      );


      if (

        conversation.session_id ===
        sessionId

      ) {

        button.classList.add(
          "active"
        );

      }


      const titleElement =
        document.createElement(
          "span"
        );


      titleElement.classList.add(
        "conversation-title"
      );


      titleElement.textContent =
        conversation.title;


      button.appendChild(
        titleElement
      );


      button.addEventListener(

        "click",

        async () => {

          if (isSending) {

            return;

          }


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
// CREATE CONVERSATION LOCALLY
// ============================================================

function createLocalConversation(
  title = "New conversation"
) {

  const newSessionId =
    createLocalSessionId();


  saveSessionId(
    newSessionId
  );


  const conversation =
    saveCurrentConversation(
      title
    );


  return {

    success:
      true,

    local:
      true,

    conversation

  };

}


// ============================================================
// CREATE CONVERSATION
// ============================================================

async function createConversation(
  title = "New conversation"
) {

  // ----------------------------------------------------------
  // CREATE THROUGH BACKEND WHEN AVAILABLE
  // ----------------------------------------------------------

  if (

    authToken &&

    backendOnline

  ) {

    try {

      const data =
        await apiRequest(

          API_ENDPOINTS.conversations,

          {

            method:
              "POST",

            body:
              JSON.stringify({

                title

              })

          }

        );


      const backendConversation =

        data?.conversation ||

        data?.data?.conversation ||

        null;


      const newSessionId =

        backendConversation?.session_id ||

        backendConversation?.sessionId ||

        data?.session_id ||

        data?.sessionId ||

        null;


      if (newSessionId) {

        saveSessionId(
          String(
            newSessionId
          )
        );

      }


      const savedConversation =
        saveCurrentConversation(

          backendConversation?.title ||

          title

        );


      return {

        ...data,

        success:

          data?.success !== false,

        conversation:

          normalizeConversation(
            backendConversation
          ) ||

          savedConversation

      };

    } catch (error) {

      console.log(

        "Backend conversation creation failed. Using local conversation:",

        error.message

      );

    }

  }


  // ----------------------------------------------------------
  // LOCAL FALLBACK
  // ----------------------------------------------------------

  return createLocalConversation(
    title
  );

}


// ============================================================
// LOAD CONVERSATION FROM BACKEND
// ============================================================

async function loadConversation(
  requestedSessionId = sessionId
) {

  if (!requestedSessionId) {

    return null;

  }


  const endpoint =

    `${API_ENDPOINTS.conversations}/` +

    encodeURIComponent(
      requestedSessionId
    );


  return await apiRequest(
    endpoint
  );

}


// ============================================================
// EXTRACT CONVERSATION MESSAGES
// ============================================================

function extractConversationMessages(
  data
) {

  if (!data) {

    return [];

  }


  const possibleMessages = [

    data.messages,

    data.conversation?.messages,

    data.data?.messages,

    data.data?.conversation?.messages

  ];


  for (

    const candidate of
    possibleMessages

  ) {

    if (

      Array.isArray(
        candidate
      )

    ) {

      return candidate;

    }

  }


  return [];

}


// ============================================================
// NORMALIZE MESSAGE
// ============================================================

function normalizeHistoryMessage(
  message
) {

  if (!message) {

    return null;

  }


  if (

    typeof message ===
    "string"

  ) {

    return {

      role:
        "ai",

      content:
        message

    };

  }


  if (

    typeof message !==
    "object"

  ) {

    return null;

  }


  const role =

    message.role ||

    message.type ||

    message.sender ||

    "ai";


  const content =

    message.content ??

    message.message ??

    message.text ??

    message.response ??

    "";


  if (

    content === null ||

    content === undefined ||

    content === ""

  ) {

    return null;

  }


  return {

    role:
      String(role).toLowerCase(),

    content:
      typeof content ===
      "string"

        ? content

        : safeJsonStringify(
            content,
            String(content)
          )

  };

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


    const historyMessages =
      extractConversationMessages(
        data
      );


    if (

      !Array.isArray(
        historyMessages
      )

    ) {

      return false;

    }


    messages.innerHTML =
      "";


    historyMessages.forEach(

      rawMessage => {

        const message =
          normalizeHistoryMessage(
            rawMessage
          );


        if (!message) {

          return;

        }


        const type =

          message.role ===
          "user"

            ? "user"

            : message.role ===
              "system"

                ? "system"

                : "ai";


        addMessage(

          message.content,

          type

        );

      }

    );


    updateWelcomeVisibility();

    scrollToBottom();


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

    isSending

  ) {

    return false;

  }


  // ----------------------------------------------------------
  // ALREADY ACTIVE
  // ----------------------------------------------------------

  if (

    requestedSessionId ===
    sessionId

  ) {

    closeMobileSidebar();

    return true;

  }


  // ----------------------------------------------------------
  // SAVE CURRENT SESSION
  // ----------------------------------------------------------

  if (sessionId) {

    saveCurrentConversation();

  }


  // ----------------------------------------------------------
  // SWITCH SESSION
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // LOAD HISTORY
  // ----------------------------------------------------------

  const loaded =
    await displayConversationHistory();


  // ----------------------------------------------------------
  // LOCAL-ONLY CONVERSATION
  // ----------------------------------------------------------

  if (

    !loaded &&

    authToken &&

    backendOnline

  ) {

    addSystemMessage(

      "Iyi conversation ntirabasha kuboneka muri server."

    );

  }


  setStatus(

    backendOnline

      ? "Server iri online"

      : "Conversation local iri gukora",

    backendOnline

      ? "online"

      : "normal"

  );


  closeMobileSidebar();


  return true;

}


// ============================================================
// START NEW CONVERSATION
// ============================================================

async function startNewConversation() {

  if (isSending) {

    return;

  }


  // ----------------------------------------------------------
  // SAVE CURRENT CONVERSATION
  // ----------------------------------------------------------

  if (sessionId) {

    saveCurrentConversation();

  }


  // ----------------------------------------------------------
  // CLEAR SCREEN
  // ----------------------------------------------------------

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

    console.error(

      "Could not create conversation:",

      error

    );


    createLocalConversation(
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
// CLEAR CURRENT CONVERSATION SCREEN
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
// DELETE CURRENT LOCAL CONVERSATION
// ============================================================

async function deleteCurrentConversation() {

  if (

    !sessionId ||

    isSending

  ) {

    return false;

  }


  const deletedSessionId =
    sessionId;


  removeLocalConversation(
    deletedSessionId
  );


  // ----------------------------------------------------------
  // TRY BACKEND DELETE
  // ----------------------------------------------------------

  if (

    authToken &&

    backendOnline

  ) {

    try {

      await apiRequest(

        `${API_ENDPOINTS.conversations}/` +

        encodeURIComponent(
          deletedSessionId
        ),

        {

          method:
            "DELETE"

        }

      );

    } catch (error) {

      console.log(

        "Backend conversation delete failed:",

        error.message

      );

    }

  }


  await startNewConversation();


  return true;

}


// ============================================================
// GENERATE CONVERSATION TITLE
// ============================================================

function generateConversationTitle(
  text
) {

  if (

    typeof text !==
    "string"

  ) {

    return "New conversation";

  }


  const cleanText =
    text

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  if (!cleanText) {

    return "New conversation";

  }


  const maxLength =
    50;


  if (

    cleanText.length <=
    maxLength

  ) {

    return cleanText;

  }


  return (

    cleanText.substring(

      0,

      maxLength

    ) +

    "..."

  );

}


// ============================================================
// GET CURRENT CONVERSATION TITLE
// ============================================================

function getCurrentConversationTitle(
  fallbackText = ""
) {

  const existingConversation =
    findConversation(
      sessionId
    );


  if (

    existingConversation?.title &&

    existingConversation.title !==
    "New conversation"

  ) {

    return existingConversation.title;

  }


  return generateConversationTitle(
    fallbackText
  );

}


// ============================================================
// UPDATE CURRENT CONVERSATION TITLE
// ============================================================

function updateCurrentConversationTitle(
  text
) {

  if (!text) {

    return null;

  }


  const existingConversation =
    findConversation(
      sessionId
    );


  if (

    existingConversation?.title &&

    existingConversation.title !==
    "New conversation"

  ) {

    return existingConversation;

  }


  return saveCurrentConversation(

    generateConversationTitle(
      text
    )

  );

}


// ============================================================
// GET CONVERSATIONS FROM BACKEND
// ============================================================

async function getBackendConversations() {

  if (!authToken) {

    return [];

  }


  try {

    const data =
      await apiRequest(
        API_ENDPOINTS.conversations
      );


    const possibleConversations = [

      data.conversations,

      data.data?.conversations,

      data.data,

      data

    ];


    for (

      const candidate of
      possibleConversations

    ) {

      if (

        Array.isArray(
          candidate
        )

      ) {

        return candidate

          .map(
            normalizeConversation
          )

          .filter(
            Boolean
          );

      }

    }


    return [];

  } catch (error) {

    console.log(

      "Could not load backend conversations:",

      error.message

    );


    return [];

  }

}


// ============================================================
// MERGE BACKEND CONVERSATIONS
// ============================================================

function mergeConversations(
  backendConversations
) {

  if (

    !Array.isArray(
      backendConversations
    )

  ) {

    return conversations;

  }


  const map =
    new Map();


  conversations.forEach(

    conversation => {

      const normalized =
        normalizeConversation(
          conversation
        );


      if (normalized) {

        map.set(

          normalized.session_id,

          normalized

        );

      }

    }

  );


  backendConversations.forEach(

    conversation => {

      const normalized =
        normalizeConversation(
          conversation
        );


      if (normalized) {

        const existing =
          map.get(
            normalized.session_id
          );


        map.set(

          normalized.session_id,

          {

            ...(existing || {}),

            ...normalized

          }

        );

      }

    }

  );


  conversations =
    Array.from(
      map.values()
    );


  sortConversations();


  conversations =
    conversations.slice(
      0,
      100
    );


  saveLocalConversations();

  renderConversationList();


  return conversations;

}


// ============================================================
// REFRESH CONVERSATIONS
// ============================================================

async function refreshConversations() {

  const backendConversations =
    await getBackendConversations();


  if (

    backendConversations.length > 0

  ) {

    mergeConversations(
      backendConversations
    );

  } else {

    renderConversationList();

  }


  return conversations;

}


// ============================================================
// CONVERSATION MANAGEMENT COMPLETE
// ============================================================
// ============================================================
// CONVERSATION STORAGE
// ============================================================

function loadLocalConversations() {

  const savedConversations =
    safeStorageGet(
      STORAGE_KEYS.conversations
    );


  if (!savedConversations) {

    conversations =
      [];

    return;

  }


  const parsed =
    safeJsonParse(
      savedConversations,
      []
    );


  conversations =
    Array.isArray(parsed)
      ? parsed
      : [];

}


// ============================================================
// SAVE LOCAL CONVERSATIONS
// ============================================================

function saveLocalConversations() {

  const serialized =
    safeJsonStringify(
      conversations,
      "[]"
    );


  safeStorageSet(

    STORAGE_KEYS.conversations,

    serialized

  );

}


// ============================================================
// NORMALIZE CONVERSATION
// ============================================================

function normalizeConversation(
  conversation
) {

  if (
    !conversation ||
    typeof conversation !==
      "object"
  ) {

    return null;

  }


  const normalizedSessionId =

    conversation.session_id ||

    conversation.sessionId ||

    conversation.id ||

    null;


  if (!normalizedSessionId) {

    return null;

  }


  return {

    session_id:
      String(
        normalizedSessionId
      ),

    title:

      String(

        conversation.title ||

        "New conversation"

      ).trim() ||

      "New conversation",


    updated_at:

      conversation.updated_at ||

      conversation.updatedAt ||

      new Date()
        .toISOString()

  };

}


// ============================================================
// NORMALIZE LOCAL CONVERSATIONS
// ============================================================

function normalizeLocalConversations() {

  const unique =
    new Map();


  conversations.forEach(
    conversation => {

      const normalized =
        normalizeConversation(
          conversation
        );


      if (!normalized) {

        return;

      }


      unique.set(

        normalized.session_id,

        normalized

      );

    }
  );


  conversations =
    Array.from(
      unique.values()
    );


  conversations.sort(
    (a, b) => {

      const aTime =
        new Date(
          a.updated_at
        ).getTime();


      const bTime =
        new Date(
          b.updated_at
        ).getTime();


      return bTime - aTime;

    }
  );


  conversations =
    conversations.slice(
      0,
      MAX_LOCAL_CONVERSATIONS
    );

}


// ============================================================
// FORMAT CONVERSATION TITLE
// ============================================================

function sanitizeConversationTitle(
  title
) {

  if (
    typeof title !==
    "string"
  ) {

    return "New conversation";

  }


  const cleanTitle =

    title

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  if (!cleanTitle) {

    return "New conversation";

  }


  return cleanTitle.slice(
    0,
    MAX_CONVERSATION_TITLE_LENGTH
  );

}


// ============================================================
// GENERATE CONVERSATION TITLE
// ============================================================

function generateConversationTitle(
  text
) {

  const cleanText =

    String(
      text || ""
    )

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  if (!cleanText) {

    return "New conversation";

  }


  if (

    cleanText.length <=
    MAX_CONVERSATION_TITLE_LENGTH

  ) {

    return cleanText;

  }


  return (

    cleanText.slice(

      0,

      Math.max(

        1,

        MAX_CONVERSATION_TITLE_LENGTH -
          3

      )

    ) +

    "..."

  );

}


// ============================================================
// GET CURRENT CONVERSATION
// ============================================================

function getCurrentConversation() {

  if (!sessionId) {

    return null;

  }


  return (

    conversations.find(

      conversation =>

        conversation.session_id ===
        sessionId

    ) ||

    null

  );

}


// ============================================================
// SAVE CURRENT CONVERSATION
// ============================================================

function saveCurrentConversation(
  title = null
) {

  const activeSessionId =
    ensureSessionId();


  if (!activeSessionId) {

    return null;

  }


  const existingIndex =

    conversations.findIndex(

      conversation =>

        conversation.session_id ===
        activeSessionId

    );


  const existingConversation =

    existingIndex >= 0

      ? conversations[
          existingIndex
        ]

      : null;


  const conversationTitle =

    sanitizeConversationTitle(

      title ||

      existingConversation?.title ||

      "New conversation"

    );


  const conversationData = {

    session_id:
      activeSessionId,

    title:
      conversationTitle,

    updated_at:
      new Date()
        .toISOString()

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


  normalizeLocalConversations();


  saveLocalConversations();


  renderConversationList();


  return conversationData;

}


// ============================================================
// UPDATE CURRENT CONVERSATION TITLE
// ============================================================

function updateCurrentConversationTitle(
  text
) {

  const currentConversation =
    getCurrentConversation();


  if (

    currentConversation &&

    currentConversation.title !==
      "New conversation"

  ) {

    return currentConversation;

  }


  const generatedTitle =
    generateConversationTitle(
      text
    );


  return saveCurrentConversation(
    generatedTitle
  );

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


  normalizeLocalConversations();


  if (
    conversations.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.classList.add(
      "conversation-empty"
    );


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


      button.dataset.sessionId =
        conversation.session_id;


      if (

        conversation.session_id ===
        sessionId

      ) {

        button.classList.add(
          "active"
        );

      }


      const title =
        sanitizeConversationTitle(
          conversation.title
        );


      button.textContent =
        title;


      button.setAttribute(

        "aria-label",

        `Open conversation: ${title}`

      );


      button.addEventListener(

        "click",

        async function () {

          if (

            isSending ||

            conversation.session_id ===
              sessionId

          ) {

            return;

          }


          try {

            await switchConversation(

              conversation.session_id

            );

          } catch (error) {

            console.error(

              "Could not switch conversation:",

              error

            );


            showToast(

              "Habaye ikibazo mu gufungura conversation.",

              "error"

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
// CREATE CONVERSATION
// ============================================================

async function createConversation(
  title = "New conversation"
) {

  const cleanTitle =
    sanitizeConversationTitle(
      title
    );


  // ----------------------------------------------------------
  // BACKEND CONVERSATION
  // ----------------------------------------------------------

  if (
    authToken &&
    backendOnline
  ) {

    try {

      const data =
        await apiRequest(

          API_ENDPOINTS.conversations,

          {

            method:
              "POST",

            body:
              JSON.stringify({

                title:
                  cleanTitle

              })

          }

        );


      const backendConversation =

        data?.conversation ||

        data?.data?.conversation ||

        null;


      const backendSessionId =

        backendConversation?.session_id ||

        backendConversation?.sessionId ||

        null;


      if (backendSessionId) {

        saveSessionId(
          backendSessionId
        );


        const savedConversation =
          saveCurrentConversation(

            backendConversation?.title ||

            cleanTitle

          );


        return {

          success:
            true,

          conversation:
            savedConversation,

          source:
            "backend"

        };

      }

    } catch (error) {

      console.log(

        "Backend conversation unavailable. Using local conversation:",

        error.message

      );

    }

  }


  // ----------------------------------------------------------
  // LOCAL FALLBACK
  // ----------------------------------------------------------

  saveSessionId(
    createLocalSessionId()
  );


  const localConversation =
    saveCurrentConversation(
      cleanTitle
    );


  return {

    success:
      true,

    conversation:
      localConversation,

    source:
      "local"

  };

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

    `${API_ENDPOINTS.conversations}/${encodedSessionId}`

  );

}


// ============================================================
// NORMALIZE HISTORY MESSAGE
// ============================================================

function normalizeHistoryMessage(
  message
) {

  if (
    !message ||
    typeof message !==
      "object"
  ) {

    return null;

  }


  const content =

    message.content ??

    message.text ??

    message.message ??

    message.response ??

    "";


  if (

    content === null ||

    content === undefined

  ) {

    return null;

  }


  const role =

    String(

      message.role ||

      message.type ||

      "assistant"

    ).toLowerCase();


  return {

    role:

      role === "user"

        ? "user"

        : "ai",


    content:

      typeof content ===
      "string"

        ? content

        : safeJsonStringify(
            content,
            String(content)
          )

  };

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


    const historyMessages =

      data?.messages ||

      data?.conversation?.messages ||

      data?.data?.messages ||

      [];


    if (
      !Array.isArray(
        historyMessages
      )
    ) {

      return false;

    }


    messages.innerHTML =
      "";


    historyMessages.forEach(
      historyMessage => {

        const normalizedMessage =

          normalizeHistoryMessage(
            historyMessage
          );


        if (

          !normalizedMessage ||

          !normalizedMessage.content

        ) {

          return;

        }


        addMessage(

          normalizedMessage.content,

          normalizedMessage.role

        );

      }

    );


    updateWelcomeVisibility();


    scrollToBottom();


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
    !requestedSessionId
  ) {

    return false;

  }


  if (
    requestedSessionId ===
    sessionId
  ) {

    return true;

  }


  if (isSending) {

    showToast(

      "Tegereza task iri gukorwa ibanze irangire.",

      "warning"

    );


    return false;

  }


  saveSessionId(
    requestedSessionId
  );


  if (messages) {

    messages.innerHTML =
      "";

  }


  updateWelcomeVisibility();


  resetWorkflow();


  renderConversationList();


  setStatus(

    "Loading conversation...",

    "loading"

  );


  let loaded =
    false;


  if (
    authToken &&
    backendOnline
  ) {

    loaded =
      await displayConversationHistory();

  }


  if (!loaded) {

    updateWelcomeVisibility();

  }


  setStatus(

    loaded

      ? "Conversation loaded"

      : (

          backendOnline

            ? "Conversation nshya"

            : "Local conversation"

        ),

    backendOnline

      ? "online"

      : "normal"

  );


  closeMobileSidebar();


  if (userInput) {

    userInput.focus();

  }


  return true;

}


// ============================================================
// START NEW CONVERSATION
// ============================================================

async function startNewConversation() {

  if (isSending) {

    showToast(

      "Tegereza task iri gukorwa ibanze irangire.",

      "warning"

    );


    return null;

  }


  if (messages) {

    messages.innerHTML =
      "";

  }


  resetWorkflow();


  let result;


  try {

    result =
      await createConversation(
        "New conversation"
      );

  } catch (error) {

    console.error(

      "Could not create conversation:",

      error

    );


    saveSessionId(
      createLocalSessionId()
    );


    const conversation =
      saveCurrentConversation(
        "New conversation"
      );


    result = {

      success:
        true,

      conversation,

      source:
        "local"

    };

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


  return result;

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

    backendOnline

      ? "online"

      : "normal"

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
      Boolean(sending);

  }


  if (userInput) {

    userInput.disabled =
      Boolean(sending);

  }


  suggestionButtons.forEach(
    button => {

      button.disabled =
        Boolean(sending);

    }
  );

}


// ============================================================
// AUTO RESIZE INPUT
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
    MAX_INPUT_HEIGHT;


  userInput.style.height =

    Math.min(

      userInput.scrollHeight,

      maxHeight

    ) +

    "px";


  userInput.style.overflowY =

    userInput.scrollHeight >
    maxHeight

      ? "auto"

      : "hidden";

}
// ============================================================
// WORKFLOW MANAGEMENT
// ============================================================

function resetWorkflow() {

  workflowSteps.forEach(
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
// ACTIVATE WORKFLOW STEP
// ============================================================

function activateWorkflowStep(
  phase
) {

  workflowSteps.forEach(
    step => {

      const stepPhase =
        step.dataset.phase;


      if (
        stepPhase === phase
      ) {

        step.classList.add(
          "active"
        );


        step.classList.remove(
          "error"
        );

      } else {

        step.classList.remove(
          "active"
        );

      }

    }
  );

}


// ============================================================
// COMPLETE WORKFLOW STEP
// ============================================================

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
          "active",
          "error"
        );


        step.classList.add(
          "completed"
        );

      }

    }
  );

}


// ============================================================
// MARK WORKFLOW STEP AS ERROR
// ============================================================

function errorWorkflowStep(
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
          "error"
        );

      }

    }
  );

}


// ============================================================
// DELAY UTILITY
// ============================================================

function delay(
  milliseconds
) {

  return new Promise(
    resolve => {

      setTimeout(
        resolve,
        milliseconds
      );

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
    const phase of phases
  ) {

    if (!isSending) {

      return false;

    }


    activateWorkflowStep(
      phase
    );


    await delay(
      WORKFLOW_STEP_DELAY
    );


    if (!isSending) {

      return false;

    }


    completeWorkflowStep(
      phase
    );

  }


  return true;

}


// ============================================================
// GET AI RESPONSE
// ============================================================

function extractAIResponse(
  data
) {

  if (!data) {

    return null;

  }


  const possibleResponse =

    data.response ??

    data.reply ??

    data.result ??

    data.answer ??

    data.output ??

    data.message?.content ??

    data.data?.response ??

    data.data?.reply ??

    data.data?.result ??

    data.data?.message?.content ??

    data.message;


  if (

    possibleResponse ===
    undefined ||

    possibleResponse ===
    null

  ) {

    return null;

  }


  if (
    typeof possibleResponse ===
    "string"
  ) {

    return possibleResponse;

  }


  return safeJsonStringify(
    possibleResponse,
    "Ntabwo habonetse igisubizo cya AI."
  );

}


// ============================================================
// GET RESPONSE SESSION ID
// ============================================================

function extractSessionId(
  data
) {

  if (!data) {

    return null;

  }


  return (

    data.conversation?.session_id ||

    data.conversation?.sessionId ||

    data.session_id ||

    data.sessionId ||

    data.data?.conversation?.session_id ||

    data.data?.conversation?.sessionId ||

    null

  );

}


// ============================================================
// GET ERROR MESSAGE
// ============================================================

function getFriendlyErrorMessage(
  error
) {

  const originalMessage =

    String(

      error?.message ||

      "Habaye ikibazo."

    );


  const lowerError =
    originalMessage.toLowerCase();


  // ----------------------------------------------------------
  // NETWORK
  // ----------------------------------------------------------

  if (

    lowerError.includes(
      "failed to fetch"
    ) ||

    lowerError.includes(
      "networkerror"
    ) ||

    lowerError.includes(
      "network request failed"
    )

  ) {

    return (

      "Ntibyashoboye kugera kuri server. " +

      "Reba internet cyangwa utegereze server ibe imaze kubyuka."

    );

  }


  // ----------------------------------------------------------
  // TIMEOUT
  // ----------------------------------------------------------

  if (

    lowerError.includes(
      "abort"
    ) ||

    lowerError.includes(
      "timeout"
    )

  ) {

    return (

      "Server yafashe igihe kinini cyane mu gusubiza. " +

      "Tegereza gato wongere ugerageze."

    );

  }


  // ----------------------------------------------------------
  // UNAUTHORIZED
  // ----------------------------------------------------------

  if (

    lowerError.includes(
      "unauthorized"
    ) ||

    lowerError.includes(
      "authentication"
    )

  ) {

    return (

      "Session yawe yarangiye cyangwa hari ikibazo cya authentication."

    );

  }


  // ----------------------------------------------------------
  // SERVER ERROR
  // ----------------------------------------------------------

  if (

    lowerError.includes(
      "internal server error"
    )

  ) {

    return (

      "Hari ikibazo imbere muri server. " +

      "Turakeneye kugenzura backend."

    );

  }


  return originalMessage;

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


  // ----------------------------------------------------------
  // VALIDATE INPUT
  // ----------------------------------------------------------

  if (!userInput) {

    console.error(
      "Input element not found."
    );


    return;

  }


  const text =
    userInput.value
      .trim();


  if (!text) {

    userInput.focus();


    return;

  }


  // ----------------------------------------------------------
  // START REQUEST
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
  // UPDATE TITLE
  // ----------------------------------------------------------

  updateCurrentConversationTitle(
    text
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

    "Nkwasibwe IRHCF iri gusesengura task...",

    "loading"

  );


  // ----------------------------------------------------------
  // START WORKFLOW
  // ----------------------------------------------------------

  const workflowPromise =
    runWorkflowAnimation();


  // ----------------------------------------------------------
  // SHOW TYPING
  // ----------------------------------------------------------

  const typingIndicator =
    addTypingIndicator();


  try {

    // --------------------------------------------------------
    // SEND TO BACKEND
    // --------------------------------------------------------

    const data =
      await apiRequest(

        API_ENDPOINTS.chat,

        {

          method:
            "POST",

          body:
            JSON.stringify({

              message:
                text,

              sessionId:
                activeSessionId,

              session_id:
                activeSessionId

            })

        }

      );


    // --------------------------------------------------------
    // UPDATE BACKEND STATE
    // --------------------------------------------------------

    backendOnline =
      true;


    // --------------------------------------------------------
    // UPDATE SESSION
    // --------------------------------------------------------

    const returnedSessionId =
      extractSessionId(
        data
      );


    if (returnedSessionId) {

      saveSessionId(
        returnedSessionId
      );

    }


    // --------------------------------------------------------
    // GET RESPONSE
    // --------------------------------------------------------

    const aiResponse =
      extractAIResponse(
        data
      );


    // --------------------------------------------------------
    // WAIT FOR WORKFLOW
    // --------------------------------------------------------

    await workflowPromise;


    // --------------------------------------------------------
    // REMOVE TYPING
    // --------------------------------------------------------

    removeTypingIndicator(
      typingIndicator
    );


    // --------------------------------------------------------
    // VALIDATE RESPONSE
    // --------------------------------------------------------

    if (!aiResponse) {

      throw new Error(

        "Server ntiyasubije igisubizo cya AI."

      );

    }


    // --------------------------------------------------------
    // DISPLAY AI RESPONSE
    // --------------------------------------------------------

    addMessage(

      aiResponse,

      "ai"

    );


    // --------------------------------------------------------
    // SAVE CONVERSATION
    // --------------------------------------------------------

    saveCurrentConversation();


    // --------------------------------------------------------
    // SUCCESS STATUS
    // --------------------------------------------------------

    setStatus(

      "AI Agent Ready",

      "online"

    );

  } catch (error) {

    console.error(

      "Chat error:",

      error

    );


    // --------------------------------------------------------
    // STOP VISUAL WORKFLOW
    // --------------------------------------------------------

    errorWorkflowStep(
      "execute"
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

    const errorMessage =
      getFriendlyErrorMessage(
        error
      );


    // --------------------------------------------------------
    // DISPLAY ERROR
    // --------------------------------------------------------

    addSystemMessage(

      `Habaye ikibazo: ${errorMessage}`

    );


    // --------------------------------------------------------
    // UPDATE STATUS
    // --------------------------------------------------------

    backendOnline =
      false;


    setStatus(

      "Hari ikibazo cya connection",

      "error"

    );


    showToast(

      errorMessage,

      "error"

    );

  } finally {

    // --------------------------------------------------------
    // FINISH REQUEST
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
// SEND SUGGESTION
// ============================================================

function sendSuggestion(
  prompt
) {

  if (

    !prompt ||

    !userInput ||

    isSending

  ) {

    return;

  }


  userInput.value =
    String(prompt);


  autoResizeInput();


  userInput.focus();


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


// ============================================================
// CLOSE MOBILE SIDEBAR
// ============================================================

function closeMobileSidebar() {

  if (!sidebar) {

    return;

  }


  sidebar.classList.remove(
    "open"
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
    "open"
  );

}


// ============================================================
// CLICK OUTSIDE MOBILE SIDEBAR
// ============================================================

document.addEventListener(

  "click",

  function (
    event
  ) {

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
// HANDLE ESCAPE KEY
// ============================================================

document.addEventListener(

  "keydown",

  function (
    event
  ) {

    if (
      event.key === "Escape"
    ) {

      closeMobileSidebar();

    }

  }

);


// ============================================================
// SEND BUTTON EVENT
// ============================================================

if (sendButton) {

  sendButton.addEventListener(

    "click",

    sendMessage

  );

}


// ============================================================
// TEXTAREA EVENTS
// ============================================================

if (userInput) {

  // ----------------------------------------------------------
  // AUTO RESIZE
  // ----------------------------------------------------------

  userInput.addEventListener(

    "input",

    autoResizeInput

  );


  // ----------------------------------------------------------
  // ENTER TO SEND
  // SHIFT + ENTER FOR NEW LINE
  // ----------------------------------------------------------

  userInput.addEventListener(

    "keydown",

    function (
      event
    ) {

      if (

        event.key ===
          "Enter" &&

        !event.shiftKey &&

        !event.isComposing

      ) {

        event.preventDefault();


        sendMessage();

      }

    }

  );

}


// ============================================================
// NEW CONVERSATION BUTTON
// ============================================================

if (newChatButton) {

  newChatButton.addEventListener(

    "click",

    startNewConversation

  );

}


// ============================================================
// HEADER NEW CHAT BUTTON
// ============================================================

if (headerNewChatButton) {

  headerNewChatButton.addEventListener(

    "click",

    startNewConversation

  );

}


// ============================================================
// CLEAR CHAT BUTTON
// ============================================================

if (clearChatButton) {

  clearChatButton.addEventListener(

    "click",

    clearConversation

  );

}


// ============================================================
// MOBILE MENU BUTTON
// ============================================================

if (mobileMenuButton) {

  mobileMenuButton.addEventListener(

    "click",

    function (
      event
    ) {

      event.stopPropagation();


      toggleMobileSidebar();

    }

  );

}


// ============================================================
// SUGGESTION BUTTONS
// ============================================================

suggestionButtons.forEach(
  button => {

    button.addEventListener(

      "click",

      function () {

        const prompt =
          button.dataset.prompt;


        if (prompt) {

          sendSuggestion(
            prompt
          );

        }

      }

    );

  }

);


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener(

  "keydown",

  function (
    event
  ) {

    // --------------------------------------------------------
    // CTRL + K
    // FOCUS INPUT
    // --------------------------------------------------------

    if (

      (

        event.ctrlKey ||

        event.metaKey

      ) &&

      event.key
        .toLowerCase() ===
        "k"

    ) {

      event.preventDefault();


      if (userInput) {

        userInput.focus();

      }

    }


    // --------------------------------------------------------
    // CTRL + /
    // FOCUS INPUT
    // --------------------------------------------------------

    if (

      (

        event.ctrlKey ||

        event.metaKey

      ) &&

      event.key ===
        "/"

    ) {

      event.preventDefault();


      if (userInput) {

        userInput.focus();

      }

    }

  }

);


// ============================================================
// HANDLE ONLINE EVENT
// ============================================================

window.addEventListener(

  "online",

  async function () {

    setStatus(

      "Internet yagarutse. Kugenzura server...",

      "loading"

    );


    await checkBackendHealth();

  }

);


// ============================================================
// HANDLE OFFLINE EVENT
// ============================================================

window.addEventListener(

  "offline",

  function () {

    backendOnline =
      false;


    setStatus(

      "Internet ntabwo iriho.",

      "error"

    );

  }

);


// ============================================================
// PAGE VISIBILITY
// ============================================================

document.addEventListener(

  "visibilitychange",

  function () {

    if (

      document.visibilityState ===
      "visible"

    ) {

      if (
        !isSending
      ) {

        checkBackendHealth();

      }

    }

  }

);


// ============================================================
// INITIALIZE APPLICATION
// ============================================================

async function initializeApp() {

  console.log(

    `Initializing Nkwasibwe IRHCF ${APP_VERSION}...`

  );


  try {

    // --------------------------------------------------------
    
// SAVE VERSION
    // --------------------------------------------------------

    saveAppVersion();


    // --------------------------------------------------------
    // LOAD LOCAL USER
    // --------------------------------------------------------

    loadSavedUser();


    // --------------------------------------------------------
    // LOAD LOCAL CONVERSATIONS
    // --------------------------------------------------------

    loadLocalConversations();


    normalizeLocalConversations();


    // --------------------------------------------------------
    // ENSURE SESSION
    // --------------------------------------------------------

    ensureSessionId();


    // --------------------------------------------------------
    // ENSURE CURRENT CONVERSATION
    // --------------------------------------------------------

    const currentConversation =
      getCurrentConversation();


    if (!currentConversation) {

      saveCurrentConversation(
        "New conversation"
      );

    }


    // --------------------------------------------------------
    // RENDER CONVERSATIONS
    // --------------------------------------------------------

    renderConversationList();


    // --------------------------------------------------------
    // INITIAL UI
    // --------------------------------------------------------

    updateWelcomeVisibility();


    resetWorkflow();


    autoResizeInput();


    // --------------------------------------------------------
    // START HEALTH CHECK
    // --------------------------------------------------------

    await checkBackendHealth();


    // --------------------------------------------------------
    // LOAD AUTHENTICATED USER
    // --------------------------------------------------------

    if (authToken) {

      await getCurrentUser();

    }


    // --------------------------------------------------------
    // LOAD SERVER CONVERSATION
    // --------------------------------------------------------

    if (

      authToken &&

      currentUser &&

      sessionId &&

      backendOnline

    ) {

      await displayConversationHistory();

    }


    // --------------------------------------------------------
    // FOCUS INPUT
    // --------------------------------------------------------

    if (userInput) {

      userInput.focus();

    }


    console.log(

      "Nkwasibwe IRHCF initialized successfully."

    );


    setStatus(

      backendOnline

        ? "AI Agent Ready"

        : "Application Ready",

      backendOnline

        ? "online"

        : "normal"

    );

  } catch (error) {

    console.error(

      "Initialization error:",

      error

    );


    setStatus(

      "Application yatangiye ariko hari service zimwe zitaraboneka.",

      "error"

    );

  }

}


// ============================================================
// START APPLICATION
// ============================================================

if (

  document.readyState ===
  "loading"

) {

  document.addEventListener(

    "DOMContentLoaded",

    initializeApp,

    {

      once:
        true

    }

  );

} else {

  initializeApp();

}


// ============================================================
// PUBLIC APPLICATION API
// ============================================================

window.NkwasibweIRHCF = {

  // ----------------------------------------------------------
  // APPLICATION
  // ----------------------------------------------------------

  version:
    APP_VERSION,


  initialize:
    initializeApp,


  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  login,

  register,

  logout,

  getCurrentUser,


  // ----------------------------------------------------------
  // CONVERSATIONS
  // ----------------------------------------------------------

  createConversation,

  startNewConversation,

  switchConversation,

  loadConversation,

  clearConversation,

  saveCurrentConversation,

  getCurrentConversation,


  // ----------------------------------------------------------
  // CHAT
  // ----------------------------------------------------------

  sendMessage,

  sendSuggestion,


  // ----------------------------------------------------------
  // CONNECTION
  // ----------------------------------------------------------

  checkBackendHealth,

  apiRequest,


  // ----------------------------------------------------------
  // WORKFLOW
  // ----------------------------------------------------------

  resetWorkflow,

  activateWorkflowStep,

  completeWorkflowStep,

  errorWorkflowStep,

  runWorkflowAnimation,


  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  getState: function () {

    return {

      sessionId,

      currentUser,

      isSending,

      backendOnline,

      conversationCount:
        conversations.length

    };

  }


};


// ============================================================
// END OF NKWASIBWE IRHCF FRONTEND APPLICATION
// ============================================================
    
    
