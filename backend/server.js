// ============================================================
// NKWASIBWE IRHCF
// CORE SERVER FOUNDATION
// PART 1 / FINAL ARCHITECTURE
// ============================================================

"use strict";

// ============================================================
// CORE DEPENDENCIES
// ============================================================

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// ============================================================
// INTERNAL MODULES
// ============================================================

const config = require("./config");
const pool = require("./db/pool");
const createSchema = require("./db/schema");

// ============================================================
// APPLICATION IDENTITY
// ============================================================

const APP_NAME = "Nkwasibwe IRHCF";

const APP_VERSION = "2.0.0";

const APP_DESCRIPTION =
  "Autonomous AI Agent Platform";

const NODE_ENV =
  String(
    config.environment ||
      process.env.NODE_ENV ||
      "development"
  ).trim();

const PORT =
  Number(config.port) || 3000;

// ============================================================
// SECURITY CONFIGURATION
// ============================================================

const JWT_SECRET =
  config.jwtSecret ||
  process.env.JWT_SECRET ||
  "";

const JWT_EXPIRES_IN =
  config.jwtExpiresIn ||
  process.env.JWT_EXPIRES_IN ||
  "7d";

// ============================================================
// AI CONFIGURATION
// ============================================================

const OPENAI_API_KEY =
  config.openaiApiKey ||
  process.env.OPENAI_API_KEY ||
  "";

const OPENAI_MODEL =
  config.openaiModel ||
  process.env.OPENAI_MODEL ||
  "gpt-4o-mini";

// ============================================================
// DATABASE CONFIGURATION
// ============================================================

const DATABASE_URL =
  config.databaseUrl ||
  process.env.DATABASE_URL ||
  "";

// ============================================================
// LIMITS
// ============================================================

const LIMITS = Object.freeze({

  requestBodyBytes:
    10 * 1024 * 1024,

  maxMessageLength:
    100000,

  maxMemoryLength:
    50000,

  maxKnowledgeLength:
    500000,

  maxTaskLength:
    100000,

  maxConversationHistory:
    50,

  maxMemoryItems:
    50,

  maxLongTermMemoryItems:
    50,

  maxKnowledgeItems:
    25,

  maxTools:
    100,

  maxCapabilities:
    100,

  maxAgentSteps:
    50

});

// ============================================================
// APPLICATION
// ============================================================

const app = express();

app.disable("x-powered-by");

// ============================================================
// BASIC CONFIGURATION VALIDATION
// ============================================================

if (!DATABASE_URL) {

  console.error(
    "[CONFIG ERROR] DATABASE_URL is missing."
  );

}

if (!JWT_SECRET) {

  console.error(
    "[CONFIG ERROR] JWT_SECRET is missing."
  );

}

if (!OPENAI_API_KEY) {

  console.warn(
    "[CONFIG WARNING] OPENAI_API_KEY is missing."
  );

}

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Session-ID"
    ]
  })
);

// ============================================================
// JSON BODY PARSER
// ============================================================

app.use(
  express.json({
    limit:
      LIMITS.requestBodyBytes
  })
);

// ============================================================
// REQUEST ID
// ============================================================

app.use(
  (req, res, next) => {

    const incomingId =
      typeof req.headers[
        "x-request-id"
      ] === "string"
        ? req.headers[
            "x-request-id"
          ].trim()
        : "";

    const requestId =
      incomingId ||
      crypto.randomUUID();

    req.requestId =
      requestId;

    res.setHeader(
      "X-Request-ID",
      requestId
    );

    next();

  }
);

// ============================================================
// REQUEST TIMING
// ============================================================

app.use(
  (req, res, next) => {

    req.startedAt =
      Date.now();

    res.on(
      "finish",
      () => {

        const duration =
          Date.now() -
          req.startedAt;

        console.log(
          `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [${req.requestId}]`
        );

      }
    );

    next();

  }
);

// ============================================================
// OPENAI PROVIDER
//
// IMPORTANT:
// OpenAI is ONLY ONE PROVIDER.
// Nkwasibwe itself must not depend entirely on it.
// ============================================================

const openai =
  OPENAI_API_KEY
    ? new OpenAI({
        apiKey:
          OPENAI_API_KEY
      })
    : null;

// ============================================================
// PROVIDER STATE
// ============================================================

const providerState = {

  openai: {
    configured:
      Boolean(openai),

    available:
      Boolean(openai),

    failures:
      0,

    successes:
      0,

    lastError:
      null,

    lastSuccess:
      null
  },

  local: {
    configured:
      true,

    available:
      true,

    failures:
      0,

    successes:
      0,

    lastError:
      null,

    lastSuccess:
      null
  }

};

// ============================================================
// APPLICATION RUNTIME STATE
// ============================================================

const runtimeState = {

  startedAt:
    new Date(),

  requests:
    0,

  successfulRequests:
    0,

  failedRequests:
    0,

  activeRequests:
    0,

  lastError:
    null

};

// ============================================================
// FREEZE STATIC CONFIGURATION
// ============================================================

const APP_CONFIG =
  Object.freeze({

    name:
      APP_NAME,

    version:
      APP_VERSION,

    description:
      APP_DESCRIPTION,

    environment:
      NODE_ENV,

    port:
      PORT,

    jwtConfigured:
      Boolean(JWT_SECRET),

    openaiConfigured:
      Boolean(OPENAI_API_KEY),

    openaiModel:
      OPENAI_MODEL,

    limits:
      LIMITS

  });

// ============================================================
// STARTUP CONFIGURATION LOG
// ============================================================

console.log(
  "=============================================="
);

console.log(
  `${APP_NAME} v${APP_VERSION}`
);

console.log(
  APP_DESCRIPTION
);

console.log(
  "=============================================="
);

console.log(
  `[CONFIG] Environment: ${NODE_ENV}`
);

console.log(
  `[CONFIG] Port: ${PORT}`
);

console.log(
  `[CONFIG] Database: ${
    DATABASE_URL
      ? "Configured"
      : "Missing"
  }`
);

console.log(
  `[CONFIG] JWT: ${
    JWT_SECRET
      ? "Configured"
      : "Missing"
  }`
);

console.log(
  `[CONFIG] OpenAI: ${
    OPENAI_API_KEY
      ? "Configured"
      : "Unavailable"
  }`
);

console.log(
  `[CONFIG] Local intelligence: Available`
);

console.log(
  "=============================================="
);
// ============================================================
// NKWASIBWE IRHCF
// PART 2 — SECURITY, REQUEST CONTEXT & CORE ENGINE
// ============================================================


// ============================================================
// SECURITY CONSTANTS
// ============================================================

const SECURITY = Object.freeze({

  MAX_BODY_SIZE:
    10 * 1024 * 1024,

  MAX_TEXT_LENGTH:
    100000,

  MAX_MESSAGE_LENGTH:
    50000,

  MAX_METADATA_KEYS:
    100,

  MAX_ARRAY_LENGTH:
    1000,

  MAX_JSON_DEPTH:
    12,

  MAX_REQUESTS_PER_WINDOW:
    120,

  RATE_WINDOW_MS:
    60 * 1000,

  AUTH_RATE_LIMIT:
    20,

  CHAT_RATE_LIMIT:
    30,

  MEMORY_RATE_LIMIT:
    100,

  REQUEST_TIMEOUT_MS:
    120000,

  MAX_ERROR_MESSAGE_LENGTH:
    1000

});


// ============================================================
// INTERNAL SECURITY STATE
// ============================================================

const securityState = {

  requestCounts:
    new Map(),

  blockedIPs:
    new Map(),

  suspiciousRequests:
    new Map(),

  activeRequests:
    new Map(),

  failedAuthAttempts:
    new Map(),

  lastCleanup:
    Date.now()

};


// ============================================================
// SAFE STRING
// ============================================================

function safeString(
  value,
  maxLength =
    SECURITY.MAX_TEXT_LENGTH
) {

  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(
      0,
      maxLength
    );

}


// ============================================================
// SAFE INTEGER
// ============================================================

function safeInteger(
  value,
  fallback = 0,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
) {

  const number =
    Number(value);

  if (
    !Number.isSafeInteger(
      number
    )
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      number
    )
  );

}


// ============================================================
// SAFE BOOLEAN
// ============================================================

function safeBoolean(
  value,
  fallback = false
) {

  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    value === "true" ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  if (
    value === "false" ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  return fallback;

}


// ============================================================
// SAFE JSON PARSE
// ============================================================

function safeJsonParse(
  value,
  fallback = null
) {

  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  try {

    return JSON.parse(
      value
    );

  } catch {

    return fallback;

  }

}


// ============================================================
// SAFE JSON STRINGIFY
// ============================================================

function safeJsonStringify(
  value,
  fallback = "{}"
) {

  try {

    const result =
      JSON.stringify(
        value
      );

    return typeof result ===
      "string"
      ? result
      : fallback;

  } catch {

    return fallback;

  }

}


// ============================================================
// OBJECT CHECK
// ============================================================

function isPlainObject(
  value
) {

  return (
    value !== null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );

}


// ============================================================
// OBJECT DEPTH
// ============================================================

function getObjectDepth(
  value,
  currentDepth = 0
) {

  if (
    value === null ||
    typeof value !==
      "object"
  ) {
    return currentDepth;
  }

  if (
    currentDepth >=
    SECURITY.MAX_JSON_DEPTH
  ) {
    return currentDepth;
  }

  if (
    Array.isArray(value)
  ) {

    let depth =
      currentDepth;

    for (
      const item of value
    ) {

      depth =
        Math.max(
          depth,
          getObjectDepth(
            item,
            currentDepth + 1
          )
        );

    }

    return depth;

  }

  let depth =
    currentDepth;

  for (
    const key of Object.keys(
      value
    )
  ) {

    depth =
      Math.max(
        depth,
        getObjectDepth(
          value[key],
          currentDepth + 1
        )
      );

  }

  return depth;

}


// ============================================================
// SANITIZE JSON VALUE
// ============================================================

function sanitizeJsonValue(
  value,
  depth = 0
) {

  if (
    depth >
    SECURITY.MAX_JSON_DEPTH
  ) {
    return null;
  }


  if (
    value === null ||
    typeof value ===
      "string" ||
    typeof value ===
      "boolean"
  ) {

    if (
      typeof value ===
      "string"
    ) {

      return safeString(
        value
      );

    }

    return value;

  }


  if (
    typeof value ===
    "number"
  ) {

    return Number.isFinite(
      value
    )
      ? value
      : null;

  }


  if (
    Array.isArray(value)
  ) {

    return value
      .slice(
        0,
        SECURITY.MAX_ARRAY_LENGTH
      )
      .map(
        item =>
          sanitizeJsonValue(
            item,
            depth + 1
          )
      );

  }


  if (
    isPlainObject(value)
  ) {

    const result = {};

    const keys =
      Object.keys(
        value
      ).slice(
        0,
        SECURITY.MAX_METADATA_KEYS
      );

    for (
      const key of keys
    ) {

      const cleanKey =
        safeString(
          key,
          200
        );

      if (!cleanKey) {
        continue;
      }

      result[cleanKey] =
        sanitizeJsonValue(
          value[key],
          depth + 1
        );

    }

    return result;

  }

  return null;

}


// ============================================================
// SAFE METADATA
// ============================================================

function secureMetadata(
  value
) {

  if (
    !isPlainObject(
      value
    )
  ) {
    return {};
  }

  return sanitizeJsonValue(
    value
  );

}


// ============================================================
// REQUEST ID
// ============================================================

function createRequestId() {

  if (
    typeof crypto?.randomUUID ===
    "function"
  ) {

    return crypto.randomUUID();

  }

  return crypto
    .randomBytes(24)
    .toString("hex");

}


// ============================================================
// CLIENT IP
// ============================================================

function getClientIP(
  req
) {

  const forwarded =
    req.headers[
      "x-forwarded-for"
    ];

  if (
    typeof forwarded ===
      "string" &&
    forwarded.length > 0
  ) {

    return forwarded
      .split(",")[0]
      .trim();

  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );

}


// ============================================================
// REQUEST CONTEXT MIDDLEWARE
// ============================================================

app.use(
  (req, res, next) => {

    const requestId =
      createRequestId();

    const startedAt =
      Date.now();

    const clientIP =
      getClientIP(
        req
      );

    req.requestId =
      requestId;

    req.startedAt =
      startedAt;

    req.clientIP =
      clientIP;


    res.setHeader(
      "X-Request-ID",
      requestId
    );


    securityState
      .activeRequests
      .set(
        requestId,
        {
          requestId,
          startedAt,
          clientIP,
          method:
            req.method,
          path:
            req.path
        }
      );


    res.on(
      "finish",
      () => {

        securityState
          .activeRequests
          .delete(
            requestId
          );

      }
    );


    next();

  }
);


// ============================================================
// SECURITY HEADERS
// ============================================================

app.use(
  (req, res, next) => {

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "X-Frame-Options",
      "DENY"
    );

    res.setHeader(
      "Referrer-Policy",
      "no-referrer"
    );

    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    next();

  }
);


// ============================================================
// REQUEST TIMEOUT
// ============================================================

app.use(
  (req, res, next) => {

    req.setTimeout(
      SECURITY.REQUEST_TIMEOUT_MS
    );

    res.setTimeout(
      SECURITY.REQUEST_TIMEOUT_MS
    );

    next();

  }
);


// ============================================================
// RATE LIMIT KEY
// ============================================================

function getRateLimitKey(
  req,
  namespace = "global"
) {

  const userId =
    req.user?.id ||
    "anonymous";

  const ip =
    req.clientIP ||
    getClientIP(
      req
    );

  return `${namespace}:${userId}:${ip}`;

}


// ============================================================
// RATE LIMIT CHECK
// ============================================================

function checkRateLimit(
  req,
  namespace = "global",
  limit =
    SECURITY.MAX_REQUESTS_PER_WINDOW
) {

  const now =
    Date.now();

  const key =
    getRateLimitKey(
      req,
      namespace
    );

  const current =
    securityState
      .requestCounts
      .get(key);


  if (
    !current ||
    now - current.startedAt >
      SECURITY.RATE_WINDOW_MS
  ) {

    securityState
      .requestCounts
      .set(
        key,
        {
          startedAt:
            now,
          count:
            1
        }
      );

    return {
      allowed: true,
      remaining:
        Math.max(
          0,
          limit - 1
        )
    };

  }


  current.count += 1;


  if (
    current.count >
    limit
  ) {

    return {
      allowed: false,
      remaining: 0,
      retryAfter:
        Math.ceil(
          (
            SECURITY.RATE_WINDOW_MS -
            (
              now -
              current.startedAt
            )
          ) / 1000
        )
    };

  }


  return {
    allowed: true,
    remaining:
      Math.max(
        0,
        limit -
          current.count
      )
  };

}


// ============================================================
// GLOBAL RATE LIMIT
// ============================================================

app.use(
  (req, res, next) => {

    const result =
      checkRateLimit(
        req,
        "global"
      );


    if (
      !result.allowed
    ) {

      res.setHeader(
        "Retry-After",
        String(
          result.retryAfter ||
          60
        )
      );

      return res
        .status(429)
        .json({
          success: false,
          error:
            "Too many requests. Please try again later.",
          code:
            "RATE_LIMITED",
          requestId:
            req.requestId
        });

    }


    res.setHeader(
      "X-RateLimit-Remaining",
      String(
        result.remaining
      )
    );


    next();

  }
);


// ============================================================
// AUTHENTICATION RATE LIMIT
// ============================================================

function authenticationRateLimit(
  req,
  res,
  next
) {

  const result =
    checkRateLimit(
      req,
      "authentication",
      SECURITY.AUTH_RATE_LIMIT
    );


  if (
    !result.allowed
  ) {

    return res
      .status(429)
      .json({
        success: false,
        error:
          "Too many authentication attempts. Please try again later.",
        code:
          "AUTH_RATE_LIMITED",
        requestId:
          req.requestId
      });

  }


  next();

}


// ============================================================
// CHAT RATE LIMIT
// ============================================================

function chatRateLimit(
  req,
  res,
  next
) {

  const result =
    checkRateLimit(
      req,
      "chat",
      SECURITY.CHAT_RATE_LIMIT
    );


  if (
    !result.allowed
  ) {

    return res
      .status(429)
      .json({
        success: false,
        error:
          "Too many chat requests. Please wait before sending another message.",
        code:
          "CHAT_RATE_LIMITED",
        requestId:
          req.requestId
      });

  }


  next();

}


// ============================================================
// MEMORY RATE LIMIT
// ============================================================

function memoryRateLimit(
  req,
  res,
  next
) {

  const result =
    checkRateLimit(
      req,
      "memory",
      SECURITY.MEMORY_RATE_LIMIT
    );


  if (
    !result.allowed
  ) {

    return res
      .status(429)
      .json({
        success: false,
        error:
          "Too many memory operations.",
        code:
          "MEMORY_RATE_LIMITED",
        requestId:
          req.requestId
      });

  }


  next();

}


// ============================================================
// AUTHENTICATION FAILURE TRACKING
// ============================================================

function recordFailedAuthentication(
  req
) {

  const key =
    req.clientIP ||
    "unknown";

  const existing =
    securityState
      .failedAuthAttempts
      .get(key);


  if (!existing) {

    securityState
      .failedAuthAttempts
      .set(
        key,
        {
          count: 1,
          lastAttempt:
            Date.now()
        }
      );

    return;

  }


  existing.count += 1;

  existing.lastAttempt =
    Date.now();

}


// ============================================================
// SECURITY EVENT
// ============================================================

async function securityEvent(
  level,
  event,
  req,
  metadata = {}
) {

  const payload = {

    requestId:
      req?.requestId ||
      null,

    ip:
      req?.clientIP ||
      null,

    userId:
      req?.user?.id ||
      null,

    method:
      req?.method ||
      null,

    path:
      req?.path ||
      null,

    ...secureMetadata(
      metadata
    )

  };


  console.warn(
    `[SECURITY:${String(
      level
    ).toUpperCase()}] ${event}`,
    payload
  );


  if (
    typeof systemLog ===
    "function"
  ) {

    await systemLog(
      level,
      "security",
      event,
      payload
    );

  }

}


// ============================================================
// VALIDATE REQUEST BODY
// ============================================================

function validateRequestBody(
  req,
  res,
  next
) {

  if (
    req.body === undefined ||
    req.body === null
  ) {

    req.body = {};

  }


  if (
    !isPlainObject(
      req.body
    )
  ) {

    return res
      .status(400)
      .json({
        success: false,
        error:
          "Request body must be a JSON object.",
        code:
          "INVALID_REQUEST_BODY",
        requestId:
          req.requestId
      });

  }


  const depth =
    getObjectDepth(
      req.body
    );


  if (
    depth >
    SECURITY.MAX_JSON_DEPTH
  ) {

    return res
      .status(400)
      .json({
        success: false,
        error:
          "Request data is too deeply nested.",
        code:
          "REQUEST_TOO_DEEP",
        requestId:
          req.requestId
      });

  }


  next();

}


app.use(
  validateRequestBody
);


// ============================================================
// REQUEST LOGGER
// ============================================================

app.use(
  (req, res, next) => {

    const startedAt =
      Date.now();


    res.on(
      "finish",
      () => {

        const duration =
          Date.now() -
          startedAt;


        console.log(
          JSON.stringify({
            type:
              "http_request",

            requestId:
              req.requestId,

            method:
              req.method,

            path:
              req.path,

            status:
              res.statusCode,

            durationMs:
              duration,

            ip:
              req.clientIP,

            userId:
              req.user?.id ||
              null,

            timestamp:
              new Date()
                .toISOString()
          })
        );

      }
    );


    next();

  }
);


// ============================================================
// ERROR RESPONSE BUILDER
// ============================================================

function sendError(
  res,
  status,
  message,
  code,
  requestId = null
) {

  const safeMessage =
    safeString(
      message,
      SECURITY.MAX_ERROR_MESSAGE_LENGTH
    );


  return res
    .status(
      status
    )
    .json({

      success: false,

      error:
        safeMessage ||
        "An unexpected error occurred.",

      code:
        code ||
        "INTERNAL_ERROR",

      requestId

    });

}


// ============================================================
// ASYNC ROUTE WRAPPER
// ============================================================

function asyncHandler(
  handler
) {

  return function wrappedHandler(
    req,
    res,
    next
  ) {

    Promise
      .resolve(
        handler(
          req,
          res,
          next
        )
      )
      .catch(
        next
      );

  };

}


// ============================================================
// PROCESS CLEANUP
// ============================================================

function cleanupSecurityState() {

  const now =
    Date.now();


  if (
    now -
      securityState.lastCleanup <
    5 * 60 * 1000
  ) {

    return;

  }


  securityState.lastCleanup =
    now;


  const expiration =
    SECURITY.RATE_WINDOW_MS *
    2;


  for (
    const [
      key,
      value
    ] of securityState
      .requestCounts
  ) {

    if (
      now -
        value.startedAt >
      expiration
    ) {

      securityState
        .requestCounts
        .delete(
          key
        );

    }

  }


  for (
    const [
      key,
      value
    ] of securityState
      .failedAuthAttempts
  ) {

    if (
      now -
        value.lastAttempt >
      15 * 60 * 1000
    ) {

      securityState
        .failedAuthAttempts
        .delete(
          key
        );

    }

  }

}


setInterval(
  cleanupSecurityState,
  5 * 60 * 1000
).unref();


// ============================================================
// UNHANDLED REQUEST ERROR
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "Unhandled request error:",
      {
        requestId:
          req.requestId,
        message:
          error?.message,
        stack:
          error?.stack
      }
    );


    if (
      res.headersSent
    ) {

      return next(
        error
      );

    }


    return sendError(
      res,
      500,
      "An internal server error occurred.",
      "INTERNAL_SERVER_ERROR",
      req.requestId
    );

  }
);


// ============================================================
// END PART 2
// ============================================================

// ============================================================
// PART 3/14
// NKWSIBWE IRHCF — AUTHENTICATION & IDENTITY ENGINE
// ============================================================
//
// Responsibilities:
//
// • User registration
// • Secure password hashing
// • Login
// • JWT creation
// • JWT verification
// • Current-user resolution
// • Authentication middleware
// • Account isolation
// • Authentication diagnostics
// • Security logging
//
// IMPORTANT:
// This section depends on the foundation/helpers from Part 1
// and Part 2.
// ============================================================


// ============================================================
// AUTH CONFIGURATION
// ============================================================

const AUTH_CONFIG = Object.freeze({

  TOKEN_EXPIRES_IN:
    config.jwtExpiresIn ||
    "7d",

  BCRYPT_ROUNDS:
    Number(config.bcryptRounds) >= 10
      ? Number(config.bcryptRounds)
      : 12,

  MAX_NAME_LENGTH:
    100,

  MAX_EMAIL_LENGTH:
    255,

  MIN_PASSWORD_LENGTH:
    8,

  MAX_PASSWORD_LENGTH:
    256

});


// ============================================================
// EMAIL NORMALIZATION
// ============================================================

function normalizeEmail(value) {

  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toLowerCase();

}


// ============================================================
// EMAIL VALIDATION
// ============================================================

function isValidEmail(email) {

  if (
    typeof email !==
    "string"
  ) {
    return false;
  }

  if (
    email.length < 3 ||
    email.length >
      AUTH_CONFIG.MAX_EMAIL_LENGTH
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


// ============================================================
// PASSWORD VALIDATION
// ============================================================

function validatePassword(password) {

  if (
    typeof password !==
    "string"
  ) {
    return {
      valid: false,
      error:
        "Password is required"
    };
  }

  if (
    password.length <
    AUTH_CONFIG.MIN_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      error:
        `Password must contain at least ${AUTH_CONFIG.MIN_PASSWORD_LENGTH} characters`
    };
  }

  if (
    password.length >
    AUTH_CONFIG.MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      error:
        "Password is too long"
    };
  }

  return {
    valid: true,
    error: null
  };

}


// ============================================================
// SAFE USER OBJECT
// ============================================================
//
// NEVER return password_hash to the frontend.
// NEVER return JWT secrets.
// NEVER return internal authentication data.
//

function safeUser(user) {

  if (
    !user ||
    typeof user !==
      "object"
  ) {
    return null;
  }

  return {

    id:
      user.id,

    name:
      user.name,

    email:
      user.email,

    created_at:
      user.created_at,

    updated_at:
      user.updated_at

  };

}


// ============================================================
// JWT CREATION
// ============================================================

function createToken(user) {

  if (!JWT_SECRET) {

    throw new Error(
      "JWT_SECRET is not configured"
    );

  }

  if (
    !user ||
    !user.id ||
    !user.email
  ) {

    throw new Error(
      "Cannot create authentication token for invalid user"
    );

  }

  return jwt.sign(

    {
      id:
        user.id,

      email:
        user.email

    },

    JWT_SECRET,

    {
      expiresIn:
        AUTH_CONFIG.TOKEN_EXPIRES_IN,

      issuer:
        "nkwasibwe-irhcf",

      audience:
        "nkwasibwe-irhcf-client"

    }

  );

}


// ============================================================
// JWT VERIFICATION
// ============================================================

function verifyToken(token) {

  if (!JWT_SECRET) {

    throw new Error(
      "JWT_SECRET is not configured"
    );

  }

  if (
    typeof token !==
    "string" ||
    !token.trim()
  ) {

    throw new Error(
      "Authentication token is missing"
    );

  }

  return jwt.verify(

    token.trim(),

    JWT_SECRET,

    {
      issuer:
        "nkwasibwe-irhcf",

      audience:
        "nkwasibwe-irhcf-client"

    }

  );

}


// ============================================================
// EXTRACT BEARER TOKEN
// ============================================================

function extractBearerToken(req) {

  const authorization =
    req.headers?.authorization;

  if (
    typeof authorization !==
    "string"
  ) {

    return null;

  }

  const parts =
    authorization
      .trim()
      .split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !==
      "bearer"
  ) {

    return null;

  }

  const token =
    parts[1]?.trim();

  return token || null;

}


// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

async function authenticateToken(
  req,
  res,
  next
) {

  try {

    if (!JWT_SECRET) {

      await systemLog(
        "error",
        "authentication",
        "Authentication attempted while JWT_SECRET is not configured"
      );

      return res.status(503).json({

        success: false,

        error:
          "Authentication is not configured",

        code:
          "AUTH_NOT_CONFIGURED"

      });

    }


    const token =
      extractBearerToken(req);


    if (!token) {

      return res.status(401).json({

        success: false,

        error:
          "Authentication required",

        code:
          "AUTH_TOKEN_MISSING"

      });

    }


    let decoded;

    try {

      decoded =
        verifyToken(token);

    } catch (error) {

      const jwtError =
        error?.name;

      if (
        jwtError ===
        "TokenExpiredError"
      ) {

        return res.status(401).json({

          success: false,

          error:
            "Session expired. Please login again.",

          code:
            "AUTH_TOKEN_EXPIRED"

        });

      }

      if (
        jwtError ===
        "JsonWebTokenError"
      ) {

        return res.status(401).json({

          success: false,

          error:
            "Invalid authentication token",

          code:
            "AUTH_TOKEN_INVALID"

        });

      }

      return res.status(401).json({

        success: false,

        error:
          "Authentication failed",

        code:
          "AUTH_FAILED"

      });

    }


    if (
      !decoded ||
      !decoded.id ||
      !decoded.email
    ) {

      return res.status(401).json({

        success: false,

        error:
          "Invalid authentication identity",

        code:
          "AUTH_IDENTITY_INVALID"

      });

    }


    // --------------------------------------------------------
    // Resolve authenticated identity.
    //
    // We intentionally query the database instead of trusting
    // every user property contained inside the JWT.
    // --------------------------------------------------------

    const result =
      await pool.query(

        `SELECT
           id,
           name,
           email,
           created_at,
           updated_at
         FROM users
         WHERE id = $1
         LIMIT 1`,

        [
          decoded.id
        ]

      );


    if (
      result.rows.length ===
      0
    ) {

      return res.status(401).json({

        success: false,

        error:
          "User account no longer exists",

        code:
          "AUTH_USER_NOT_FOUND"

      });

    }


    const user =
      result.rows[0];


    // --------------------------------------------------------
    // Identity protection.
    //
    // The email in the JWT must still belong to the same user.
    // --------------------------------------------------------

    if (
      normalizeEmail(
        user.email
      ) !==
      normalizeEmail(
        decoded.email
      )
    ) {

      await systemLog(
        "warn",
        "authentication",
        "JWT identity mismatch detected",
        {
          userId:
            user.id
        }
      );

      return res.status(401).json({

        success: false,

        error:
          "Authentication identity mismatch",

        code:
          "AUTH_IDENTITY_MISMATCH"

      });

    }


    // --------------------------------------------------------
    // Attach trusted identity to request.
    // --------------------------------------------------------

    req.user =
      safeUser(user);


    req.auth =
      Object.freeze({

        userId:
          user.id,

        email:
          user.email,

        tokenIssuedAt:
          decoded.iat
            ? new Date(
                decoded.iat * 1000
              ).toISOString()
            : null,

        tokenExpiresAt:
          decoded.exp
            ? new Date(
                decoded.exp * 1000
              ).toISOString()
            : null

      });


    return next();

  } catch (error) {

    console.error(
      "Authentication middleware error:",
      error
    );

    await systemLog(
      "error",
      "authentication",
      "Authentication middleware failure",
      {
        message:
          error?.message
      }
    );

    return res.status(500).json({

      success: false,

      error:
        "Authentication service error",

      code:
        "AUTH_INTERNAL_ERROR"

    });

  }

}


// ============================================================
// REGISTER
// ============================================================

app.post(
  "/api/register",
  async (req, res) => {

    try {

      const name =
        normalizeText(
          req.body?.name
        );

      const email =
        normalizeEmail(
          req.body?.email
        );

      const password =
        typeof req.body?.password ===
        "string"
          ? req.body.password
          : "";


      // ------------------------------------------------------
      // BASIC VALIDATION
      // ------------------------------------------------------

      if (!name) {

        return res.status(400).json({

          success: false,

          error:
            "Name is required",

          code:
            "NAME_REQUIRED"

        });

      }


      if (
        name.length >
        AUTH_CONFIG.MAX_NAME_LENGTH
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Name is too long",

          code:
            "NAME_TOO_LONG"

        });

      }


      if (!isValidEmail(email)) {

        return res.status(400).json({

          success: false,

          error:
            "Please provide a valid email address",

          code:
            "INVALID_EMAIL"

        });

      }


      const passwordValidation =
        validatePassword(
          password
        );


      if (
        !passwordValidation.valid
      ) {

        return res.status(400).json({

          success: false,

          error:
            passwordValidation.error,

          code:
            "INVALID_PASSWORD"

        });

      }


      // ------------------------------------------------------
      // CHECK EXISTING ACCOUNT
      // ------------------------------------------------------

      const existing =
        await pool.query(

          `SELECT
             id
           FROM users
           WHERE LOWER(email) = LOWER($1)
           LIMIT 1`,

          [
            email
          ]

        );


      if (
        existing.rows.length >
        0
      ) {

        return res.status(409).json({

          success: false,

          error:
            "Email is already registered",

          code:
            "EMAIL_ALREADY_REGISTERED"

        });

      }


      // ------------------------------------------------------
      // HASH PASSWORD
      // ------------------------------------------------------

      const passwordHash =
        await bcrypt.hash(

          password,

          AUTH_CONFIG.BCRYPT_ROUNDS

        );


      // ------------------------------------------------------
      // CREATE USER
      // ------------------------------------------------------

      const result =
        await pool.query(

          `INSERT INTO users
           (
             name,
             email,
             password_hash
           )
           VALUES
           (
             $1,
             $2,
             $3
           )
           RETURNING
             id,
             name,
             email,
             created_at,
             updated_at`,

          [
            name,
            email,
            passwordHash
          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "User creation returned no record"
        );

      }


      const user =
        result.rows[0];


      // ------------------------------------------------------
      // CREATE SESSION TOKEN
      // ------------------------------------------------------

      const token =
        createToken(user);


      // ------------------------------------------------------
      // SECURITY LOG
      // ------------------------------------------------------

      await systemLog(

        "info",

        "authentication",

        "New user registered",

        {
          userId:
            user.id
        }

      );


      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(201).json({

        success: true,

        message:
          "Account created successfully",

        token,

        user:
          safeUser(user)

      });

    } catch (error) {

      console.error(
        "================================"
      );

      console.error(
        "REGISTER ERROR"
      );

      console.error(
        "message:",
        error?.message
      );

      console.error(
        "code:",
        error?.code
      );

      console.error(
        "detail:",
        error?.detail
      );

      console.error(
        "constraint:",
        error?.constraint
      );

      console.error(
        "================================"
      );


      await systemLog(

        "error",

        "authentication",

        "User registration failed",

        {
          message:
            error?.message,

          code:
            error?.code
        }

      );


      // PostgreSQL unique constraint protection
      if (
        error?.code ===
        "23505"
      ) {

        return res.status(409).json({

          success: false,

          error:
            "Email is already registered",

          code:
            "EMAIL_ALREADY_REGISTERED"

        });

      }


      return res.status(500).json({

        success: false,

        error:
          "Could not create account",

        code:
          "REGISTRATION_FAILED"

      });

    }

  }
);


// ============================================================
// LOGIN
// ============================================================

app.post(
  "/api/login",
  async (req, res) => {

    try {

      const email =
        normalizeEmail(
          req.body?.email
        );

      const password =
        typeof req.body?.password ===
        "string"
          ? req.body.password
          : "";


      if (!isValidEmail(email)) {

        return res.status(401).json({

          success: false,

          error:
            "Invalid email or password",

          code:
            "INVALID_CREDENTIALS"

        });

      }


      if (!password) {

        return res.status(401).json({

          success: false,

          error:
            "Invalid email or password",

          code:
            "INVALID_CREDENTIALS"

        });

      }


      // ------------------------------------------------------
      // FETCH USER
      // ------------------------------------------------------

      const result =
        await pool.query(

          `SELECT
             id,
             name,
             email,
             password_hash,
             created_at,
             updated_at
           FROM users
           WHERE LOWER(email) = LOWER($1)
           LIMIT 1`,

          [
            email
          ]

        );


      // ------------------------------------------------------
      // IMPORTANT:
      // Keep the external response identical whether the email
      // exists or not.
      // ------------------------------------------------------

      if (
        result.rows.length ===
        0
      ) {

        await systemLog(

          "warn",

          "authentication",

          "Login attempt for unknown account",

          {
            email
          }

        );

        return res.status(401).json({

          success: false,

          error:
            "Invalid email or password",

          code:
            "INVALID_CREDENTIALS"

        });

      }


      const user =
        result.rows[0];


      // ------------------------------------------------------
      // PASSWORD VERIFICATION
      // ------------------------------------------------------

      const validPassword =
        await bcrypt.compare(

          password,

          user.password_hash

        );


      if (!validPassword) {

        await systemLog(

          "warn",

          "authentication",

          "Invalid password during login",

          {
            userId:
              user.id
          }

        );

        return res.status(401).json({

          success: false,

          error:
            "Invalid email or password",

          code:
            "INVALID_CREDENTIALS"

        });

      }


      // ------------------------------------------------------
      // SAFE USER
      // ------------------------------------------------------

      const userSafe =
        safeUser(user);


      // ------------------------------------------------------
      // CREATE JWT
      // ------------------------------------------------------

      const token =
        createToken(
          userSafe
        );


      // ------------------------------------------------------
      // SECURITY LOG
      // ------------------------------------------------------

      await systemLog(

        "info",

        "authentication",

        "User logged in successfully",

        {
          userId:
            userSafe.id
        }

      );


      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.json({

        success: true,

        message:
          "Login successful",

        token,

        user:
          userSafe

      });

    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );


      await systemLog(

        "error",

        "authentication",

        "Login request failed",

        {
          message:
            error?.message,

          code:
            error?.code
        }

      );


      return res.status(500).json({

        success: false,

        error:
          "Could not login",

        code:
          "LOGIN_FAILED"

      });

    }

  }
);


// ============================================================
// CURRENT USER
// ============================================================

app.get(
  "/api/me",
  authenticateToken,
  async (req, res) => {

    try {

      const result =
        await pool.query(

          `SELECT
             id,
             name,
             email,
             created_at,
             updated_at
           FROM users
           WHERE id = $1
           LIMIT 1`,

          [
            req.user.id
          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success: false,

          error:
            "User not found",

          code:
            "USER_NOT_FOUND"

        });

      }


      return res.json({

        success: true,

        user:
          safeUser(
            result.rows[0]
          )

      });

    } catch (error) {

      console.error(
        "CURRENT USER ERROR:",
        error
      );


      await systemLog(

        "error",

        "authentication",

        "Could not resolve current user",

        {
          message:
            error?.message,

          userId:
            req.user?.id
        }

      );


      return res.status(500).json({

        success: false,

        error:
          "Could not get user",

        code:
          "CURRENT_USER_FAILED"

      });

    }

  }
);


// ============================================================
// AUTHENTICATION STATUS
// ============================================================
//
// Useful for frontend diagnostics.
// Does not expose the token itself.
//

app.get(
  "/api/auth/status",
  authenticateToken,
  async (req, res) => {

    return res.json({

      success: true,

      authenticated:
        true,

      user: {
        id:
          req.user.id,

        name:
          req.user.name,

        email:
          req.user.email
      },

      session: {

        tokenIssuedAt:
          req.auth?.tokenIssuedAt ||
          null,

        tokenExpiresAt:
          req.auth?.tokenExpiresAt ||
          null

      }

    });

  }
);


// ============================================================
// AUTHENTICATION DIAGNOSTIC
// ============================================================
//
// This endpoint intentionally NEVER returns:
//
// • JWT token
// • password
// • password_hash
// • JWT_SECRET
// • OPENAI_API_KEY
//
// It only helps the frontend understand whether its session
// is valid.
//

app.get(
  "/api/auth/check",
  async (req, res) => {

    try {

      if (!JWT_SECRET) {

        return res.status(503).json({

          success: false,

          authenticated:
            false,

          configured:
            false,

          code:
            "AUTH_NOT_CONFIGURED"

        });

      }


      const token =
        extractBearerToken(req);


      if (!token) {

        return res.status(401).json({

          success: false,

          authenticated:
            false,

          configured:
            true,

          code:
            "AUTH_TOKEN_MISSING"

        });

      }


      let decoded;

      try {

        decoded =
          verifyToken(token);

      } catch (error) {

        return res.status(401).json({

          success: false,

          authenticated:
            false,

          configured:
            true,

          code:
            error?.name ===
            "TokenExpiredError"
              ? "AUTH_TOKEN_EXPIRED"
              : "AUTH_TOKEN_INVALID"

        });

      }


      return res.json({

        success: true,

        authenticated:
          true,

        configured:
          true,

        identity: {

          id:
            decoded.id,

          email:
            decoded.email

        },

        expiresAt:
          decoded.exp
            ? new Date(
                decoded.exp * 1000
              ).toISOString()
            : null

      });

    } catch (error) {

      console.error(
        "AUTH CHECK ERROR:",
        error
      );

      return res.status(500).json({

        success: false,

        authenticated:
          false,

        code:
          "AUTH_CHECK_FAILED"

      });

    }

  }
);


// ============================================================
// AUTHENTICATION FAILURE HANDLER
// ============================================================
//
// This is intentionally placed after authentication routes.
// Future protected routes will use authenticateToken directly.
//
// ============================================================


// ============================================================
// PART 3 COMPLETE
// ============================================================

// ============================================================
// PART 4/14
// NKWSIBWE IRHCF — CONVERSATION & SESSION ENGINE
// ============================================================
//
// Responsibilities:
//
// • Create conversations
// • Resolve conversations
// • Enforce user ownership
// • Load conversation history
// • Paginate messages
// • Rename conversations
// • Delete conversations
// • Maintain timestamps
// • Protect session integrity
// • Prepare conversation layer for Agent/MEMORY systems
//
// SECURITY PRINCIPLE:
//
// A conversation MUST belong to the authenticated user.
// A user must NEVER be able to read, modify or delete another
// user's conversation by knowing its session ID.
// ============================================================


// ============================================================
// CONVERSATION CONFIGURATION
// ============================================================

const CONVERSATION_CONFIG = Object.freeze({

  MAX_TITLE_LENGTH:
    200,

  MAX_MESSAGE_LENGTH:
    50000,

  DEFAULT_HISTORY_LIMIT:
    50,

  MAX_HISTORY_LIMIT:
    200,

  DEFAULT_CONVERSATION_TITLE:
    "New conversation"

});


// ============================================================
// SESSION ID VALIDATION
// ============================================================
//
// We normally generate UUIDs with crypto.randomUUID().
// Validation prevents arbitrary/invalid values from reaching
// database queries.
//

function isValidSessionId(
  sessionId
) {

  if (
    typeof sessionId !==
    "string"
  ) {
    return false;
  }

  const value =
    sessionId.trim();

  if (!value) {
    return false;
  }

  // UUID v1-v5 compatible validation.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);

}


// ============================================================
// CONVERSATION TITLE
// ============================================================

function buildConversationTitle(
  message
) {

  const normalized =
    normalizeText(
      message
    );

  if (!normalized) {

    return CONVERSATION_CONFIG
      .DEFAULT_CONVERSATION_TITLE;

  }

  if (
    normalized.length <=
    CONVERSATION_CONFIG.MAX_TITLE_LENGTH
  ) {

    return normalized;

  }

  return (
    normalized.slice(
      0,
      CONVERSATION_CONFIG.MAX_TITLE_LENGTH - 3
    ) +
    "..."
  );

}


// ============================================================
// HISTORY LIMIT
// ============================================================

function normalizeHistoryLimit(
  value
) {

  const number =
    Number(value);

  if (
    !Number.isInteger(number)
  ) {

    return CONVERSATION_CONFIG
      .DEFAULT_HISTORY_LIMIT;

  }

  return Math.min(

    Math.max(
      number,
      1
    ),

    CONVERSATION_CONFIG
      .MAX_HISTORY_LIMIT

  );

}


// ============================================================
// MESSAGE CONTENT VALIDATION
// ============================================================

function validateMessageContent(
  content
) {

  const value =
    normalizeText(
      content
    );

  if (!value) {

    return {

      valid:
        false,

      error:
        "Message content is required"

    };

  }

  if (
    value.length >
    CONVERSATION_CONFIG.MAX_MESSAGE_LENGTH
  ) {

    return {

      valid:
        false,

      error:
        "Message is too long"

    };

  }

  return {

    valid:
      true,

    value

  };

}


// ============================================================
// RESOLVE USER CONVERSATION
// ============================================================
//
// Centralized ownership check.
//
// NEVER query a conversation only by session_id.
// Always include user_id.
//

async function resolveUserConversation(
  userId,
  sessionId
) {

  if (!userId) {

    throw new Error(
      "User ID is required"
    );

  }

  const normalizedSessionId =
    normalizeText(
      sessionId
    );


  if (
    !isValidSessionId(
      normalizedSessionId
    )
  ) {

    return null;

  }


  const result =
    await pool.query(

      `SELECT
         *
       FROM conversations
       WHERE user_id = $1
       AND session_id = $2
       LIMIT 1`,

      [
        userId,
        normalizedSessionId
      ]

    );


  if (
    result.rows.length ===
    0
  ) {

    return null;

  }


  return result.rows[0];

}


// ============================================================
// CREATE CONVERSATION
// ============================================================

app.post(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {

    try {

      const requestedTitle =
        normalizeText(
          req.body?.title
        );


      const title =
        requestedTitle
          ? requestedTitle.slice(
              0,
              CONVERSATION_CONFIG.MAX_TITLE_LENGTH
            )
          : CONVERSATION_CONFIG
              .DEFAULT_CONVERSATION_TITLE;


      const sessionId =
        crypto.randomUUID();


      const result =
        await pool.query(

          `INSERT INTO conversations
           (
             user_id,
             session_id,
             title
           )
           VALUES
           (
             $1,
             $2,
             $3
           )
           RETURNING
             id,
             user_id,
             session_id,
             title,
             created_at,
             updated_at`,

          [
            req.user.id,
            sessionId,
            title
          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "Conversation creation returned no record"
        );

      }


      const conversation =
        result.rows[0];


      await systemLog(

        "info",

        "conversations",

        "Conversation created",

        {

          userId:
            req.user.id,

          conversationId:
            conversation.id,

          sessionId:
            conversation.session_id

        }

      );


      return res.status(201).json({

        success:
          true,

        conversation

      });

    } catch (error) {

      console.error(
        "Create conversation error:",
        error
      );


      await systemLog(

        "error",

        "conversations",

        "Conversation creation failed",

        {

          userId:
            req.user?.id,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not create conversation",

        code:
          "CONVERSATION_CREATE_FAILED"

      });

    }

  }
);


// ============================================================
// LIST USER CONVERSATIONS
// ============================================================

app.get(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {

    try {

      const limitValue =
        Number(
          req.query?.limit
        );


      const limit =
        Number.isInteger(
          limitValue
        )
          ? Math.min(
              Math.max(
                limitValue,
                1
              ),
              100
            )
          : 50;


      const result =
        await pool.query(

          `SELECT
             id,
             session_id,
             title,
             created_at,
             updated_at
           FROM conversations
           WHERE user_id = $1
           ORDER BY
             updated_at DESC,
             id DESC
           LIMIT $2`,

          [
            req.user.id,
            limit
          ]

        );


      return res.json({

        success:
          true,

        conversations:
          result.rows

      });

    } catch (error) {

      console.error(
        "List conversations error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load conversation history",

        code:
          "CONVERSATION_LIST_FAILED"

      });

    }

  }
);


// ============================================================
// GET COMPLETE CONVERSATION
// ============================================================

app.get(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {

    try {

      const sessionId =
        normalizeText(
          req.params.sessionId
        );


      if (
        !isValidSessionId(
          sessionId
        )
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid session ID",

          code:
            "INVALID_SESSION_ID"

        });

      }


      const conversation =
        await resolveUserConversation(

          req.user.id,

          sessionId

        );


      if (!conversation) {

        return res.status(404).json({

          success:
            false,

          error:
            "Conversation not found",

          code:
            "CONVERSATION_NOT_FOUND"

        });

      }


      const historyResult =
        await pool.query(

          `SELECT
             id,
             role,
             content,
             created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY
             created_at ASC,
             id ASC
           LIMIT $2`,

          [

            conversation.id,

            CONVERSATION_CONFIG
              .MAX_HISTORY_LIMIT

          ]

        );


      return res.json({

        success:
          true,

        conversation: {

          id:
            conversation.id,

          session_id:
            conversation.session_id,

          title:
            conversation.title,

          created_at:
            conversation.created_at,

          updated_at:
            conversation.updated_at

        },

        messages:
          historyResult.rows

      });

    } catch (error) {

      console.error(
        "Get conversation error:",
        error
      );


      await systemLog(

        "error",

        "conversations",

        "Conversation retrieval failed",

        {

          userId:
            req.user?.id,

          sessionId:
            req.params?.sessionId,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load conversation",

        code:
          "CONVERSATION_GET_FAILED"

      });

    }

  }
);


// ============================================================
// GET PAGINATED MESSAGES
// ============================================================
//
// This endpoint is important for large conversations.
//
// The frontend does not need to download every historical
// message every time a conversation is opened.
//

app.get(
  "/api/conversations/:sessionId/messages",
  authenticateToken,
  async (req, res) => {

    try {

      const sessionId =
        normalizeText(
          req.params.sessionId
        );


      if (
        !isValidSessionId(
          sessionId
        )
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid session ID",

          code:
            "INVALID_SESSION_ID"

        });

      }


      const conversation =
        await resolveUserConversation(

          req.user.id,

          sessionId

        );


      if (!conversation) {

        return res.status(404).json({

          success:
            false,

          error:
            "Conversation not found",

          code:
            "CONVERSATION_NOT_FOUND"

        });

      }


      const limit =
        normalizeHistoryLimit(
          req.query?.limit
        );


      const offsetValue =
        Number(
          req.query?.offset
        );


      const offset =
        Number.isInteger(
          offsetValue
        ) &&
        offsetValue >= 0
          ? offsetValue
          : 0;


      const result =
        await pool.query(

          `SELECT
             id,
             role,
             content,
             created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY
             created_at ASC,
             id ASC
           LIMIT $2
           OFFSET $3`,

          [

            conversation.id,

            limit,

            offset

          ]

        );


      const countResult =
        await pool.query(

          `SELECT
             COUNT(*)::integer AS total
           FROM messages
           WHERE conversation_id = $1`,

          [
            conversation.id
          ]

        );


      const total =
        Number(
          countResult.rows[0]?.total ||
          0
        );


      return res.json({

        success:
          true,

        sessionId:
          conversation.session_id,

        messages:
          result.rows,

        pagination: {

          limit,

          offset,

          total,

          hasMore:
            offset +
              result.rows.length <
            total

        }

      });

    } catch (error) {

      console.error(
        "Load conversation messages error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load conversation messages",

        code:
          "MESSAGES_LOAD_FAILED"

      });

    }

  }
);


// ============================================================
// RENAME CONVERSATION
// ============================================================

app.patch(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {

    try {

      const sessionId =
        normalizeText(
          req.params.sessionId
        );


      if (
        !isValidSessionId(
          sessionId
        )
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid session ID",

          code:
            "INVALID_SESSION_ID"

        });

      }


      const title =
        normalizeText(
          req.body?.title
        );


      if (!title) {

        return res.status(400).json({

          success:
            false,

          error:
            "Conversation title is required",

          code:
            "TITLE_REQUIRED"

        });

      }


      if (
        title.length >
        CONVERSATION_CONFIG.MAX_TITLE_LENGTH
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Conversation title is too long",

          code:
            "TITLE_TOO_LONG"

        });

      }


      const result =
        await pool.query(

          `UPDATE conversations
           SET
             title = $1,
             updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2
           AND session_id = $3
           RETURNING
             id,
             session_id,
             title,
             created_at,
             updated_at`,

          [

            title,

            req.user.id,

            sessionId

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Conversation not found",

          code:
            "CONVERSATION_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "conversations",

        "Conversation renamed",

        {

          userId:
            req.user.id,

          conversationId:
            result.rows[0].id

        }

      );


      return res.json({

        success:
          true,

        conversation:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Rename conversation error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not rename conversation",

        code:
          "CONVERSATION_RENAME_FAILED"

      });

    }

  }
);


// ============================================================
// DELETE CONVERSATION
// ============================================================

app.delete(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {

    try {

      const sessionId =
        normalizeText(
          req.params.sessionId
        );


      if (
        !isValidSessionId(
          sessionId
        )
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid session ID",

          code:
            "INVALID_SESSION_ID"

        });

      }


      const result =
        await pool.query(

          `DELETE FROM conversations
           WHERE user_id = $1
           AND session_id = $2
           RETURNING
             id,
             session_id`,

          [

            req.user.id,

            sessionId

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Conversation not found",

          code:
            "CONVERSATION_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "conversations",

        "Conversation deleted",

        {

          userId:
            req.user.id,

          conversationId:
            result.rows[0].id,

          sessionId:
            result.rows[0].session_id

        }

      );


      return res.json({

        success:
          true,

        message:
          "Conversation deleted",

        sessionId

      });

    } catch (error) {

      console.error(
        "Delete conversation error:",
        error
      );


      await systemLog(

        "error",

        "conversations",

        "Conversation deletion failed",

        {

          userId:
            req.user?.id,

          sessionId:
            req.params?.sessionId,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not delete conversation",

        code:
          "CONVERSATION_DELETE_FAILED"

      });

    }

  }
);
// ============================================================
// ADD MESSAGE TO EXISTING CONVERSATION
// ============================================================
//
// This is deliberately a low-level persistence endpoint.
//
// The actual AI orchestration will be handled later.
// This endpoint is useful for internal agent modules,
// recovery systems and future providers.
//

app.post(
"/api/conversations/:sessionId/messages",
authenticateToken,
async (req, res) => {

try {  

  const sessionId =  
    normalizeText(  
      req.params.sessionId  
    );  


  if (  
    !isValidSessionId(  
      sessionId  
    )  
  ) {  

    return res.status(400).json({  

      success:  
        false,  

      error:  
        "Invalid session ID",  

      code:  
        "INVALID_SESSION_ID"  

    });  

  }  


  const conversation =  
    await resolveUserConversation(  

      req.user.id,  

      sessionId  

    );  


  if (!conversation) {  

    return res.status(404).json({  

      success:  
        false,  

      error:  
        "Conversation not found",  

      code:  
        "CONVERSATION_NOT_FOUND"  

    });  

  }  


  const role =  
    normalizeText(  
      req.body?.role  
    ).toLowerCase();  


  const allowedRoles = [  

    "user",  

    "assistant",  

    "system"  

  ];

if (
!allowedRoles.includes(
role
)
) {

return res.status(400).json({  

      success:  
        false,  

      error:  
        "Invalid message role",  

      code:  
        "INVALID_MESSAGE_ROLE"  

    });  

  }  


  const validation =  
    validateMessageContent(  
      req.body?.content  
    );  


  if (  
    !validation.valid  
  ) {  

    return res.status(400).json({  

      success:  
        false,  

      error:  
        validation.error,  

      code:  
        "INVALID_MESSAGE"  

    });  

  }  


  const result =  
    await pool.query(  

      `INSERT INTO messages  
       (  
         conversation_id,  
         role,  
         content  
       )  
       VALUES  
       (  
         $1,  
         $2,  
         $3  
       )  
       RETURNING  
         id,  
         role,  
         content,  
         created_at`,  

      [  

        conversation.id,  

        role,  

        validation.value  

      ]  

    );  


  await pool.query(  

    `UPDATE conversations  
     SET updated_at =  
       CURRENT_TIMESTAMP  
     WHERE id = $1`,  

    [  
      conversation.id  
    ]  

  );  


  return res.status(201).json({  

    success:  
      true,  

    message:  
      result.rows[0]  

  });  

} catch (error) {  

  console.error(  
    "Add conversation message error:",  
    error  
  );  


  return res.status(500).json({  

    success:  
      false,  

    error:  
      "Could not save message",  

    code:  
      "MESSAGE_SAVE_FAILED"  

  });  

}

}
);

// ============================================================
// CONVERSATION SUMMARY
// ============================================================
//
// Lightweight endpoint for the UI/agent dashboard.
//

app.get(
"/api/conversations/:sessionId/summary",
authenticateToken,
async (req, res) => {

try {  

  const sessionId =  
    normalizeText(  
      req.params.sessionId  
    );  


  if (  
    !isValidSessionId(  
      sessionId  
    )  
  ) {  

    return res.status(400).json({  

      success:  
        false,  

      error:  
        "Invalid session ID",  

      code:  
        "INVALID_SESSION_ID"  

    });  

  }  


  const conversation =  
    await resolveUserConversation(  

      req.user.id,  

      sessionId  

    );  


  if (!conversation) {  

    return res.status(404).json({  

      success:  
        false,  

      error:  
        "Conversation not found",  

      code:  
        "CONVERSATION_NOT_FOUND"  

    });  

  }  


  const result =  
    await pool.query(  

      `SELECT  
         COUNT(*)::integer AS message_count,  
         MIN(created_at) AS first_message_at,  
         MAX(created_at) AS last_message_at  
       FROM messages  
       WHERE conversation_id = $1`,  

      [  
        conversation.id  
      ]  

    );  


  const statistics =  
    result.rows[0] || {};  


  return res.json({  

    success:  
      true,  

    conversation: {  

      id:  
        conversation.id,  

      session_id:  
        conversation.session_id,  

      title:  
        conversation.title,  

      created_at:  
        conversation.created_at,  

      updated_at:  
        conversation.updated_at  

    },  

    statistics: {  

      messageCount:  
        Number(  
          statistics.message_count ||  
          0  
        ),  

      firstMessageAt:  
        statistics.first_message_at ||  
        null,  

      lastMessageAt:  
        statistics.last_message_at ||  
        null  

    }  

  });  

} catch (error) {  

  console.error(  
    "Conversation summary error:",  
    error  
  );  


  return res.status(500).json({  

    success:  
      false,  

    error:  
      "Could not load conversation summary",  

    code:  
      "CONVERSATION_SUMMARY_FAILED"  

  });  

}

}
);

// ============================================================
// PART 4 COMPLETE
// ============================================================

// ============================================================
// PART 5/14
// NKWASIBWE IRHCF — ADVANCED MEMORY ENGINE
// ============================================================
//
// Responsibilities:
//
// • Persistent user memory
// • Long-term memory
// • Memory categories
// • Importance ranking
// • Memory search
// • Memory update
// • Memory deletion
// • Memory statistics
// • Strict user ownership
// • Input validation
// • Memory size protection
// • Duplicate prevention
// • Agent-ready memory retrieval
//
// DESIGN PRINCIPLE:
//
// Memory is not just storage.
//
// Nkwasibwe must be able to:
//
// STORE → CLASSIFY → RANK → SEARCH → RETRIEVE → UPDATE → FORGET
//
// No user's private memory may be exposed to another user.
// ============================================================


// ============================================================
// MEMORY CONFIGURATION
// ============================================================

const MEMORY_CONFIG = Object.freeze({

  MAX_KEY_LENGTH:
    200,

  MAX_VALUE_LENGTH:
    20000,

  MAX_CONTENT_LENGTH:
    50000,

  MAX_TYPE_LENGTH:
    100,

  MAX_SOURCE_LENGTH:
    100,

  DEFAULT_LIMIT:
    50,

  MAX_LIMIT:
    200,

  MAX_SEARCH_LENGTH:
    200,

  MAX_IMPORTANCE:
    10,

  MIN_IMPORTANCE:
    1

});


// ============================================================
// MEMORY TYPE NORMALIZATION
// ============================================================

function normalizeMemoryType(
  value
) {

  const type =
    normalizeText(
      value
    );

  if (!type) {
    return "general";
  }

  return type
    .slice(
      0,
      MEMORY_CONFIG.MAX_TYPE_LENGTH
    )
    .toLowerCase();

}


// ============================================================
// MEMORY SOURCE NORMALIZATION
// ============================================================

function normalizeMemorySource(
  value
) {

  const source =
    normalizeText(
      value
    );

  if (!source) {
    return "user";
  }

  return source
    .slice(
      0,
      MEMORY_CONFIG.MAX_SOURCE_LENGTH
    );

}


// ============================================================
// MEMORY IMPORTANCE
// ============================================================

function normalizeMemoryImportance(
  value
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {

    return 1;

  }

  return Math.min(

    MEMORY_CONFIG.MAX_IMPORTANCE,

    Math.max(

      MEMORY_CONFIG.MIN_IMPORTANCE,

      Math.round(number)

    )

  );

}


// ============================================================
// MEMORY KEY VALIDATION
// ============================================================

function validateMemoryKey(
  key
) {

  const value =
    normalizeText(
      key
    );

  if (!value) {

    return {

      valid:
        false,

      error:
        "Memory key is required",

      code:
        "MEMORY_KEY_REQUIRED"

    };

  }

  if (
    value.length >
    MEMORY_CONFIG.MAX_KEY_LENGTH
  ) {

    return {

      valid:
        false,

      error:
        "Memory key is too long",

      code:
        "MEMORY_KEY_TOO_LONG"

    };

  }

  return {

    valid:
      true,

    value

  };

}


// ============================================================
// MEMORY VALUE VALIDATION
// ============================================================

function validateMemoryValue(
  value
) {

  const normalized =
    normalizeText(
      value
    );

  if (!normalized) {

    return {

      valid:
        false,

      error:
        "Memory value is required",

      code:
        "MEMORY_VALUE_REQUIRED"

    };

  }

  if (
    normalized.length >
    MEMORY_CONFIG.MAX_VALUE_LENGTH
  ) {

    return {

      valid:
        false,

      error:
        "Memory value is too long",

      code:
        "MEMORY_VALUE_TOO_LONG"

    };

  }

  return {

    valid:
      true,

    value:
      normalized

  };

}


// ============================================================
// LONG-TERM MEMORY VALIDATION
// ============================================================

function validateLongTermMemoryContent(
  content
) {

  const value =
    normalizeText(
      content
    );

  if (!value) {

    return {

      valid:
        false,

      error:
        "Memory content is required",

      code:
        "MEMORY_CONTENT_REQUIRED"

    };

  }

  if (
    value.length >
    MEMORY_CONFIG.MAX_CONTENT_LENGTH
  ) {

    return {

      valid:
        false,

      error:
        "Memory content is too long",

      code:
        "MEMORY_CONTENT_TOO_LONG"

    };

  }

  return {

    valid:
      true,

    value

  };

}


// ============================================================
// MEMORY LIMIT
// ============================================================

function normalizeMemoryLimit(
  value
) {

  const number =
    Number(value);

  if (
    !Number.isInteger(number)
  ) {

    return MEMORY_CONFIG.DEFAULT_LIMIT;

  }

  return Math.min(

    Math.max(
      number,
      1
    ),

    MEMORY_CONFIG.MAX_LIMIT

  );

}


// ============================================================
// MEMORY SEARCH QUERY
// ============================================================

function normalizeMemorySearch(
  value
) {

  const query =
    normalizeText(
      value
    );

  if (!query) {
    return "";
  }

  return query.slice(
    0,
    MEMORY_CONFIG.MAX_SEARCH_LENGTH
  );

}


// ============================================================
// SAVE / UPDATE PERSISTENT MEMORY
// ============================================================

app.post(
  "/api/memory",
  authenticateToken,
  async (req, res) => {

    try {

      const keyValidation =
        validateMemoryKey(
          req.body?.key
        );


      if (
        !keyValidation.valid
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            keyValidation.error,

          code:
            keyValidation.code

        });

      }


      const valueValidation =
        validateMemoryValue(
          req.body?.value
        );


      if (
        !valueValidation.valid
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            valueValidation.error,

          code:
            valueValidation.code

        });

      }


      const memoryType =
        normalizeMemoryType(
          req.body?.type
        );


      const importance =
        normalizeMemoryImportance(
          req.body?.importance
        );


      const result =
        await pool.query(

          `INSERT INTO user_memory
           (
             user_id,
             memory_key,
             memory_value,
             memory_type,
             importance
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5
           )
           ON CONFLICT
           (
             user_id,
             memory_key
           )
           DO UPDATE SET
             memory_value =
               EXCLUDED.memory_value,
             memory_type =
               EXCLUDED.memory_type,
             importance =
               EXCLUDED.importance,
             updated_at =
               CURRENT_TIMESTAMP
           RETURNING *`,

          [

            req.user.id,

            keyValidation.value,

            valueValidation.value,

            memoryType,

            importance

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "Memory operation returned no record"
        );

      }


      const memory =
        result.rows[0];


      await systemLog(

        "info",

        "memory",

        "Persistent memory saved",

        {

          userId:
            req.user.id,

          memoryId:
            memory.id,

          memoryType:
            memory.memory_type,

          importance:
            memory.importance

        }

      );


      return res.status(201).json({

        success:
          true,

        memory

      });

    } catch (error) {

      console.error(
        "Save persistent memory error:",
        error
      );


      await systemLog(

        "error",

        "memory",

        "Persistent memory save failed",

        {

          userId:
            req.user?.id,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not save memory",

        code:
          "MEMORY_SAVE_FAILED"

      });

    }

  }
);


// ============================================================
// LIST PERSISTENT MEMORY
// ============================================================

app.get(
  "/api/memory",
  authenticateToken,
  async (req, res) => {

    try {

      const limit =
        normalizeMemoryLimit(
          req.query?.limit
        );


      const type =
        normalizeMemoryType(
          req.query?.type
        );


      const search =
        normalizeMemorySearch(
          req.query?.search
        );


      const values = [
        req.user.id
      ];


      let query = `

        SELECT
          id,
          memory_key,
          memory_value,
          memory_type,
          importance,
          created_at,
          updated_at

        FROM user_memory

        WHERE user_id = $1

      `;


      if (type) {

        values.push(
          type
        );

        query += `
          AND memory_type = $${values.length}
        `;

      }


      if (search) {

        values.push(
          `%${search}%`
        );

        query += `
          AND (
            memory_key ILIKE $${values.length}
            OR
            memory_value ILIKE $${values.length}
          )
        `;

      }


      values.push(
        limit
      );


      query += `
        ORDER BY
          importance DESC,
          updated_at DESC,
          id DESC

        LIMIT $${values.length}
      `;


      const result =
        await pool.query(
          query,
          values
        );


      return res.json({

        success:
          true,

        memories:
          result.rows,

        count:
          result.rows.length

      });

    } catch (error) {

      console.error(
        "Load persistent memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memory",

        code:
          "MEMORY_LOAD_FAILED"

      });

    }

  }
);


// ============================================================
// GET ONE MEMORY BY KEY
// ============================================================

app.get(
  "/api/memory/:key",
  authenticateToken,
  async (req, res) => {

    try {

      const key =
        normalizeText(
          req.params.key
        );


      if (!key) {

        return res.status(400).json({

          success:
            false,

          error:
            "Memory key is required",

          code:
            "MEMORY_KEY_REQUIRED"

        });

      }


      const result =
        await pool.query(

          `SELECT
             id,
             memory_key,
             memory_value,
             memory_type,
             importance,
             created_at,
             updated_at
           FROM user_memory
           WHERE user_id = $1
           AND memory_key = $2
           LIMIT 1`,

          [

            req.user.id,

            key

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      return res.json({

        success:
          true,

        memory:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Get memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memory",

        code:
          "MEMORY_GET_FAILED"

      });

    }

  }
);


// ============================================================
// DELETE PERSISTENT MEMORY
// ============================================================

app.delete(
  "/api/memory/:key",
  authenticateToken,
  async (req, res) => {

    try {

      const key =
        normalizeText(
          req.params.key
        );


      if (!key) {

        return res.status(400).json({

          success:
            false,

          error:
            "Memory key is required",

          code:
            "MEMORY_KEY_REQUIRED"

        });

      }


      const result =
        await pool.query(

          `DELETE FROM user_memory
           WHERE user_id = $1
           AND memory_key = $2
           RETURNING
             id,
             memory_key`,

          [

            req.user.id,

            key

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "memory",

        "Persistent memory deleted",

        {

          userId:
            req.user.id,

          memoryId:
            result.rows[0].id,

          memoryKey:
            result.rows[0].memory_key

        }

      );


      return res.json({

        success:
          true,

        message:
          "Memory deleted"

      });

    } catch (error) {

      console.error(
        "Delete memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not delete memory",

        code:
          "MEMORY_DELETE_FAILED"

      });

    }

  }
);


// ============================================================
// CREATE LONG-TERM MEMORY
// ============================================================

app.post(
  "/api/long-term-memory",
  authenticateToken,
  async (req, res) => {

    try {

      const validation =
        validateLongTermMemoryContent(
          req.body?.content
        );


      if (
        !validation.valid
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            validation.error,

          code:
            validation.code

        });

      }


      const memoryType =
        normalizeMemoryType(
          req.body?.type
        );


      const importance =
        normalizeMemoryImportance(
          req.body?.importance
        );


      const source =
        normalizeMemorySource(
          req.body?.source
        );


      const result =
        await pool.query(

          `INSERT INTO long_term_memory
           (
             user_id,
             content,
             memory_type,
             importance,
             source
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5
           )
           RETURNING *`,

          [

            req.user.id,

            validation.value,

            memoryType,

            importance,

            source

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "Long-term memory creation returned no record"
        );

      }


      const memory =
        result.rows[0];


      await systemLog(

        "info",

        "long_term_memory",

        "Long-term memory created",

        {

          userId:
            req.user.id,

          memoryId:
            memory.id,

          memoryType:
            memory.memory_type,

          importance:
            memory.importance,

          source:
            memory.source

        }

      );


      return res.status(201).json({

        success:
          true,

        memory

      });

    } catch (error) {

      console.error(
        "Create long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not save long-term memory",

        code:
          "LONG_TERM_MEMORY_SAVE_FAILED"

      });

    }

  }
);


// ============================================================
// LIST LONG-TERM MEMORY
// ============================================================

app.get(
  "/api/long-term-memory",
  authenticateToken,
  async (req, res) => {

    try {

      const limit =
        normalizeMemoryLimit(
          req.query?.limit
        );


      const type =
        normalizeMemoryType(
          req.query?.type
        );


      const search =
        normalizeMemorySearch(
          req.query?.search
        );


      const values = [
        req.user.id
      ];


      let query = `

        SELECT
          id,
          content,
          memory_type,
          importance,
          source,
          created_at,
          updated_at

        FROM long_term_memory

        WHERE user_id = $1

      `;


      if (type) {

        values.push(
          type
        );

        query += `
          AND memory_type = $${values.length}
        `;

      }


      if (search) {

        values.push(
          `%${search}%`
        );

        query += `
          AND content ILIKE $${values.length}
        `;

      }


      values.push(
        limit
      );


      query += `
        ORDER BY
          importance DESC,
          updated_at DESC,
          id DESC

        LIMIT $${values.length}
      `;


      const result =
        await pool.query(
          query,
          values
        );


      return res.json({

        success:
          true,

        memories:
          result.rows,

        count:
          result.rows.length

      });

    } catch (error) {

      console.error(
        "Load long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load long-term memory",

        code:
          "LONG_TERM_MEMORY_LOAD_FAILED"

      });

    }

  }
);


// ============================================================
// GET LONG-TERM MEMORY BY ID
// ============================================================

app.get(
  "/api/long-term-memory/:id",
  authenticateToken,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid memory ID",

          code:
            "INVALID_MEMORY_ID"

        });

      }


      const result =
        await pool.query(

          `SELECT
             id,
             content,
             memory_type,
             importance,
             source,
             created_at,
             updated_at
           FROM long_term_memory
           WHERE id = $1
           AND user_id = $2
           LIMIT 1`,

          [

            id,

            req.user.id

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Long-term memory not found",

          code:
            "LONG_TERM_MEMORY_NOT_FOUND"

        });

      }


      return res.json({

        success:
          true,

        memory:
          result.rows[0]

      });

    } catch (error) {

      console.error(
        "Get long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load long-term memory",

        code:
          "LONG_TERM_MEMORY_GET_FAILED"

      });

    }

  }
);


// ============================================================
// DELETE LONG-TERM MEMORY
// ============================================================

app.delete(
  "/api/long-term-memory/:id",
  authenticateToken,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "Invalid memory ID",

          code:
            "INVALID_MEMORY_ID"

        });

      }


      const result =
        await pool.query(

          `DELETE FROM long_term_memory
           WHERE id = $1
           AND user_id = $2
           RETURNING
             id,
             memory_type`,

          [

            id,

            req.user.id

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Long-term memory not found",

          code:
            "LONG_TERM_MEMORY_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "long_term_memory",

        "Long-term memory deleted",

        {

          userId:
            req.user.id,

          memoryId:
            result.rows[0].id,

          memoryType:
            result.rows[0].memory_type

        }

      );


      return res.json({

        success:
          true,

        message:
          "Long-term memory deleted"

      });

    } catch (error) {

      console.error(
        "Delete long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not delete long-term memory",

        code:
          "LONG_TERM_MEMORY_DELETE_FAILED"

      });

    }

  }
);


// ============================================================
// MEMORY STATISTICS
// ============================================================
//
// Gives the Agent/UI a compact understanding of the user's
// memory system without downloading all memory records.
//

app.get(
  "/api/memory/stats",
  authenticateToken,
  async (req, res) => {

    try {

      const persistentResult =
        await pool.query(

          `SELECT
             COUNT(*)::integer AS total,
             COUNT(
               DISTINCT memory_type
             )::integer AS types,
             COALESCE(
               AVG(importance),
               0
             ) AS average_importance
           FROM user_memory
           WHERE user_id = $1`,

          [
            req.user.id
          ]

        );


      const longTermResult =
        await pool.query(

          `SELECT
             COUNT(*)::integer AS total,
             COUNT(
               DISTINCT memory_type
             )::integer AS types,
             COALESCE(
               AVG(importance),
               0
             ) AS average_importance
           FROM long_term_memory
           WHERE user_id = $1`,

          [
            req.user.id
          ]

        );


      const persistent =
        persistentResult.rows[0] ||
        {};


      const longTerm =
        longTermResult.rows[0] ||
        {};


      return res.json({

        success:
          true,

        statistics: {

          persistentMemory: {

            total:
              Number(
                persistent.total ||
                0
              ),

            types:
              Number(
                persistent.types ||
                0
              ),

            averageImportance:
              Number(
                persistent.average_importance ||
                0
              )

          },

          longTermMemory: {

            total:
              Number(
                longTerm.total ||
                0
              ),

            types:
              Number(
                longTerm.types ||
                0
              ),

            averageImportance:
              Number(
                longTerm.average_importance ||
                0
              )

          },

          totalMemory:

            Number(
              persistent.total ||
              0
            ) +

            Number(
              longTerm.total ||
              0
            )

        }

      });

    } catch (error) {

      console.error(
        "Memory statistics error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memory statistics",

        code:
          "MEMORY_STATS_FAILED"

      });

    }

  }
);
// ============================================================
// AGENT MEMORY SNAPSHOT
// ============================================================
//
// Internal-friendly endpoint.
//
// It returns the most relevant memories first.
//
// This will later become one of the major inputs to the
// Nkwasibwe Agent Orchestration Engine.
//

app.get(
  "/api/memory/snapshot",
  authenticateToken,
  async (req, res) => {

    try {

      const limit =
        normalizeMemoryLimit(
          req.query?.limit
        );


      const persistentLimit =
        Math.ceil(
          limit / 2
        );


      const longTermLimit =
        Math.floor(
          limit / 2
        );


      const [
        persistentResult,
        longTermResult
      ] =
        await Promise.all([

          pool.query(

            `SELECT
               id,
               memory_key,
               memory_value,
               memory_type,
               importance,
               created_at,
               updated_at
             FROM user_memory
             WHERE user_id = $1
             ORDER BY
               importance DESC,
               updated_at DESC,
               id DESC
             LIMIT $2`,

            [

              req.user.id,

              persistentLimit

            ]

          ),

          pool.query(

            `SELECT
               id,
               content,
               memory_type,
               importance,
               source,
               created_at,
               updated_at
             FROM long_term_memory
             WHERE user_id = $1
             ORDER BY
               importance DESC,
               updated_at DESC,
               id DESC
             LIMIT $2`,

            [

              req.user.id,

              longTermLimit

            ]

          )

        ]);


      return res.json({

        success:
          true,

        snapshot: {

          persistent:
            persistentResult.rows,

          longTerm:
            longTermResult.rows,

          generatedAt:
            new Date().toISOString()

        }

      });

    } catch (error) {

      console.error(
        "Memory snapshot error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not create memory snapshot",

        code:
          "MEMORY_SNAPSHOT_FAILED"

      });

    }

  }
);


// ============================================================
// PART 5 COMPLETE
// ============================================================

// ============================================================
// PART 6/14
// NKWSIBWE IRHCF — MEMORY ENGINE
// ============================================================
//
// Responsibilities:
//
// • User memory
// • Long-term memory
// • Memory ownership
// • Memory importance
// • Memory search
// • Memory retrieval
// • Memory deletion
// • Memory limits
// • Memory sanitization
// • Memory protection
// • Memory statistics
// • Agent-ready memory context
//
// SECURITY PRINCIPLE:
//
// A memory record MUST belong to the authenticated user.
// A user must NEVER be able to read, modify or delete another
// user's memory by knowing a memory ID.
//
// IMPORTANT:
//
// This module depends on infrastructure defined in previous
// parts:
//
// • express
// • pool
// • authenticateToken
// • normalizeText
// • systemLog
//
// ============================================================


// ============================================================
// MEMORY CONFIGURATION
// ============================================================

const MEMORY_CONFIG = Object.freeze({

  // ----------------------------------------------------------
  // General limits
  // ----------------------------------------------------------

  MAX_MEMORY_CONTENT_LENGTH:
    20000,

  MAX_MEMORY_TITLE_LENGTH:
    300,

  MAX_MEMORY_SOURCE_LENGTH:
    200,

  MAX_MEMORY_TAGS:
    30,

  MAX_TAG_LENGTH:
    80,

  MAX_RETRIEVAL_LIMIT:
    100,

  DEFAULT_RETRIEVAL_LIMIT:
    20,

  MAX_IMPORTANCE:
    10,

  MIN_IMPORTANCE:
    1,

  // ----------------------------------------------------------
  // Memory types
  // ----------------------------------------------------------

  ALLOWED_TYPES: Object.freeze([

    "fact",

    "preference",

    "instruction",

    "profile",

    "goal",

    "project",

    "context",

    "relationship",

    "knowledge",

    "experience",

    "other"

  ]),

  // ----------------------------------------------------------
  // Memory sources
  // ----------------------------------------------------------

  ALLOWED_SOURCES: Object.freeze([

    "user",

    "conversation",

    "agent",

    "system",

    "import",

    "manual"

  ])

});


// ============================================================
// MEMORY ID VALIDATION
// ============================================================
//
// Supports UUID and numeric database IDs.
//
// This makes the API compatible with different PostgreSQL
// schemas without allowing arbitrary SQL values.
//

function isValidMemoryId(
  memoryId
) {

  if (
    memoryId === null ||
    memoryId === undefined
  ) {

    return false;

  }


  const value =
    String(
      memoryId
    ).trim();


  if (!value) {

    return false;

  }


  // UUID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) {

    return true;

  }


  // Positive integer
  if (
    /^[1-9][0-9]*$/.test(
      value
    )
  ) {

    return true;

  }


  return false;

}


// ============================================================
// INTEGER NORMALIZATION
// ============================================================

function normalizeMemoryInteger(
  value,
  fallback,
  minimum,
  maximum
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isInteger(
      number
    )
  ) {

    return fallback;

  }


  return Math.min(

    Math.max(
      number,
      minimum
    ),

    maximum

  );

}


// ============================================================
// MEMORY IMPORTANCE
// ============================================================

function normalizeMemoryImportance(
  value
) {

  return normalizeMemoryInteger(

    value,

    5,

    MEMORY_CONFIG.MIN_IMPORTANCE,

    MEMORY_CONFIG.MAX_IMPORTANCE

  );

}


// ============================================================
// MEMORY TYPE
// ============================================================

function normalizeMemoryType(
  value
) {

  const type =
    normalizeText(
      value
    ).toLowerCase();


  if (
    MEMORY_CONFIG.ALLOWED_TYPES
      .includes(type)
  ) {

    return type;

  }


  return "other";

}


// ============================================================
// MEMORY SOURCE
// ============================================================

function normalizeMemorySource(
  value
) {

  const source =
    normalizeText(
      value
    ).toLowerCase();


  if (
    MEMORY_CONFIG.ALLOWED_SOURCES
      .includes(source)
  ) {

    return source;

  }


  return "user";

}


// ============================================================
// MEMORY CONTENT VALIDATION
// ============================================================

function validateMemoryContent(
  content
) {

  const value =
    normalizeText(
      content
    );


  if (!value) {

    return {

      valid:
        false,

      error:
        "Memory content is required",

      code:
        "MEMORY_CONTENT_REQUIRED"

    };

  }


  if (
    value.length >
    MEMORY_CONFIG.MAX_MEMORY_CONTENT_LENGTH
  ) {

    return {

      valid:
        false,

      error:
        "Memory content is too long",

      code:
        "MEMORY_CONTENT_TOO_LONG"

    };

  }


  return {

    valid:
      true,

    value

  };

}


// ============================================================
// MEMORY TITLE
// ============================================================

function normalizeMemoryTitle(
  value
) {

  const title =
    normalizeText(
      value
    );


  if (!title) {

    return null;

  }


  return title.slice(
    0,
    MEMORY_CONFIG.MAX_MEMORY_TITLE_LENGTH
  );

}


// ============================================================
// MEMORY SOURCE LABEL
// ============================================================

function normalizeMemorySourceLabel(
  value
) {

  const source =
    normalizeText(
      value
    );


  if (!source) {

    return null;

  }


  return source.slice(
    0,
    MEMORY_CONFIG.MAX_MEMORY_SOURCE_LENGTH
  );

}


// ============================================================
// MEMORY TAGS
// ============================================================

function normalizeMemoryTags(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return [];

  }


  let tags = [];


  if (
    Array.isArray(value)
  ) {

    tags =
      value;

  } else if (
    typeof value ===
    "string"
  ) {

    tags =
      value.split(",");

  } else {

    return [];

  }


  const normalized = [];


  for (
    const tag of tags
  ) {

    const clean =
      normalizeText(
        tag
      ).toLowerCase();


    if (!clean) {

      continue;

    }


    const limited =
      clean.slice(
        0,
        MEMORY_CONFIG.MAX_TAG_LENGTH
      );


    if (
      !normalized.includes(
        limited
      )
    ) {

      normalized.push(
        limited
      );

    }


    if (
      normalized.length >=
      MEMORY_CONFIG.MAX_MEMORY_TAGS
    ) {

      break;

    }

  }


  return normalized;

}


// ============================================================
// MEMORY QUERY VALIDATION
// ============================================================

function normalizeMemorySearchQuery(
  value
) {

  const query =
    normalizeText(
      value
    );


  if (!query) {

    return null;

  }


  return query.slice(
    0,
    1000
  );

}


// ============================================================
// SAFE MEMORY OBJECT
// ============================================================
//
// Never expose unnecessary internal database information.
//

function sanitizeMemoryRecord(
  memory
) {

  if (!memory) {

    return null;

  }


  return {

    id:
      memory.id,

    user_id:
      memory.user_id,

    title:
      memory.title ||
      null,

    content:
      memory.content ||
      "",

    memory_type:
      memory.memory_type ||
      "other",

    importance:
      Number(
        memory.importance ||
        5
      ),

    source:
      memory.source ||
      "user",

    source_label:
      memory.source_label ||
      null,

    tags:
      Array.isArray(
        memory.tags
      )
        ? memory.tags
        : [],

    created_at:
      memory.created_at ||
      null,

    updated_at:
      memory.updated_at ||
      null,

    last_accessed_at:
      memory.last_accessed_at ||
      null

  };

}


// ============================================================
// RESOLVE USER MEMORY
// ============================================================
//
// Ownership is ALWAYS enforced.
//

async function resolveUserMemory(
  userId,
  memoryId
) {

  if (!userId) {

    throw new Error(
      "User ID is required"
    );

  }


  if (
    !isValidMemoryId(
      memoryId
    )
  ) {

    return null;

  }


  const result =
    await pool.query(

      `SELECT
         *
       FROM user_memory
       WHERE id = $1
       AND user_id = $2
       LIMIT 1`,

      [

        memoryId,

        userId

      ]

    );


  if (
    result.rows.length ===
    0
  ) {

    return null;

  }


  return result.rows[0];

}


// ============================================================
// RESOLVE LONG-TERM MEMORY
// ============================================================

async function resolveLongTermMemory(
  userId,
  memoryId
) {

  if (!userId) {

    throw new Error(
      "User ID is required"
    );

  }


  if (
    !isValidMemoryId(
      memoryId
    )
  ) {

    return null;

  }


  const result =
    await pool.query(

      `SELECT
         *
       FROM long_term_memory
       WHERE id = $1
       AND user_id = $2
       LIMIT 1`,

      [

        memoryId,

        userId

      ]

    );


  if (
    result.rows.length ===
    0
  ) {

    return null;

  }


  return result.rows[0];

}


// ============================================================
// CREATE USER MEMORY
// ============================================================

app.post(
  "/api/memory",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const validation =
        validateMemoryContent(
          req.body?.content
        );


      if (
        !validation.valid
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            validation.error,

          code:
            validation.code

        });

      }


      const title =
        normalizeMemoryTitle(
          req.body?.title
        );


      const memoryType =
        normalizeMemoryType(
          req.body?.memory_type ||
          req.body?.type
        );


      const importance =
        normalizeMemoryImportance(
          req.body?.importance
        );


      const source =
        normalizeMemorySource(
          req.body?.source
        );


      const sourceLabel =
        normalizeMemorySourceLabel(
          req.body?.source_label
        );


      const tags =
        normalizeMemoryTags(
          req.body?.tags
        );


      const result =
        await pool.query(

          `INSERT INTO user_memory
           (
             user_id,
             title,
             content,
             memory_type,
             importance,
             source,
             source_label,
             tags
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8
           )
           RETURNING
             *`,

          [

            req.user.id,

            title,

            validation.value,

            memoryType,

            importance,

            source,

            sourceLabel,

            tags

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "Memory creation returned no record"
        );

      }


      const memory =
        sanitizeMemoryRecord(
          result.rows[0]
        );


      await systemLog(

        "info",

        "memory",

        "User memory created",

        {

          userId:
            req.user.id,

          memoryId:
            memory.id,

          memoryType:
            memory.memory_type,

          importance:
            memory.importance

        }

      );


      return res.status(201).json({

        success:
          true,

        memory

      });

    } catch (error) {

      console.error(
        "Create memory error:",
        error
      );


      await systemLog(

        "error",

        "memory",

        "User memory creation failed",

        {

          userId:
            req.user?.id,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not create memory",

        code:
          "MEMORY_CREATE_FAILED"

      });

    }

  }
);


// ============================================================
// LIST USER MEMORY
// ============================================================

app.get(
  "/api/memory",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const limit =
        normalizeMemoryInteger(

          req.query?.limit,

          MEMORY_CONFIG
            .DEFAULT_RETRIEVAL_LIMIT,

          1,

          MEMORY_CONFIG
            .MAX_RETRIEVAL_LIMIT

        );


      const offset =
        normalizeMemoryInteger(

          req.query?.offset,

          0,

          0,

          Number.MAX_SAFE_INTEGER

        );


      const type =
        normalizeText(
          req.query?.type
        ).toLowerCase();


      const importance =
        req.query?.importance !==
        undefined

          ? normalizeMemoryInteger(

              req.query.importance,

              1,

              MEMORY_CONFIG.MIN_IMPORTANCE,

              MEMORY_CONFIG.MAX_IMPORTANCE

            )

          : null;


      const query =
        normalizeMemorySearchQuery(
          req.query?.q
        );


      const conditions = [

        `user_id = $1`

      ];


      const values = [

        req.user.id

      ];


      let parameterIndex =
        2;


      if (
        type &&
        MEMORY_CONFIG.ALLOWED_TYPES
          .includes(type)
      ) {

        conditions.push(
          `memory_type = $${parameterIndex}`
        );

        values.push(
          type
        );

        parameterIndex++;

      }


      if (
        importance !== null
      ) {

        conditions.push(
          `importance >= $${parameterIndex}`
        );

        values.push(
          importance
        );

        parameterIndex++;

      }


      if (
        query
      ) {

        conditions.push(

          `(content ILIKE $${parameterIndex}
            OR title ILIKE $${parameterIndex}
            OR source_label ILIKE $${parameterIndex})`

        );

        values.push(
          `%${query}%`
        );

        parameterIndex++;

      }


      values.push(
        limit
      );

      const limitParameter =
        parameterIndex;

      parameterIndex++;


      values.push(
        offset
      );

      const offsetParameter =
        parameterIndex;


      const result =
        await pool.query(

          `SELECT
             *
           FROM user_memory
           WHERE ${conditions.join(
             " AND "
           )}
           ORDER BY
             importance DESC,
             updated_at DESC,
             id DESC
           LIMIT $${limitParameter}
           OFFSET $${offsetParameter}`,

          values

        );


      const memories =
        result.rows.map(
          sanitizeMemoryRecord
        );


      return res.json({

        success:
          true,

        memories,

        pagination: {

          limit,

          offset,

          returned:
            memories.length

        }

      });

    } catch (error) {

      console.error(
        "List memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memories",

        code:
          "MEMORY_LIST_FAILED"

      });

    }

  }
);


// ============================================================
// GET SINGLE MEMORY
// ============================================================

app.get(
  "/api/memory/:memoryId",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const memory =
        await resolveUserMemory(

          req.user.id,

          req.params.memoryId

        );


      if (!memory) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      // Update access timestamp.
      //
      // Failure here should NOT prevent returning the memory.

      try {

        await pool.query(

          `UPDATE user_memory
           SET
             last_accessed_at =
               CURRENT_TIMESTAMP
           WHERE id = $1
           AND user_id = $2`,

          [

            memory.id,

            req.user.id

          ]

        );

      } catch (
        accessError
      ) {

        console.error(

          "Memory access timestamp update failed:",

          accessError

        );

      }


      return res.json({

        success:
          true,

        memory:
          sanitizeMemoryRecord(
            memory
          )

      });

    } catch (error) {

      console.error(
        "Get memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memory",

        code:
          "MEMORY_GET_FAILED"

      });

    }

  }
);


// ============================================================
// UPDATE USER MEMORY
// ============================================================

app.patch(
  "/api/memory/:memoryId",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const existing =
        await resolveUserMemory(

          req.user.id,

          req.params.memoryId

        );


      if (!existing) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      const updates = [];

      const values = [];


      // --------------------------------------------------------
      // Content
      // --------------------------------------------------------

      if (
        req.body?.content !==
        undefined
      ) {

        const validation =
          validateMemoryContent(
            req.body.content
          );


        if (
          !validation.valid
        ) {

          return res.status(400).json({

            success:
              false,

            error:
              validation.error,

            code:
              validation.code

          });

        }


        updates.push(
          `content = $${values.length + 1}`
        );

        values.push(
          validation.value
        );

      }


      // --------------------------------------------------------
      // Title
      // --------------------------------------------------------

      if (
        req.body?.title !==
        undefined
      ) {

        const title =
          normalizeMemoryTitle(
            req.body.title
          );


        updates.push(
          `title = $${values.length + 1}`
        );

        values.push(
          title
        );

      }


      
      // --------------------------------------------------------
      // Memory type
      // --------------------------------------------------------

      if (
        req.body?.memory_type !==
        undefined ||
        req.body?.type !==
        undefined
      ) {

        const type =
          normalizeMemoryType(

            req.body?.memory_type ??
            req.body?.type

          );


        updates.push(
          `memory_type = $${values.length + 1}`
        );

        values.push(
          type
        );

      }


      // --------------------------------------------------------
      // Importance
      // --------------------------------------------------------

      if (
        req.body?.importance !==
        undefined
      ) {

        const importance =
          normalizeMemoryImportance(
            req.body.importance
          );


        updates.push(
          `importance = $${values.length + 1}`
        );

        values.push(
          importance
        );

      }


      // --------------------------------------------------------
      // Source
      // --------------------------------------------------------

      if (
        req.body?.source !==
        undefined
      ) {

        const source =
          normalizeMemorySource(
            req.body.source
          );


        updates.push(
          `source = $${values.length + 1}`
        );

        values.push(
          source
        );

      }


      // --------------------------------------------------------
      // Source label
      // --------------------------------------------------------

      if (
        req.body?.source_label !==
        undefined
      ) {

        const sourceLabel =
          normalizeMemorySourceLabel(
            req.body.source_label
          );


        updates.push(
          `source_label = $${values.length + 1}`
        );

        values.push(
          sourceLabel
        );

      }


      // --------------------------------------------------------
      // Tags
      // --------------------------------------------------------

      if (
        req.body?.tags !==
        undefined
      ) {

        const tags =
          normalizeMemoryTags(
            req.body.tags
          );


        updates.push(
          `tags = $${values.length + 1}`
        );

        values.push(
          tags
        );

      }


      if (
        updates.length ===
        0
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            "No valid memory fields provided",

          code:
            "NO_MEMORY_UPDATES"

        });

      }


      updates.push(
        "updated_at = CURRENT_TIMESTAMP"
      );


      values.push(
        req.params.memoryId
      );

      const memoryIdParameter =
        values.length;


      values.push(
        req.user.id
      );

      const userIdParameter =
        values.length;


      const result =
        await pool.query(

          `UPDATE user_memory
           SET
             ${updates.join(",\n             ")}
           WHERE id = $${memoryIdParameter}
           AND user_id = $${userIdParameter}
           RETURNING *`,

          values

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      const memory =
        sanitizeMemoryRecord(
          result.rows[0]
        );


      await systemLog(

        "info",

        "memory",

        "User memory updated",

        {

          userId:
            req.user.id,

          memoryId:
            memory.id

        }

      );


      return res.json({

        success:
          true,

        memory

      });

    } catch (error) {

      console.error(
        "Update memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not update memory",

        code:
          "MEMORY_UPDATE_FAILED"

      });

    }

  }
);

// ============================================================
// DELETE USER MEMORY
// ============================================================

app.delete(
  "/api/memory/:memoryId",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await pool.query(

          `DELETE FROM user_memory
           WHERE id = $1
           AND user_id = $2
           RETURNING
             id`,

          [

            req.params.memoryId,

            req.user.id

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Memory not found",

          code:
            "MEMORY_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "memory",

        "User memory deleted",

        {

          userId:
            req.user.id,

          memoryId:
            result.rows[0].id

        }

      );


      return res.json({

        success:
          true,

        message:
          "Memory deleted",

        memoryId:
          result.rows[0].id

      });

    } catch (error) {

      console.error(
        "Delete memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not delete memory",

        code:
          "MEMORY_DELETE_FAILED"

      });

    }

  }
);


// ============================================================
// CREATE LONG-TERM MEMORY
// ============================================================
//
// Long-term memory is separated from ordinary user memory so
// future Agent/AI systems can treat persistent knowledge with
// stronger retrieval semantics.
//

app.post(
  "/api/long-term-memory",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const validation =
        validateMemoryContent(
          req.body?.content
        );


      if (
        !validation.valid
      ) {

        return res.status(400).json({

          success:
            false,

          error:
            validation.error,

          code:
            validation.code

        });

      }


      const title =
        normalizeMemoryTitle(
          req.body?.title
        );


      const memoryType =
        normalizeMemoryType(
          req.body?.memory_type ||
          req.body?.type
        );


      const importance =
        normalizeMemoryImportance(

          req.body?.importance ??
          7

        );


      const source =
        normalizeMemorySource(
          req.body?.source
        );


      const sourceLabel =
        normalizeMemorySourceLabel(
          req.body?.source_label
        );


      const tags =
        normalizeMemoryTags(
          req.body?.tags
        );


      const result =
        await pool.query(

          `INSERT INTO long_term_memory
           (
             user_id,
             title,
             content,
             memory_type,
             importance,
             source,
             source_label,
             tags
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8
           )
           RETURNING *`,

          [

            req.user.id,

            title,

            validation.value,

            memoryType,

            importance,

            source,

            sourceLabel,

            tags

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        throw new Error(
          "Long-term memory creation returned no record"
        );

      }


      const memory =
        sanitizeMemoryRecord(
          result.rows[0]
        );


      await systemLog(

        "info",

        "memory",

        "Long-term memory created",

        {

          userId:
            req.user.id,

          memoryId:
            memory.id,

          importance:
            memory.importance

        }

      );


      return res.status(201).json({

        success:
          true,

        memory

      });

    } catch (error) {

      console.error(
        "Create long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not create long-term memory",

        code:
          "LONG_TERM_MEMORY_CREATE_FAILED"

      });

    }

  }
);


// ============================================================
// LIST LONG-TERM MEMORY
// ============================================================

app.get(
  "/api/long-term-memory",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const limit =
        normalizeMemoryInteger(

          req.query?.limit,

          MEMORY_CONFIG
            .DEFAULT_RETRIEVAL_LIMIT,

          1,

          MEMORY_CONFIG
            .MAX_RETRIEVAL_LIMIT

        );


      const offset =
        normalizeMemoryInteger(

          req.query?.offset,

          0,

          0,

          Number.MAX_SAFE_INTEGER

        );


      const result =
        await pool.query(

          `SELECT
             *
           FROM long_term_memory
           WHERE user_id = $1
           ORDER BY
             importance DESC,
             updated_at DESC,
             id DESC
           LIMIT $2
           OFFSET $3`,

          [

            req.user.id,

            limit,

            offset

          ]

        );


      return res.json({

        success:
          true,

        memories:
          result.rows.map(
            sanitizeMemoryRecord
          ),

        pagination: {

          limit,

          offset,

          returned:
            result.rows.length

        }

      });

    } catch (error) {

      console.error(
        "List long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load long-term memories",

        code:
          "LONG_TERM_MEMORY_LIST_FAILED"

      });

    }

  }
);// ============================================================
// GET LONG-TERM MEMORY
// ============================================================

app.get(
  "/api/long-term-memory/:memoryId",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const memory =
        await resolveLongTermMemory(

          req.user.id,

          req.params.memoryId

        );


      if (!memory) {

        return res.status(404).json({

          success:
            false,

          error:
            "Long-term memory not found",

          code:
            "LONG_TERM_MEMORY_NOT_FOUND"

        });

      }


      try {

        await pool.query(

          `UPDATE long_term_memory
           SET
             last_accessed_at =
               CURRENT_TIMESTAMP
           WHERE id = $1
           AND user_id = $2`,

          [

            memory.id,

            req.user.id

          ]

        );

      } catch (
        accessError
      ) {

        console.error(

          "Long-term memory access update failed:",

          accessError

        );

      }


      return res.json({

        success:
          true,

        memory:
          sanitizeMemoryRecord(
            memory
          )

      });

    } catch (error) {

      console.error(
        "Get long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load long-term memory",

        code:
          "LONG_TERM_MEMORY_GET_FAILED"

      });

    }

  }
);


// ============================================================
// DELETE LONG-TERM MEMORY
// ============================================================

app.delete(
  "/api/long-term-memory/:memoryId",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await pool.query(

          `DELETE FROM long_term_memory
           WHERE id = $1
           AND user_id = $2
           RETURNING id`,

          [

            req.params.memoryId,

            req.user.id

          ]

        );


      if (
        result.rows.length ===
        0
      ) {

        return res.status(404).json({

          success:
            false,

          error:
            "Long-term memory not found",

          code:
            "LONG_TERM_MEMORY_NOT_FOUND"

        });

      }


      await systemLog(

        "info",

        "memory",

        "Long-term memory deleted",

        {

          userId:
            req.user.id,

          memoryId:
            result.rows[0].id

        }

      );


      return res.json({

        success:
          true,

        message:
          "Long-term memory deleted",

        memoryId:
          result.rows[0].id

      });

    } catch (error) {

      console.error(
        "Delete long-term memory error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not delete long-term memory",

        code:
          "LONG_TERM_MEMORY_DELETE_FAILED"

      });

    }

  }
);


// ============================================================
// MEMORY SEARCH
// ============================================================
//
// Searches both memory layers.
//
// Ownership remains mandatory.
//
// This endpoint is intended for the future AI Agent retrieval
// pipeline.
//

app.get(
  "/api/memory/search",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const query =
        normalizeMemorySearchQuery(
          req.query?.q
        );


      if (!query) {

        return res.status(400).json({

          success:
            false,

          error:
            "Memory search query is required",

          code:
            "MEMORY_SEARCH_QUERY_REQUIRED"

        });

      }


      const limit =
        normalizeMemoryInteger(

          req.query?.limit,

          20,

          1,

          50

        );


      const searchPattern =
        `%${query}%`;


      const userMemoryResult =
        await pool.query(

          `SELECT
             *,
             1 AS memory_layer
           FROM user_memory
           WHERE user_id = $1
           AND (
             content ILIKE $2
             OR title ILIKE $2
             OR source_label ILIKE $2
           )
           ORDER BY
             importance DESC,
             updated_at DESC
           LIMIT $3`,

          [

            req.user.id,

            searchPattern,

            limit

          ]

        );


      const longTermResult =
        await pool.query(

          `SELECT
             *,
             2 AS memory_layer
           FROM long_term_memory
           WHERE user_id = $1
           AND (
             content ILIKE $2
             OR title ILIKE $2
             OR source_label ILIKE $2
           )
           ORDER BY
             importance DESC,
             updated_at DESC
           LIMIT $3`,

          [

            req.user.id,

            searchPattern,

            limit

          ]

        );


      const results = [

        ...userMemoryResult.rows.map(
          memory => ({
            ...sanitizeMemoryRecord(
              memory
            ),
            memory_layer:
              "user"
          })
        ),

        ...longTermResult.rows.map(
          memory => ({
            ...sanitizeMemoryRecord(
              memory
            ),
            memory_layer:
              "long_term"
          })
        )

      ];


      results.sort(

        (
          a,
          b
        ) => {

          const importanceDifference =
            Number(
              b.importance || 0
            ) -
            Number(
              a.importance || 0
            );


          if (
            importanceDifference !==
            0
          ) {

            return importanceDifference;

          }


          const aTime =
            new Date(
              a.updated_at ||
              a.created_at ||
              0
            ).getTime();


          const bTime =
            new Date(
              b.updated_at ||
              b.created_at ||
              0
            ).getTime();


          return bTime - aTime;

        }

      );


      return res.json({

        success:
          true,

        query,

        results:
          results.slice(
            0,
            limit
          ),

        count:
          Math.min(
            results.length,
            limit
          )

      });

    } catch (error) {

      console.error(
        "Memory search error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not search memory",

        code:
          "MEMORY_SEARCH_FAILED"

      });

    }

  }
);


// ============================================================
// MEMORY STATISTICS
// ============================================================

app.get(
  "/api/memory/statistics",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const userMemoryStats =
        await pool.query(

          `SELECT

             COUNT(*)::integer
               AS total,

             COALESCE(
               AVG(importance),
               0
             ) AS average_importance,

             COUNT(
               CASE
                 WHEN importance >= 8
                 THEN 1
               END
             )::integer
               AS high_importance

           FROM user_memory

           WHERE user_id = $1`,

          [
            req.user.id
          ]

        );


      const longTermStats =
        await pool.query(

          `SELECT

             COUNT(*)::integer
               AS total,

             COALESCE(
               AVG(importance),
               0
             ) AS average_importance,

             COUNT(
               CASE
                 WHEN importance >= 8
                 THEN 1
               END
             )::integer
               AS high_importance

           FROM long_term_memory

           WHERE user_id = $1`,

          [
            req.user.id
          ]

        );


      const userStats =
        userMemoryStats
          .rows[0] || {};


      const longStats =
        longTermStats
          .rows[0] || {};


      return res.json({

        success:
          true,

        statistics: {

          userMemory: {

            total:
              Number(
                userStats.total || 0
              ),

            averageImportance:
              Number(
                userStats.average_importance ||
                0
              ),

            highImportance:
              Number(
                userStats.high_importance ||
                0
              )

          },

          longTermMemory: {

            total:
              Number(
                longStats.total || 0
              ),

            averageImportance:
              Number(
                longStats.average_importance ||
                0
              ),

            highImportance:
              Number(
                longStats.high_importance ||
                0
              )

          },

          total:

            Number(
              userStats.total || 0
            ) +

            Number(
              longStats.total || 0
            )

        }

      });

    } catch (error) {

      console.error(
        "Memory statistics error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not load memory statistics",

        code:
          "MEMORY_STATISTICS_FAILED"

      });

    }

  }
);

  // ============================================================
// AGENT MEMORY CONTEXT
// ============================================================
//
// This endpoint prepares a compact memory package for the
// future Nkwasibwe AI Agent.
//
// The Agent should NOT receive unlimited memory.
//
// Only relevant/high-value memories are returned.
//

app.get(
  "/api/memory/agent-context",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const limit =
        normalizeMemoryInteger(

          req.query?.limit,

          20,

          1,

          50

        );


      const query =
        normalizeMemorySearchQuery(
          req.query?.q
        );


      const pattern =
        query
          ? `%${query}%`
          : null;


      let userResult;


      let longTermResult;


      if (pattern) {

        userResult =
          await pool.query(

            `SELECT
               *
             FROM user_memory
             WHERE user_id = $1
             AND (
               content ILIKE $2
               OR title ILIKE $2
               OR source_label ILIKE $2
             )
             ORDER BY
               importance DESC,
               updated_at DESC
             LIMIT $3`,

            [

              req.user.id,

              pattern,

              limit

            ]

          );


        longTermResult =
          await pool.query(

            `SELECT
               *
             FROM long_term_memory
             WHERE user_id = $1
             AND (
               content ILIKE $2
               OR title ILIKE $2
               OR source_label ILIKE $2
             )
             ORDER BY
               importance DESC,
               updated_at DESC
             LIMIT $3`,

            [

              req.user.id,

              pattern,

              limit

            ]

          );

      } else {

        userResult =
          await pool.query(

            `SELECT
               *
             FROM user_memory
             WHERE user_id = $1
             ORDER BY
               importance DESC,
               updated_at DESC
             LIMIT $2`,

            [

              req.user.id,

              limit

            ]

          );


        longTermResult =
          await pool.query(

            `SELECT
               *
             FROM long_term_memory
             WHERE user_id = $1
             ORDER BY
               importance DESC,
               updated_at DESC
             LIMIT $2`,

            [

              req.user.id,

              limit

            ]

          );

      }


      const memories = [

        ...userResult.rows.map(

          memory => ({

            ...sanitizeMemoryRecord(
              memory
            ),

            memory_layer:
              "user"

          })

        ),

        ...longTermResult.rows.map(

          memory => ({

            ...sanitizeMemoryRecord(
              memory
            ),

            memory_layer:
              "long_term"

          })

        )

      ];


      memories.sort(

        (
          a,
          b
        ) => {

          return (

            Number(
              b.importance || 0
            ) -

            Number(
              a.importance || 0
            )

          );

        }

      );


      const selectedMemories =
        memories.slice(
          0,
          limit
        );


      return res.json({

        success:
          true,

        context: {

          userId:
            req.user.id,

          query:
            query || null,

          memoryCount:
            selectedMemories.length,

          memories:
            selectedMemories

        }

      });

    } catch (error) {

      console.error(
        "Agent memory context error:",
        error
      );


      await systemLog(

        "error",

        "memory",

        "Agent memory context failed",

        {

          userId:
            req.user?.id,

          message:
            error?.message

        }

      );


      return res.status(500).json({

        success:
          false,

        error:
          "Could not prepare agent memory context",

        code:
          "AGENT_MEMORY_CONTEXT_FAILED"

      });

    }

  }
);


// ============================================================
// MEMORY HEALTH CHECK
// ============================================================
//
// Internal diagnostic endpoint.
//

app.get(
  "/api/memory/health",
  authenticateToken,
  async (
    req,
    res
  ) => {

    try {

      const result =
        await pool.query(

          `SELECT
             (
               SELECT COUNT(*)
               FROM user_memory
               WHERE user_id = $1
             )::integer
             AS user_memory_count,

             (
               SELECT COUNT(*)
               FROM long_term_memory
               WHERE user_id = $1
             )::integer
             AS long_term_memory_count`,

          [
            req.user.id
          ]

        );


      const row =
        result.rows[0] || {};


      return res.json({

        success:
          true,

        memory:

          "operational",

        userMemoryCount:
          Number(
            row.user_memory_count ||
            0
          ),

        longTermMemoryCount:
          Number(
            row.long_term_memory_count ||
            0
          )

      });

    } catch (error) {

      console.error(
        "Memory health error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        memory:
          "unavailable",

        error:
          "Memory system unavailable",

        code:
          "MEMORY_HEALTH_FAILED"

      });

    }

  }
);


// ============================================================
// PART 6 COMPLETE
// ============================================================
//
// MEMORY ENGINE NOW PROVIDES:
//
// ✓ User memory creation
// ✓ User memory listing
// ✓ User memory retrieval
// ✓ User memory update
// ✓ User memory deletion
// ✓ Long-term memory creation
// ✓ Long-term memory listing
// ✓ Long-term memory retrieval
// ✓ Long-term memory deletion
// ✓ Memory search
// ✓ Memory statistics
// ✓ Agent memory context
// ✓ Memory health check
// ✓ Importance scoring
// ✓ Memory types
// ✓ Tags
// ✓ Memory source tracking
// ✓ Ownership enforcement
// ✓ Input validation
// ✓ SQL parameterization
// ✓ Access timestamp tracking
// ✓ Security logging
//
// ============================================================
