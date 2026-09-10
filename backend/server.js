const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const config = require("./config");
const pool = require("./db/pool");
const createSchema = require("./db/schema");

// ============================================================
// APP
// ============================================================

const app = express();

const PORT = Number(config.port) || 3000;
const JWT_SECRET = config.jwtSecret;
if (!config.databaseUrl) {
  console.error(
    "[CONFIG ERROR] DATABASE_URL is missing."
  );
}

if (!config.jwtSecret) {
  console.error(
    "[CONFIG ERROR] JWT_SECRET is missing."
  );
}

if (!config.openaiApiKey) {
  console.warn(
    "[CONFIG WARNING] OPENAI_API_KEY is missing."
  );
}
app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "10mb" }));


// ============================================================
// AI PROVIDER ENGINE
// NKWASIBWE IRHCF
//
// Architecture:
//
// Request
//   ↓
// Provider Router
//   ↓
// Gemini
//   ↓
// Groq
//   ↓
// OpenAI
//   ↓
// Normalized AI Result
//
// Important:
// - API keys never leave backend.
// - One provider failure must not automatically kill the task.
// - Providers are isolated from the Agent Engine.
// - New providers can be added without rewriting /api/chat.
// ============================================================

// ------------------------------------------------------------
// PROVIDER ENVIRONMENT
// ------------------------------------------------------------

const AI_PROVIDER_CONFIG = Object.freeze({

  gemini: {
    name: "gemini",

    apiKey:
      process.env.GEMINI_API_KEY || "",

    model:
      process.env.GEMINI_MODEL ||
      "gemini-3.7-flash",

    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models",

    timeoutMs:
      Number(
        process.env.GEMINI_TIMEOUT_MS
      ) || 45000
  },

  groq: {
    name: "groq",

    apiKey:
      process.env.GROQ_API_KEY || "",

    model:
      process.env.GROQ_MODEL ||
      "llama-3.3-70b-versatile",

    endpoint:
      "https://api.groq.com/openai/v1/chat/completions",

    timeoutMs:
      Number(
        process.env.GROQ_TIMEOUT_MS
      ) || 30000
  },

  openai: {
    name: "openai",

    apiKey:
      config.openaiApiKey ||
      process.env.OPENAI_API_KEY ||
      "",

    model:
      process.env.OPENAI_MODEL ||
      config.openaiModel ||
      "gpt-4o-mini",

    endpoint:
      "https://api.openai.com/v1/chat/completions",

    timeoutMs:
      Number(
        process.env.OPENAI_TIMEOUT_MS
      ) || 30000
  }

});


// ------------------------------------------------------------
// PROVIDER ORDER
//
// The order matters.
//
// We deliberately put providers with available keys first.
// OpenAI remains available as a fallback rather than being
// hard-coded as the only intelligence source.
// ------------------------------------------------------------

const AI_PROVIDER_ORDER = [
  "gemini",
  "groq",
  "openai"
];


// ------------------------------------------------------------
// PROVIDER RUNTIME STATE
//
// This allows Nkwasibwe to remember provider failures during
// the current server lifetime.
//
// Later this can be moved into PostgreSQL so provider health
// survives server restarts.
// ------------------------------------------------------------

const providerRuntime = {

  gemini: {
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    disabledUntil: null
  },

  groq: {
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    disabledUntil: null
  },

  openai: {
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    disabledUntil: null
  }

};


// ------------------------------------------------------------
// PROVIDER POLICY
//
// This is intentionally centralized.
//
// Later we can make this configurable per task type.
// ------------------------------------------------------------

const AI_PROVIDER_POLICY = Object.freeze({

  maxAttemptsPerRequest: 3,

  providerCooldownMs:
    30 * 1000,

  requestTimeoutMs:
    45000,

  maxInputCharacters:
    120000,

  maxOutputTokens:
    4096,

  temperature:
    0.7

});


// ============================================================
// GENERIC HELPERS
// ============================================================

function providerHasKey(providerName) {

  const provider =
    AI_PROVIDER_CONFIG[
      providerName
    ];

  return Boolean(
    provider &&
    provider.apiKey
  );

}


function providerIsCoolingDown(
  providerName
) {

  const state =
    providerRuntime[
      providerName
    ];

  if (!state) {
    return false;
  }

  if (!state.disabledUntil) {
    return false;
  }

  return (
    Date.now() <
    state.disabledUntil
  );

}


function markProviderSuccess(
  providerName
) {

  const state =
    providerRuntime[
      providerName
    ];

  if (!state) {
    return;
  }

  state.consecutiveFailures = 0;
  state.lastFailureAt = null;
  state.lastErrorCode = null;
  state.lastSuccessAt =
    new Date().toISOString();
  state.disabledUntil = null;

}


function markProviderFailure(
  providerName,
  error
) {

  const state =
    providerRuntime[
      providerName
    ];

  if (!state) {
    return;
  }

  state.consecutiveFailures += 1;

  state.lastFailureAt =
    new Date().toISOString();

  state.lastErrorCode =
    error &&
    error.code
      ? String(error.code)
      : "UNKNOWN_PROVIDER_ERROR";

  /*
   * We do not permanently disable a provider.
   *
   * A temporary cooldown lets the router recover automatically.
   */

  if (
    state.consecutiveFailures >= 2
  ) {

    state.disabledUntil =
      Date.now() +
      AI_PROVIDER_POLICY.providerCooldownMs;

  }

}


// ============================================================
// ABORT / TIMEOUT
// ============================================================

function createTimeoutController(
  timeoutMs
) {

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  return {
    controller,
    timer
  };

}


// ============================================================
// NORMALIZED PROVIDER ERROR
// ============================================================

function createProviderError(
  provider,
  code,
  message,
  status = null,
  originalError = null
) {

  const error =
    new Error(message);

  error.provider =
    provider;

  error.code =
    code;

  error.status =
    status;

  error.originalError =
    originalError;

  return error;

}


// ============================================================
// GEMINI PROVIDER
// ============================================================

async function callGeminiProvider(
  messages
) {

  const provider =
    AI_PROVIDER_CONFIG.gemini;

  if (!provider.apiKey) {

    throw createProviderError(
      "gemini",
      "PROVIDER_NOT_CONFIGURED",
      "Gemini API key is not configured."
    );

  }

  /*
   * Gemini expects system instructions separately from the
   * conversational contents.
   */

  let systemInstruction = "";

  const contents = [];

  for (
    const message
    of messages
  ) {

    if (
      message.role ===
      "system"
    ) {

      systemInstruction +=
        (
          systemInstruction
            ? "\n\n"
            : ""
        ) +
        String(
          message.content || ""
        );

      continue;
    }

    const role =
      message.role ===
      "assistant"
        ? "model"
        : "user";

    contents.push({

      role,

      parts: [
        {
          text:
            String(
              message.content || ""
            )
        }
      ]

    });

  }


  const body = {

    system_instruction:
      systemInstruction
        ? {
            parts: [
              {
                text:
                  systemInstruction
              }
            ]
          }
        : undefined,

    contents,

    generationConfig: {

      temperature:
        AI_PROVIDER_POLICY.temperature,

      maxOutputTokens:
        AI_PROVIDER_POLICY.maxOutputTokens

    }

  };


  const timeout =
    createTimeoutController(
      provider.timeoutMs
    );


  try {

    const response =
      await fetch(
        `${provider.endpoint}/${encodeURIComponent(
          provider.model
        )}:generateContent`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              provider.apiKey
          },

          body:
            JSON.stringify(body),

          signal:
            timeout.controller.signal
        }
      );


    let data = null;

    try {

      data =
        await response.json();

    } catch (parseError) {

      throw createProviderError(
        "gemini",
        "INVALID_PROVIDER_RESPONSE",
        "Gemini returned an invalid JSON response.",
        response.status,
        parseError
      );

    }


    if (!response.ok) {

      const providerMessage =
        data &&
        data.error &&
        data.error.message
          ? data.error.message
          : "Gemini request failed.";

      throw createProviderError(
        "gemini",
        classifyProviderHttpError(
          response.status,
          data
        ),
        providerMessage,
        response.status,
        data
      );

    }


    const candidates =
      data &&
      Array.isArray(
        data.candidates
      )
        ? data.candidates
        : [];


    const firstCandidate =
      candidates.length > 0
        ? candidates[0]
        : null;


    const parts =
      firstCandidate &&
      firstCandidate.content &&
      Array.isArray(
        firstCandidate.content.parts
      )
        ? firstCandidate.content.parts
        : [];


    const text =
      parts
        .map(
          part =>
            part &&
            typeof part.text ===
              "string"
              ? part.text
              : ""
        )
        .filter(Boolean)
        .join("\n");


    if (!text.trim()) {

      throw createProviderError(
        "gemini",
        "EMPTY_PROVIDER_RESPONSE",
        "Gemini returned an empty response.",
        response.status,
        data
      );

    }


    return {

      provider:
        "gemini",

      model:
        provider.model,

      text:
        text.trim(),

      raw:
        data,

      usage:
        data &&
        data.usageMetadata
          ? data.usageMetadata
          : null

    };

  } catch (error) {

    if (
      error &&
      error.name ===
        "AbortError"
    ) {

      throw createProviderError(
        "gemini",
        "PROVIDER_TIMEOUT",
        "Gemini request timed out."
      );

    }

    throw error;

  } finally {

    clearTimeout(
      timeout.timer
    );

  }

}


// ============================================================
// GROQ PROVIDER
// ============================================================

async function callGroqProvider(
  messages
) {

  const provider =
    AI_PROVIDER_CONFIG.groq;

  if (!provider.apiKey) {

    throw createProviderError(
      "groq",
      "PROVIDER_NOT_CONFIGURED",
      "Groq API key is not configured."
    );

  }


  const timeout =
    createTimeoutController(
      provider.timeoutMs
    );


  try {

    const response =
      await fetch(
        provider.endpoint,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${provider.apiKey}`

          },

          body:
            JSON.stringify({

              model:
                provider.model,

              messages:

                messages.map(
                  item => ({

                    role:
                      item.role,

                    content:
                      String(
                        item.content || ""
                      )

                  })
                ),

              temperature:
                AI_PROVIDER_POLICY.temperature,

              max_tokens:
                AI_PROVIDER_POLICY.maxOutputTokens

            }),

          signal:
            timeout.controller.signal

        }
      );


    let data = null;

    try {

      data =
        await response.json();

    } catch (parseError) {

      throw createProviderError(
        "groq",
        "INVALID_PROVIDER_RESPONSE",
        "Groq returned an invalid JSON response.",
        response.status,
        parseError
      );

    }


    if (!response.ok) {

      const providerMessage =
        data &&
        data.error &&
        data.error.message
          ? data.error.message
          : "Groq request failed.";

      throw createProviderError(
        "groq",
        classifyProviderHttpError(
          response.status,
          data
        ),
        providerMessage,
        response.status,
        data
      );

    }


    const choices =
      data &&
      Array.isArray(
        data.choices
      )
        ? data.choices
        : [];


    const firstChoice =
      choices.length > 0
        ? choices[0]
        : null;


    const text =
      firstChoice &&
      firstChoice.message &&
      typeof firstChoice.message.content ===
        "string"
        ? firstChoice.message.content
        : "";


    if (!text.trim()) {

      throw createProviderError(
        "groq",
        "EMPTY_PROVIDER_RESPONSE",
        "Groq returned an empty response.",
        response.status,
        data
      );

    }


    return {

      provider:
        "groq",

      model:
        provider.model,

      text:
        text.trim(),

      raw:
        data,

      usage:
        data &&
        data.usage
          ? data.usage
          : null

    };

  } catch (error) {

    if (
      error &&
      error.name ===
        "AbortError"
    ) {

      throw createProviderError(
        "groq",
        "PROVIDER_TIMEOUT",
        "Groq request timed out."
      );

    }

    throw error;

  } finally {

    clearTimeout(
      timeout.timer
    );

  }

}


// ============================================================
// OPENAI PROVIDER
// ============================================================

async function callOpenAIProvider(
  messages
) {

  const provider =
    AI_PROVIDER_CONFIG.openai;

  if (!provider.apiKey) {

    throw createProviderError(
      "openai",
      "PROVIDER_NOT_CONFIGURED",
      "OpenAI API key is not configured."
    );

  }


  const timeout =
    createTimeoutController(
      provider.timeoutMs
    );


  try {

    const response =
      await fetch(
        provider.endpoint,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${provider.apiKey}`

          },

          body:
            JSON.stringify({

              model:
                provider.model,

              messages:

                messages.map(
                  item => ({

                    role:
                      item.role,

                    content:
                      String(
                        item.content || ""
                      )

                  })
                ),

              temperature:
                AI_PROVIDER_POLICY.temperature,

              max_tokens:
                AI_PROVIDER_POLICY.maxOutputTokens

            }),

          signal:
            timeout.controller.signal

        }
      );


    let data = null;

    try {

      data =
        await response.json();

    } catch (parseError) {

      throw createProviderError(
        "openai",
        "INVALID_PROVIDER_RESPONSE",
        "OpenAI returned an invalid JSON response.",
        response.status,
        parseError
      );

    }


    if (!response.ok) {

      const providerMessage =
        data &&
        data.error &&
        data.error.message
          ? data.error.message
          : "OpenAI request failed.";

      throw createProviderError(
        "openai",
        classifyProviderHttpError(
          response.status,
          data
        ),
        providerMessage,
        response.status,
        data
      );

    }


    const choices =
      data &&
      Array.isArray(
        data.choices
      )
        ? data.choices
        : [];


    const firstChoice =
      choices.length > 0
        ? choices[0]
        : null;


    const text =
      firstChoice &&
      firstChoice.message &&
      typeof firstChoice.message.content ===
        "string"
        ? firstChoice.message.content
        : "";


    if (!text.trim()) {

      throw createProviderError(
        "openai",
        "EMPTY_PROVIDER_RESPONSE",
        "OpenAI returned an empty response.",
        response.status,
        data
      );

    }


    return {

      provider:
        "openai",

      model:
        provider.model,

      text:
        text.trim(),

      raw:
        data,

      usage:
        data &&
        data.usage
          ? data.usage
          : null

    };

  } catch (error) {

    if (
      error &&
      error.name ===
        "AbortError"
    ) {

      throw createProviderError(
        "openai",
        "PROVIDER_TIMEOUT",
        "OpenAI request timed out."
      );

    }

    throw error;

  } finally {

    clearTimeout(
      timeout.timer
    );

  }

}


// ============================================================
// PROVIDER ERROR CLASSIFICATION
// ============================================================

function classifyProviderHttpError(
  status,
  data
) {

  const providerCode =
    data &&
    data.error &&
    data.error.code
      ? String(
          data.error.code
        ).toLowerCase()
      : "";


  if (
    providerCode.includes(
      "quota"
    ) ||
    providerCode.includes(
      "credit"
    ) ||
    providerCode.includes(
      "resource_exhausted"
    )
  ) {

    return "QUOTA_EXHAUSTED";

  }


  if (status === 401) {
    return "PROVIDER_AUTH_ERROR";
  }


  if (status === 403) {
    return "PROVIDER_FORBIDDEN";
  }


  if (status === 404) {
    return "PROVIDER_MODEL_NOT_FOUND";
  }


  if (status === 408) {
    return "PROVIDER_TIMEOUT";
  }


  if (status === 429) {
    return "PROVIDER_RATE_LIMITED";
  }


  if (
    status >= 500 &&
    status <= 599
  ) {

    return "PROVIDER_SERVER_ERROR";

  }


  return "PROVIDER_REQUEST_ERROR";

}


// ============================================================
// PROVIDER ADAPTER
// ============================================================

async function callAIProvider(
  providerName,
  messages
) {

  switch (
    providerName
  ) {

    case "gemini":

      return callGeminiProvider(
        messages
      );

    case "groq":

      return callGroqProvider(
        messages
      );

    case "openai":

      return callOpenAIProvider(
        messages
      );

    default:

      throw createProviderError(
        providerName,
        "UNKNOWN_PROVIDER",
        `Unknown AI provider: ${providerName}`
      );

  }

}


// ============================================================
// PROVIDER ROUTER
// ============================================================

async function generateAIResponse(
  messages,
  options = {}
) {

  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {

    throw createProviderError(
      "router",
      "INVALID_MESSAGES",
      "AI messages are required."
    );

  }


  const estimatedCharacters =
    messages.reduce(
      (
        total,
        message
      ) => {

        return (
          total +
          String(
            message.content || ""
          ).length
        );

      },
      0
    );


  if (
    estimatedCharacters >
    AI_PROVIDER_POLICY.maxInputCharacters
  ) {

    throw createProviderError(
      "router",
      "INPUT_TOO_LARGE",
      "AI input is too large."
    );

  }


  let providerOrder =
    Array.isArray(
      options.providers
    ) &&
    options.providers.length > 0
      ? options.providers
      : AI_PROVIDER_ORDER;


  /*
   * Remove duplicate providers while preserving order.
   */

  providerOrder =
    providerOrder.filter(
      (
        provider,
        index,
        array
      ) =>
        array.indexOf(
          provider
        ) === index
    );


  const attempts = [];

  let attemptsCount = 0;


  for (
    const providerName
    of providerOrder
  ) {

    if (
      attemptsCount >=
      AI_PROVIDER_POLICY.maxAttemptsPerRequest
    ) {

      break;

    }


    if (
      !AI_PROV
// ============================================================
// HELPERS
// ============================================================

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeImportance(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.min(
    10,
    Math.max(1, Math.round(number))
  );
}

function safeMetadata(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

// ============================================================
// LOGGING
// ============================================================

async function systemLog(
  level,
  component,
  message,
  metadata = {}
) {
  try {
    await pool.query(
      `INSERT INTO system_logs
       (
         level,
         component,
         message,
         metadata
       )
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        String(level),
        String(component),
        String(message),
        JSON.stringify(
          safeMetadata(metadata)
        )
      ]
    );
  } catch (error) {
    console.error(
      "Logging error:",
      error.message
    );
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function authenticateToken(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({
      success: false,
      error:
        "Authentication is not configured"
    });
  }

  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const token =
    authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error:
        "Authentication required"
    });
  }

  try {
    req.user = jwt.verify(
      token,
      JWT_SECRET
    );

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error:
        "Invalid or expired token"
    });
  }
}

// ============================================================
// DATABASE INITIALIZATION
// ============================================================

async function initializeDatabase() {
  console.log(
    "Initializing database..."
  );

  const client = await pool.connect();

  try {
    await client.query("SELECT 1");

    console.log(
      "PostgreSQL connection successful."
    );
  } finally {
    client.release();
  }

  await createSchema();

  console.log(
    "Database schema initialization complete."
  );
}

// ============================================================
// HOME
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Nkwasibwe IRHCF",
    message:
      "Nkwasibwe IRHCF AI Agent Platform backend is running!",
    version: "1.0.0",
    timestamp:
      new Date().toISOString()
  });
});

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await pool.query("SELECT 1");

      res.json({
        success: true,
        status: "ok",
        database: "connected",
        ai: openai
          ? "configured"
          : "not_configured",
        authentication: JWT_SECRET
          ? "configured"
          : "not_configured",
        environment:
          config.environment,
        timestamp:
          new Date().toISOString()
      });
    } catch (error) {
      console.error(
        "Health check error:",
        error.message
      );

      res.status(500).json({
        success: false,
        status: "error",
        database: "disconnected"
      });
    }
  }
);

// ============================================================
// REGISTER
// ============================================================

app.post(
  "/api/register",
  async (req, res) => {
    try {
      const name =
        normalizeText(req.body?.name);

      const email =
        normalizeText(
          req.body?.email
        ).toLowerCase();

      const password =
        typeof req.body?.password ===
        "string"
          ? req.body.password
          : "";

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error:
            "Name, email and password are required"
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          error:
            "Name is too long"
        });
      }

      if (email.length > 255) {
        return res.status(400).json({
          success: false,
          error:
            "Email is too long"
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error:
            "Password must be at least 8 characters"
        });
      }

      const existing =
        await pool.query(
          `SELECT id
           FROM users
           WHERE email = $1`,
          [email]
        );

      if (
        existing.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          error:
            "Email is already registered"
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const result =
        await pool.query(
          `INSERT INTO users
           (
             name,
             email,
             password_hash
           )
           VALUES ($1, $2, $3)
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

      const user =
        result.rows[0];

      const token =
        createToken(user);

      await systemLog(
        "info",
        "authentication",
        "New user registered",
        {
          userId: user.id
        }
      );
      
      res.status(201).json({
        success: true,
        message:
          "Account created successfully",
        token,
        user
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
        "table:",
        error?.table
      );

      console.error(
        "column:",
        error?.column
      );

      console.error(
        "Register full error:",
        error
      );

      console.error(
        "================================"
      );

      res.status(500).json({
        success: false,
        error:
          "Could not create account"
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
        normalizeText(
          req.body?.email
        ).toLowerCase();

      const password =
        typeof req.body?.password ===
        "string"
          ? req.body.password
          : "";

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error:
            "Email and password are required"
        });
      }

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
           WHERE email = $1`,
          [email]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password"
        });
      }

      const user =
        result.rows[0];

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password"
        });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at:
          user.created_at,
        updated_at:
          user.updated_at
      };

      const token =
        createToken(safeUser);

      await systemLog(
        "info",
        "authentication",
        "User logged in",
        {
          userId: safeUser.id
        }
      );

      res.json({
        success: true,
        message:
          "Login successful",
        token,
        user: safeUser
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not login"
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
           WHERE id = $1`,
          [req.user.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "User not found"
        });
      }

      res.json({
        success: true,
        user:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Current user error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not get user"
      });
    }
  }
);

// ============================================================
// CREATE CONVERSATION
// ============================================================

app.post(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const title =
        normalizeText(
          req.body?.title
        ).slice(0, 200) ||
        "New conversation";

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
           VALUES ($1, $2, $3)
           RETURNING *`,
          [
            req.user.id,
            sessionId,
            title
          ]
        );

      res.status(201).json({
        success: true,
        conversation:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Create conversation error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not create conversation"
      });
    }
  }
);

// ============================================================
// LIST CONVERSATIONS
// ============================================================

app.get(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {
    try {
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
           ORDER BY updated_at DESC`,
          [req.user.id]
        );

      res.json({
        success: true,
        conversations:
          result.rows
      });
    } catch (error) {
      console.error(
        "List conversations error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load conversation history"
      });
    }
  }
);

// ============================================================
// GET CONVERSATION
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

      const conversationResult =
        await pool.query(
          `SELECT *
           FROM conversations
           WHERE user_id = $1
           AND session_id = $2`,
          [
            req.user.id,
            sessionId
          ]
        );

      if (
        conversationResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Conversation not found"
        });
      }

      const conversation =
        conversationResult.rows[0];

      const messagesResult =
        await pool.query(
          `SELECT
             id,
             role,
             content,
             created_at
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC`,
          [conversation.id]
        );

      res.json({
        success: true,
        conversation,
        messages:
          messagesResult.rows
      });
    } catch (error) {
      console.error(
        "Get conversation error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load conversation"
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
      const result =
        await pool.query(
          `DELETE FROM conversations
           WHERE user_id = $1
           AND session_id = $2
           RETURNING id`,
          [
            req.user.id,
            req.params.sessionId
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Conversation not found"
        });
      }

      res.json({
        success: true,
        message:
          "Conversation deleted"
      });
    } catch (error) {
      console.error(
        "Delete conversation error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not delete conversation"
      });
    }
  }
);

// ============================================================
// PERSISTENT MEMORY
// ============================================================

app.post(
  "/api/memory",
  authenticateToken,
  async (req, res) => {
    try {
      const key =
        normalizeText(req.body?.key);

      const value =
        normalizeText(
          req.body?.value
        );

      const type =
        normalizeText(
          req.body?.type
        ) || "general";

      const importance =
        normalizeImportance(
          req.body?.importance
        );

      if (!key || !value) {
        return res.status(400).json({
          success: false,
          error:
            "Memory key and value are required"
        });
      }

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
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT
           (user_id, memory_key)
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
            key,
            value,
            type,
            importance
          ]
        );

      res.status(201).json({
        success: true,
        memory:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Save memory error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not save memory"
      });
    }
  }
);

app.get(
  "/api/memory",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT *
           FROM user_memory
           WHERE user_id = $1
           ORDER BY
             importance DESC,
             updated_at DESC`,
          [req.user.id]
        );

      res.json({
        success: true,
        memories:
          result.rows
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          "Could not load memory"
      });
    }
  }
);

app.delete(
  "/api/memory/:key",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `DELETE FROM user_memory
           WHERE user_id = $1
           AND memory_key = $2
           RETURNING id`,
          [
            req.user.id,
            req.params.key
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Memory not found"
        });
      }

      res.json({
        success: true,
        message:
          "Memory deleted"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          "Could not delete memory"
      });
    }
  }
);

// ============================================================
// LONG-TERM MEMORY
// ============================================================

app.post(
  "/api/long-term-memory",
  authenticateToken,
  async (req, res) => {
    try {
      const content =
        normalizeText(
          req.body?.content
        );

      const type =
        normalizeText(
          req.body?.type
        ) || "general";

      const importance =
        normalizeImportance(
          req.body?.importance
        );

      const source =
        normalizeText(
          req.body?.source
        ) || "user";

      if (!content) {
        return res.status(400).json({
          success: false,
          error:
            "Content is required"
        });
      }

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
           ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            req.user.id,
            content,
            type,
            importance,
            source
          ]
        );

      res.status(201).json({
        success: true,
        memory:
          result.rows[0]      });
    } catch (error) {
      console.error(
        "Save long-term memory error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not save long-term memory"
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
      const result =
        await pool.query(
          `SELECT *
           FROM long_term_memory
           WHERE user_id = $1
           ORDER BY
             importance DESC,
             updated_at DESC`,
          [req.user.id]
        );

      res.json({
        success: true,
        memories: result.rows
      });
    } catch (error) {
      console.error(
        "Load long-term memory error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load long-term memory"
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
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid memory ID"
        });
      }

      const result =
        await pool.query(
          `DELETE FROM long_term_memory
           WHERE id = $1
           AND user_id = $2
           RETURNING id`,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Long-term memory not found"
        });
      }

      res.json({
        success: true,
        message:
          "Long-term memory deleted"
      });
    } catch (error) {
      console.error(
        "Delete long-term memory error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not delete long-term memory"
      });
    }
  }
);

// ============================================================
// KNOWLEDGE BASE
// ============================================================

app.post(
  "/api/knowledge",
  authenticateToken,
  async (req, res) => {
    try {
      const title =
        normalizeText(
          req.body?.title
        );

      const content =
        normalizeText(
          req.body?.content
        );

      const source =
        normalizeText(
          req.body?.source
        );

      const sourceType =
        normalizeText(
          req.body?.source_type
        ) || "text";

      const metadata =
        safeMetadata(
          req.body?.metadata
        );

      if (!content) {
        return res.status(400).json({
          success: false,
          error:
            "Knowledge content is required"
        });
      }

      const result =
        await pool.query(
          `INSERT INTO knowledge
           (
             user_id,
             title,
             content,
             source,
             source_type,
             metadata
           )
           VALUES
           ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING *`,
          [
            req.user.id,
            title || null,
            content,
            source || null,
            sourceType,
            JSON.stringify(metadata)
          ]
        );

      res.status(201).json({
        success: true,
        knowledge:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Save knowledge error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not save knowledge"
      });
    }
  }
);

// ============================================================
// LIST KNOWLEDGE
// ============================================================

app.get(
  "/api/knowledge",
  authenticateToken,
  async (req, res) => {
    try {
      const limitValue =
        Number(req.query.limit);

      const limit =
        Number.isInteger(limitValue)
          ? Math.min(
              Math.max(limitValue, 1),
              100
            )
          : 50;

      const result =
        await pool.query(
          `SELECT *
           FROM knowledge
           WHERE
             user_id = $1
             OR user_id IS NULL
           ORDER BY
             updated_at DESC
           LIMIT $2`,
          [
            req.user.id,
            limit
          ]
        );

      res.json({
        success: true,
        knowledge:
          result.rows
      });
    } catch (error) {
      console.error(
        "Load knowledge error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load knowledge"
      });
    }
  }
);

// ============================================================
// GET KNOWLEDGE ITEM
// ============================================================

app.get(
  "/api/knowledge/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid knowledge ID"
        });
      }

      const result =
        await pool.query(
          `SELECT *
           FROM knowledge
           WHERE id = $1
           AND (
             user_id = $2
             OR user_id IS NULL
           )`,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Knowledge not found"
        });
      }

      res.json({
        success: true,
        knowledge:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Get knowledge error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load knowledge"
      });
    }
  }
);

// ============================================================
// DELETE KNOWLEDGE
// ============================================================

app.delete(
  "/api/knowledge/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid knowledge ID"
        });
      }

      const result =
        await pool.query(
          `DELETE FROM knowledge
           WHERE id = $1
           AND user_id = $2
           RETURNING id`,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Knowledge not found"
        });
      }

      res.json({
        success: true,
        message:
          "Knowledge deleted"
      });
    } catch (error) {
      console.error(
        "Delete knowledge error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not delete knowledge"
      });
    }
  }
);

// ============================================================
// TASK MANAGEMENT
// ============================================================

app.post(
  "/api/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      const task =
        normalizeText(
          req.body?.task
        );

      const priority =
        normalizeImportance(
          req.body?.priority
        );

      const metadata =
        safeMetadata(
          req.body?.metadata
        );

      if (!task) {
        return res.status(400).json({
          success: false,
          error:
            "Task is required"
        });
      }

      const result =
        await pool.query(
          `INSERT INTO tasks
           (
             user_id,
             task,
             priority,
             metadata
           )
           VALUES
           ($1, $2, $3, $4::jsonb)
           RETURNING *`,
          [
            req.user.id,
            task,
            priority,
            JSON.stringify(metadata)
          ]
        );

      await systemLog(
        "info",
        "tasks",
        "Task created",
        {
          userId:
            req.user.id,
          taskId:
            result.rows[0].id
        }
      );

      res.status(201).json({
        success: true,
        task:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Create task error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not create task"
      });
    }
  }
);

// ============================================================
// LIST TASKS
// ============================================================

app.get(
  "/api/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT *
           FROM tasks
           WHERE user_id = $1
           ORDER BY
             created_at DESC`,
          [req.user.id]
        );

      res.json({
        success: true,
        tasks: result.rows
      });
    } catch (error) {
      console.error(
        "Load tasks error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load tasks"
      });
    }
  }
);

// ============================================================
// GET TASK
// ============================================================

app.get(
  "/api/tasks/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid task ID"
        });
      }

      const result =
        await pool.query(
          `SELECT *
           FROM tasks
           WHERE id = $1
           AND user_id = $2`,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Task not found"
        });
      }

      res.json({
        success: true,
        task:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Get task error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load task"
      });
    }
  }
);

// ============================================================
// UPDATE TASK
// ============================================================

app.patch(
  "/api/tasks/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid task ID"
        });
      }

      const allowedStatuses = [
        "pending",
        "planning",
        "running",
        "completed",
        "failed",
        "cancelled"
      ];

      const requestedStatus =
        normalizeText(
          req.body?.status
        );

      if (
        requestedStatus &&
        !allowedStatuses.includes(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid task status"
        });
      }

      const resultText =
        typeof req.body?.result ===
        "string"
          ? req.body.result
          : null;

      const errorText =
        typeof req.body?.error ===
        "string"
          ? req.body.error
          : null;

      const result =
        await pool.query(
          `UPDATE tasks
           SET
             status =
               COALESCE(
                 $1,
                 status
               ),
             result =
               COALESCE(
                 $2,
                 result
               ),
             error =
               COALESCE(
                 $3,
                 error
               ),
             updated_at =
               CURRENT_TIMESTAMP
           WHERE id = $4
           AND user_id = $5
           RETURNING *`,
          [
            requestedStatus || null,
            resultText,
            errorText,
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Task not found"
        });
      }

      res.json({
        success: true,
        task:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Update task error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not update task"
      });
    }
  }
);

// ============================================================
// DELETE TASK
// ============================================================

app.delete(
  "/api/tasks/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid task ID"
        });
      }

      const result =
        await pool.query(
          `DELETE FROM tasks
           WHERE id = $1
           AND user_id = $2
           RETURNING id`,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Task not found"
        });
      }

      res.json({
        success: true,
        message:
          "Task deleted"
      });
    } catch (error) {
      console.error(
        "Delete task error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not delete task"
      });
    }
  }
);

// ============================================================
// CAPABILITIES
// ============================================================

app.get(
  "/api/capabilities",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             id,
             name,
             description,
             category,
             module_path,
             enabled,
             version,
             metadata,
             created_at,
             updated_at
           FROM capabilities
           WHERE enabled = TRUE
           ORDER BY category, name`
        );

      res.json({
        success: true,
        capabilities:
          result.rows
      });
    } catch (error) {
      console.error(
        "Load capabilities error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load capabilities"
      });
    }
  }
);

// ============================================================
// TOOLS
// ============================================================

app.get(
  "/api/tools",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             id,
             name,
             description,
             category,
             enabled,
             requires_auth,
             input_schema,
             version,
             metadata
           FROM tools
           WHERE enabled = TRUE
           ORDER BY category, name`
        );

      res.json({
        success: true,
        tools: result.rows
      });
    } catch (error) {
      console.error(
        "Load tools error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load tools"
      });
    }
  }
);

// ============================================================
// AGENT RUNS
// ============================================================

app.post(
  "/api/agent-runs",
  authenticateToken,
  async (req, res) => {
    try {
      const goal =
        normalizeText(
          req.body?.goal
        );

      const taskId =
        Number(req.body?.taskId);

      const metadata =
        safeMetadata(
          req.body?.metadata
        );

      if (!goal) {
        return res.status(400).json({
          success: false,
          error:
            "Agent goal is required"
        });
      }

      let validTaskId = null;

      if (
        Number.isInteger(taskId) &&
        taskId > 0
      ) {
        const taskCheck =
          await pool.query(
            `SELECT id
             FROM tasks
             WHERE id = $1
             AND user_id = $2`,
            [
              taskId,
              req.user.id
            ]
          );

        if (
          taskCheck.rows.length === 0
        ) {
          return res.status(404).json({
            success: false,
            error:
              "Task not found"
          });
        }

        validTaskId = taskId;
      }

      const result =
        await pool.query(
          `INSERT INTO agent_runs
           (
             user_id,
             task_id,
             goal,
             status,
             metadata
           )
           VALUES
           (
             $1,
             $2,
             $3,
             'planning',
             $4::jsonb
           )
           RETURNING *`,
          [
            req.user.id,
            validTaskId,
            goal,
            JSON.stringify(metadata)
          ]
        );

      res.status(201).json({
        success: true,
        agentRun:
          result.rows[0]
      });
    } catch (error) {
      console.error(
        "Create agent run error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not create agent run"
      });
    }
  }
);

// ============================================================
// LIST AGENT RUNS
// ============================================================

app.get(
  "/api/agent-runs",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT *
           FROM agent_runs
           WHERE user_id = $1
           ORDER BY started_at DESC`,
          [req.user.id]
        );

      res.json({
        success: true,
        agentRuns:
          result.rows
      });
    } catch (error) {
      console.error(
        "Load agent runs error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Could not load agent runs"
      });
    }
  }
);

     // ============================================================
// CHAT
// ============================================================

app.post(
  "/api/chat",
  authenticateToken,
  async (req, res) => {
    const startedAt = Date.now();

    try {
      if (!openai) {
        return res.status(503).json({
          success: false,
          error:
            "OPENAI_API_KEY is not configured"
        });
      }

      const message = normalizeText(
        req.body?.message
      );

      const sessionId = normalizeText(
        req.body?.sessionId
      );

      if (!message) {
        return res.status(400).json({
          success: false,
          error:
            "Message is required"
        });
      }

      let conversation;

      // ======================================================
      // FIND OR CREATE CONVERSATION
      // ======================================================

      if (sessionId) {
        const conversationResult =
          await pool.query(
            `SELECT *
             FROM conversations
             WHERE user_id = $1
             AND session_id = $2`,
            [
              req.user.id,
              sessionId
            ]
          );

        if (
          conversationResult.rows.length === 0
        ) {
          return res.status(404).json({
            success: false,
            error:
              "Conversation not found"
          });
        }

        conversation =
          conversationResult.rows[0];
      } else {
        const newSessionId =
          crypto.randomUUID();

        const title =
          message.length > 80
            ? `${message.slice(0, 77)}...`
            : message;

        const conversationResult =
          await pool.query(
            `INSERT INTO conversations
             (
               user_id,
               session_id,
               title
             )
             VALUES
             ($1, $2, $3)
             RETURNING *`,
            [
              req.user.id,
              newSessionId,
              title
            ]
          );

        conversation =
          conversationResult.rows[0];
      }

      // ======================================================
      // SAVE USER MESSAGE
      // ======================================================

      await pool.query(
        `INSERT INTO messages
         (
           conversation_id,
           role,
           content
         )
         VALUES
         ($1, $2, $3)`,
        [
          conversation.id,
          "user",
          message
        ]
      );

      // ======================================================
      // LOAD RECENT CONVERSATION HISTORY
      // ======================================================

      const historyResult =
        await pool.query(
          `SELECT
             role,
             content
           FROM (
             SELECT
               id,
               role,
               content,
               created_at
             FROM messages
             WHERE conversation_id = $1
             ORDER BY
               created_at DESC,
               id DESC
             LIMIT 30
           ) AS recent_messages
           ORDER BY
             created_at ASC,
             id ASC`,
          [conversation.id]
        );

      // ======================================================
      // LOAD USER MEMORY
      // ======================================================

      const memoryResult =
        await pool.query(
          `SELECT
             memory_key,
             memory_value,
             memory_type,
             importance
           FROM user_memory
           WHERE user_id = $1
           ORDER BY
             importance DESC,
             updated_at DESC
           LIMIT 20`,
          [req.user.id]
        );

      // ======================================================
      // LOAD LONG-TERM MEMORY
      // ======================================================

      const longTermMemoryResult =
        await pool.query(
          `SELECT
             content,
             memory_type,
             importance,
             source
           FROM long_term_memory
           WHERE user_id = $1
           ORDER BY
             importance DESC,
             updated_at DESC
           LIMIT 20`,
          [req.user.id]
        );

      // ======================================================
      // LOAD KNOWLEDGE
      // ======================================================

      const knowledgeResult =
        await pool.query(
          `SELECT
             title,
             content,
             source,
             source_type
           FROM knowledge
           WHERE
             user_id = $1
             OR user_id IS NULL
           ORDER BY
             updated_at DESC
           LIMIT 10`,
          [req.user.id]
        );

      // ======================================================
      // FORMAT MEMORY
      // ======================================================

      const memoryText =
        memoryResult.rows.length > 0
          ? memoryResult.rows
              .map(
                memory =>
                  `- ${memory.memory_key}: ${memory.memory_value}`
              )
              .join("\n")
          : "No persistent memory available.";

      const longTermMemoryText =
        longTermMemoryResult.rows.length > 0
          ? longTermMemoryResult.rows
              .map(
                memory =>
                  `- ${memory.content}`
              )
              .join("\n")
          : "No long-term memory available.";

      const knowledgeText =
        knowledgeResult.rows.length > 0
          ? knowledgeResult.rows
              .map(
                item =>
                  `Title: ${
                    item.title || "Untitled"
                  }\nContent: ${
                    item.content
                  }`
              )
              .join("\n\n")
          : "No additional knowledge available.";

      // ======================================================
      // SYSTEM PROMPT
      // ======================================================

      const systemPrompt = `
You are Nkwasibwe IRHCF, an AI Agent Platform.

Your purpose is not to behave as only a simple chatbot.

Your goal is to help users understand problems, plan tasks,
execute tasks when tools and capabilities are actually available,
check results, identify errors, and provide useful final answers.

Core workflow:

Understand → Plan → Execute → Test → Repair → Verify → Deliver

Important rules:

1. Be helpful, accurate and honest.
2. Do not claim that you performed an action when you did not.
3. If you cannot access a required capability, explain what is missing.
4. Use stored memory only when relevant.
5. Respect user privacy and security.
6. Never expose secrets, passwords, API keys or authentication tokens.
7. Break complex tasks into clear steps.
8. Clearly distinguish between planning and completed execution.
9. Prefer practical solutions.
10. Never pretend external actions were completed without confirmation.
11. Do not invent tool results.
12. Explain limitations clearly.

USER PERSISTENT MEMORY:

${memoryText}

USER LONG-TERM MEMORY:

${longTermMemoryText}

KNOWLEDGE BASE:

${knowledgeText}
`;

      // ======================================================
      // BUILD AI MESSAGES
      // ======================================================

      const aiMessages = [
        {
          role: "system",
          content: systemPrompt
        },
        ...historyResult.rows.map(
          item => ({
            role: item.role,
            content: item.content
          })
        )
      ];

      // ======================================================
// CALL OPENAI
// ======================================================

let completion;

try {

  completion =
    await openai.chat.completions.create({
      model:
        config.openaiModel ||
        "gpt-4o-mini",

      messages:
        aiMessages,

      temperature: 0.7
    });

} catch (error) {

  console.error(
    "OpenAI API ERROR:",
    error
  );

  // ----------------------------------------------------
  // NO API CREDITS
  // ----------------------------------------------------

  if (
    error &&
    (
      error.code ===
        "credit_balance_exhausted" ||
      error.code ===
        "insufficient_quota"
    )
  ) {

    return res.status(429).json({
      success: false,
      error:
        "OpenAI API credits zarangiye. Ongera credits kuri OpenAI kugira ngo Nkwasibwe IRHCF ikomeze gukoresha AI.",
      code:
        "CREDIT_BALANCE_EXHAUSTED"
    });

  }

  // ----------------------------------------------------
  // OTHER OPENAI RATE LIMIT
  // ----------------------------------------------------

  if (
    error &&
    error.status === 429
  ) {

    return res.status(429).json({
      success: false,
      error:
        "OpenAI API iri kugabanya requests cyangwa quota ntihagije. Ongera ugerageze nyuma gato.",
      code:
        "OPENAI_RATE_LIMITED"
    });

  }

  // ----------------------------------------------------
  // OPENAI AUTHENTICATION ERROR
  // ----------------------------------------------------

  if (
    error &&
    error.status === 401
  ) {

    return res.status(500).json({
      success: false,
      error:
        "OpenAI API key ntabwo yemerewe cyangwa ntabwo ikora.",
      code:
        "OPENAI_AUTH_ERROR"
    });

  }

  // ----------------------------------------------------
  // OTHER OPENAI ERROR
  // ----------------------------------------------------

  return res.status(500).json({
    success: false,
    error:
      "Nkwasibwe IRHCF ntiyashoboye kuvugana na OpenAI.",
    code:
      "OPENAI_API_ERROR"
  });// ======================================================
// NKWASIBWE AI ORCHESTRATION
//
// IMPORTANT:
//
// /api/chat does NOT know which AI provider is being used.
//
// It delegates provider selection to generateAIResponse().
//
// This separation is intentional:
//
// HTTP API
//    ↓
// Conversation Engine
//    ↓
// Memory Engine
//    ↓
// AI Provider Router
//    ↓
// Provider Adapter
//
// This allows us to add future providers without rewriting
// the chat endpoint.
// ======================================================

let aiResult;

try {

  aiResult =
    await generateAIResponse(
      aiMessages,
      {
        providers:
          AI_PROVIDER_ORDER
      }
    );

} catch (error) {

  console.error(
    "NKWASIBWE AI ROUTER ERROR:",
    {
      code:
        error &&
        error.code,

      message:
        error &&
        error.message,

      attempts:
        error &&
        error.attempts
          ? error.attempts
          : []
    }
  );


  /*
   * Record the failure in the persistent system log.
   *
   * We deliberately do not store API keys, tokens, passwords,
   * or full provider responses here.
   */

  await systemLog(
    "error",
    "ai-router",
    "All AI providers failed",
    {
      userId:
        req.user.id,

      conversationId:
        conversation.id,

      code:
        error &&
        error.code
          ? error.code
          : "UNKNOWN",

      attempts:
        error &&
        Array.isArray(
          error.attempts
        )
          ? error.attempts
          : []
    }
  );


  if (
    error &&
    error.code ===
      "INPUT_TOO_LARGE"
  ) {

    return res.status(413).json({
      success: false,

      error:
        "Task nini ni ndende cyane. Gabanya ubwinshi bw'amakuru ugerageze kongera.",
      
      code:
        "AI_INPUT_TOO_LARGE"
    });

  }


  if (
    error &&
    error.code ===
      "ALL_PROVIDERS_FAILED"
  ) {

    return res.status(503).json({

      success: false,

      error:
        "Nkwasibwe IRHCF ntiyabonye AI provider iboneka ubu. Gemini, Groq na OpenAI byose byanze cyangwa ntibashyizweho.",

      code:
        "ALL_AI_PROVIDERS_FAILED",

      providers:
        error.attempts || []

    });

  }


  return res.status(503).json({

    success: false,

    error:
      "Nkwasibwe IRHCF ntiyashoboye kubona AI provider iboneka.",

    code:
      "AI_PROVIDER_ERROR"

  });

}


// ======================================================
// NORMALIZED AI RESPONSE
// ======================================================

const assistantMessage =
  aiResult &&
  typeof aiResult.response ===
    "string" &&
  aiResult.response.trim()
    ? aiResult.response.trim()
    : "Nkwasibwe IRHCF ntiyabonye igisubizo cya AI.";

const selectedProvider =
  aiResult &&
  aiResult.provider
    ? aiResult.provider
    : "unknown";

const selectedModel =
  aiResult &&
  aiResult.model
    ? aiResult.model
    : "unknown";

const providerDurationMs =
  aiResult &&
  Number.isFinite(
    aiResult.durationMs
  )
    ? aiResult.durationMs
    : null;



      // ======================================================
      // SAVE ASSISTANT MESSAGE
      // ======================================================

      const savedAssistantMessage =
        await pool.query(
          `INSERT INTO messages
           (
             conversation_id,
             role,
             content
           )
           VALUES
           ($1, $2, $3)
           RETURNING *`,
          [
            conversation.id,
            "assistant",
            assistantMessage
          ]
        );

      // ======================================================
      // UPDATE CONVERSATION
      // ======================================================

      await pool.query(
        `UPDATE conversations
         SET updated_at =
           CURRENT_TIMESTAMP
         WHERE id = $1`,
        [conversation.id]
      );

      // ======================================================
// CREATE AGENT RUN RECORD
// ======================================================

const durationMs =
  Date.now() - startedAt;


// ------------------------------------------------------
// BUILD AI EXECUTION METADATA
// ------------------------------------------------------

const aiExecutionMetadata = {
  source: "chat",

  conversationId:
    conversation.id,

  durationMs:

    durationMs,

  provider:
    aiResult &&
    aiResult.provider
      ? aiResult.provider
      : null,

  model:
    aiResult &&
    aiResult.model
      ? aiResult.model
      : null,

  latencyMs:
    aiResult &&
    typeof aiResult.latencyMs === "number"
      ? aiResult.latencyMs
      : null,

  requestId:
    aiResult &&
    aiResult.requestId
      ? aiResult.requestId
      : null,

  attempts:
    aiResult &&
    Array.isArray(aiResult.attempts)
      ? aiResult.attempts
      : [],

  usage:
    aiResult &&
    aiResult.usage
      ? aiResult.usage
      : null,

  providerOrder:
    AI_CONFIG &&
    Array.isArray(
      AI_CONFIG.providerOrder
    )
      ? AI_CONFIG.providerOrder
      : [],

  executionMode:
    "provider_router",

  status:
    "completed"
};


// ------------------------------------------------------
// DETERMINE WHETHER FALLBACK WAS USED
// ------------------------------------------------------

const providerAttempts =
  aiResult &&
  Array.isArray(aiResult.attempts)
    ? aiResult.attempts
    : [];

const failedProviderAttempts =
  providerAttempts.filter(
    function (attempt) {
      return (
        attempt &&
        attempt.status === "failed"
      );
    }
  );

const fallbackUsed =
  failedProviderAttempts.length > 0;


// ------------------------------------------------------
// ADD FALLBACK INFORMATION
// ------------------------------------------------------

aiExecutionMetadata.fallbackUsed =
  fallbackUsed;

aiExecutionMetadata.failedProviders =
  failedProviderAttempts.map(
    function (attempt) {
      return {
        provider:
          attempt.provider || null,

        attempt:
          attempt.attempt || null,

        code:
          attempt.code || null,

        latencyMs:
          typeof attempt.latencyMs === "number"
            ? attempt.latencyMs
            : null
      };
    }
  );


// ------------------------------------------------------
// CREATE AGENT RUN
// ------------------------------------------------------

const agentRunResult =
  await pool.query(
    `INSERT INTO agent_runs
     (
       user_id,
       goal,
       status,
       result,
       metadata,
       completed_at
     )
     VALUES
     (
       $1,
       $2,
       'completed',
       $3,
       $4::jsonb,
       CURRENT_TIMESTAMP
     )
     RETURNING *`,
    [
      req.user.id,

      message,

      assistantMessage,

      JSON.stringify(
        aiExecutionMetadata
      )
    ]
  );


// ------------------------------------------------------
// EXTRACT CREATED AGENT RUN
// ------------------------------------------------------

const agentRun =
  agentRunResult &&
  agentRunResult.rows &&
  agentRunResult.rows[0]
    ? agentRunResult.rows[0]
    : null;


// ------------------------------------------------------
// INTERNAL EXECUTION LOG
// ------------------------------------------------------

console.log(
  "[AGENT RUN] Completed",
  {
    agentRunId:
      agentRun &&
      agentRun.id
        ? agentRun.id
        : null,

    provider:
      aiExecutionMetadata.provider,

    model:
      aiExecutionMetadata.model,

    durationMs:
      aiExecutionMetadata.durationMs,

    latencyMs:
      aiExecutionMetadata.latencyMs,

    fallbackUsed:
      aiExecutionMetadata.fallbackUsed
  }
);
  
      // ======================================================
      // RESPONSE
      // ======================================================

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          session_id:
            conversation.session_id,
          title:
            conversation.title
        },
        message:
          savedAssistantMessage.rows[0],
        response:
          assistantMessage,
        agentRun:
          agentRunResult.rows[0],
        durationMs
      });

    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      await systemLog(
        "error",
        "chat",
        "Chat request failed",
        {
          message:
            error.message
        }
      );

      res.status(500).json({
        success: false,
        error:
          "Could not process chat request"
      });
    }
  }
);                
 // ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log("================================");
      console.log("Nkwasibwe IRHCF server is running");
      console.log(`Port: ${PORT}`);
      console.log(
        `Environment: ${config.environment}`
      );
      console.log(
        `AI: ${
          openai
            ? "Configured"
            : "Not configured"
        }`
      );
      console.log(
        `Authentication: ${
          JWT_SECRET
            ? "Configured"
            : "Not configured"
        }`
      );
      console.log("================================");
    });
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();             
