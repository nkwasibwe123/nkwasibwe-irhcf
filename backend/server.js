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

app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================================
// OPENAI
// ============================================================

const openai = config.openaiApiKey
  ? new OpenAI({
      apiKey: config.openaiApiKey
    })
  : null;

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
        "Register error:",
        error
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
          result.rows[0]
     
