const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const config = require("./config");
const pool = require("./db/pool");
const createSchema = require("./db/schema");

const app = express();

// ============================================================
// BASIC CONFIGURATION
// ============================================================

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = config.port;
const JWT_SECRET = config.jwtSecret;

if (!config.openaiApiKey) {
  console.warn("WARNING: OPENAI_API_KEY is not configured.");
}

if (!JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not configured.");
}

const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

// ============================================================
// STARTUP / DATABASE
// ============================================================

async function initializeDatabase() {
  try {
    const client = await pool.connect();

    console.log("PostgreSQL connected successfully!");

    client.release();

    await createSchema();

    console.log("Database initialization complete!");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
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
       (level, component, message, metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        level,
        component,
        message,
        JSON.stringify(metadata)
      ]
    );
  } catch (error) {
    console.error("Logging error:", error);
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }

  const token = authHeader.substring(7);

  try {
    const user = jwt.verify(token, JWT_SECRET);

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token"
    });
  }
}

// ============================================================
// HOME
// ============================================================

app.get("/", async (req, res) => {
  res.json({
    status: "success",
    name: "Nkwasibwe IRHCF",
    message: "Nkwasibwe IRHCF AI backend is running!",
    version: "1.0.0"
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
      ai: config.openaiApiKey
        ? "configured"
        : "not_configured",
      environment: config.environment
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected"
    });
  }
});

// ============================================================
// REGISTER
// ============================================================

app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error:
          "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 6 characters"
      });
    }

    const cleanName = name.trim();
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        error: "Name is required"
      });
    }

    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Email is already registered"
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING
       id,
       name,
       email,
       created_at,
       updated_at`,
      [
        cleanName,
        normalizedEmail,
        passwordHash
      ]
    );

    const user = result.rows[0];

    const token = createToken(user);

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
      message: "Account created successfully",
      token,
      user
    });

  } catch (error) {
    console.error("Register error:", error);

    await systemLog(
      "error",
      "authentication",
      "Registration failed",
      {
        error: error.message
      }
    );

    res.status(500).json({
      success: false,
      error: "Could not create account"
    });
  }
});

// ============================================================
// LOGIN
// ============================================================

app.post("/api/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error:
          "Email and password are required"
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT
       id,
       name,
       email,
       password_hash,
       created_at,
       updated_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid email or password"
      });
    }

    const user = result.rows[0];

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid email or password"
      });
    }

    delete user.password_hash;

    const token = createToken(user);

    await systemLog(
      "info",
      "authentication",
      "User logged in",
      {
        userId: user.id
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      error: "Could not login"
    });
  }
});

// ============================================================
// CURRENT USER
// ============================================================

app.get(
  "/api/me",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
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

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found"
        });
      }

      res.json({
        success: true,
        user: result.rows[0]
      });

    } catch (error) {
      console.error("Me error:", error);

      res.status(500).json({
        success: false,
        error: "Could not get user"
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
      const {
        title = "New conversation"
      } = req.body;

      const sessionId =
        crypto.randomUUID();

      const result = await pool.query(
        `INSERT INTO conversations
         (user_id, session_id, title)
         VALUES ($1, $2, $3)
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

      res.status(201).json({
        success: true,
        conversation: result.rows[0]
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
      const result = await pool.query(
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
        conversations: result.rows
      });

    } catch (error) {
      console.error(
        "Conversation history error:",
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
// GET ONE CONVERSATION
// ============================================================

app.get(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        sessionId
      } = req.params;

      const conversationResult =
        await pool.query(
          `SELECT
           id,
           session_id,
           title,
           created_at,
           updated_at
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
          error: "Conversation not found"
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
        messages: messagesResult.rows
      });

    } catch (error) {
      console.error(
        "Conversation error:",
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
      const {
        sessionId
      } = req.params;

      const result = await pool.query(
        `DELETE FROM conversations
         WHERE user_id = $1
         AND session_id = $2
         RETURNING id`,
        [
          req.user.id,
          sessionId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found"
        });
      }

      res.json({
        success: true,
        message: "Conversation deleted"
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
// SAVE MEMORY
// ============================================================

app.post(
  "/api/memory",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        key,
        value,
        type = "general",
        importance = 1
      } = req.body;

      if (!key || !value) {
        return res.status(400).json({
          success: false,
          error:
            "Memory key and value are required"
        });
      }

      const result = await pool.query(
        `INSERT INTO user_memory
         (
           user_id,
           memory_key,
           memory_value,
           memory_type,
           importance
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, memory_key)
         DO UPDATE SET
           memory_value = EXCLUDED.memory_value,
           memory_type = EXCLUDED.memory_type,
           importance = EXCLUDED.importance,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          req.user.id,
          key.trim(),
          value.trim(),
          type,
          importance
        ]
      );

      res.status(201).json({
        success: true,
        memory: result.rows[0]
      });

    } catch (error) {
      console.error(
        "Memory save error:",
        error
      );

      res.status(500).json({
        success: false,
        error: "Could not save memory"
      });
    }
  }
);

// ============================================================
// GET MEMORY
// ============================================================

app.get(
  "/api/memory",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM user_memory
         WHERE user_id = $1
         ORDER BY importance DESC, updated_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        memories: result.rows
      });

    } catch (error) {
      console.error(
        "Memory load error:",
        error
      );

      res.status(500).json({
        success: false,
        error: "Could not load memory"
      });
    }
  }
);

// ============================================================
// DELETE MEMORY
// ============================================================

app.delete(
  "/api/memory/:key",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM user_memory
         WHERE user_id = $1
         AND memory_key = $2
         RETURNING id`,
        [
          req.user.id,
          req.params.key
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Memory not found"
        });
      }

      res.json({
        success: true,
        message: "Memory deleted"
      });

    } catch (error) {
      console.error(
        "Memory delete error:",
        error
      );

      res.status(500).json({
        success: false,
        error: "Could not delete memory"
      });
    }
  }
);

// ============================================================
// SAVE LONG-TERM MEMORY
// ============================================================

app.post(
  "/api/long-term-memory",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        content,
        type = "general",
        importance = 1,
        source = "user"
      } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          error: "Content is required"
        });
      }

      const result = await pool.query(
        `INSERT INTO long_term_memory
         (
           user_id,
           content,
           memory_type,
           importance,
           source
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          req.user.id,
          content.trim(),
          type,
          importance,
          source
        ]
      );

      res.status(201).json({
        success: true,
        memory: result.rows[0]
      });

    } catch (error) {
      console.error(
        "Long-term memory error:",
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
// GET LONG-TERM MEMORY
// ============================================================

app.get(
  "/api/long-term-memory",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM long_term_memory
         WHERE user_id = $1
         ORDER BY importance DESC, updated_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        memories: result.rows
      });

    } catch (error) {
      console.error(
        "Long-term memory load error:",
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
// CHAT
// ============================================================

app.post(
  "/api/chat",
  authenticateToken,
  async (req, res) => {
    const startedAt = Date.now();

    try {
      const {
        message,
        sessionId
      } = req.body;

      if (
        !message ||
        !message.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "Message is required"
        });
      }

      const userId = req.user.id;

      // ------------------------------------------------------
      // Find or create conversation
      // ------------------------------------------------------

      let conversation;

      if (sessionId) {
        const existing =
          await pool.query(
            `SELECT *
             FROM conversations
             WHERE user_id = $1
             AND session_id = $2`,
            [
              userId,
              sessionId
            ]
          );

        if (existing.rows.length > 0) {
          conversation =
            existing.rows[0];
        }
      }

      if (!conversation) {
        const newSessionId =
          sessionId ||
          crypto.randomUUID();

        const created =
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
              userId,
              newSessionId,
              message
                .trim()
                .slice(0, 80)
            ]
          );

        conversation =
          created.rows[0];
      }

      // ------------------------------------------------------
      // Save user message
      // ------------------------------------------------------

      await pool.query(
        `INSERT INTO messages
         (
           conversation_i
