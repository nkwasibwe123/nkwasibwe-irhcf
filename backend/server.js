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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = config.port;
const JWT_SECRET = config.jwtSecret;

const openai = config.openaiApiKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : null;

// ============================================================
// LOGGING
// ============================================================

async function systemLog(level, component, message, metadata = {}) {
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
    console.error("Logging error:", error.message);
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

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }

  const token = authHeader.substring(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
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

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Nkwasibwe IRHCF",
    message: "Nkwasibwe IRHCF AI backend is running!",
    version: "1.0.0"
  });
});

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      status: "ok",
      database: "connected",
      ai: openai ? "configured" : "not_configured",
      environment: config.environment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Email is already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at, updated_at`,
      [
        cleanName,
        cleanEmail,
        passwordHash
      ]
    );

    const user = result.rows[0];
    const token = createToken(user);

    await systemLog(
      "info",
      "authentication",
      "New user registered",
      { userId: user.id }
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user
    });
  } catch (error) {
    console.error("Register error:", error);

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }

    const cleanEmail = email.trim().toLowerCase();

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
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }

    delete user.password_hash;

    const token = createToken(user);

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

app.get("/api/me", authenticateToken, async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: "Could not get user"
    });
  }
});

// ============================================================
// CREATE CONVERSATION
// ============================================================

app.post(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const title =
        req.body.title?.trim() ||
        "New conversation";

      const sessionId = crypto.randomUUID();

      const result = await pool.query(
        `INSERT INTO conversations
         (user_id, session_id, title)
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
        conversation: result.rows[0]
      });
    } catch (error) {
      console.error("Create conversation error:", error);

      res.status(500).json({
        success: false,
        error: "Could not create conversation"
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
      res.status(500).json({
        success: false,
        error: "Could not load conversation history"
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
      const { sessionId } = req.params;

      const conversationResult = await pool.query(
        `SELECT *
         FROM conversations
         WHERE user_id = $1
         AND session_id = $2`,
        [
          req.user.id,
          sessionId
        ]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found"
        });
      }

      const conversation =
        conversationResult.rows[0];

      const messagesResult = await pool.query(
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
      res.status(500).json({
        success: false,
        error: "Could not load conversation"
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
      const result = await pool.query(
        `DELETE FROM conversations
         WHERE user_id = $1
         AND session_id = $2
         RETURNING id`,
        [
          req.user.id,
          req.params.sessionId
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
      res.status(500).json({
        success: false,
        error: "Could not delete conversation"
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
      const {
        key,
        value,
        type = "general",
        importance = 1
      } = req.body;

      if (!key || !value) {
        return res.status(400).json({
          success: false,
          error: "Memory key and value are required"
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
      res.status(500).json({
        success: false,
        error: "Could not save memory"
      });
    }
  }
);

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
      res.status(500).json({
        success: false,
        error: "Could not load memory"
      });
    }
  }
);

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
      res.status(500).json({
        success: false,
        error: "Could not delete memory"
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
      res.status(500).json({
        success: false,
        error: "Could not save long-term memory"
      });
    }
  }
);

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
      res.status(500).json({
        success: false,
        error: "Could not load long-term memory"
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
          error: "OPENAI_API_KEY is not configured"
        });
      }

      const {
        message,
        sessionId
      } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: "Message is required"
        });
      }

      const userId = req.user.id;

      let conversation;

      if (sessionId) {
        const existing = await pool.query(
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
          conversation = existing.rows[0];
        }
      }

      if (!conversation) {
        const newSessionId =
          sessionId || crypto.randomUUID();

        const created = await pool.query(
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
            message.trim().slice(0, 80)
          ]
        );

        conversation = created.rows[0];
      }

      await pool.query(
        `INSERT INTO messages
         (
           conversation_id,
           role,
           content
         )
         VALUES ($1, $2, $3)`,
        [
          conversation.id,
          "user",
          message.trim()
        ]
      );

      const messagesResult = await pool.query(
        `SELECT role, content
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT 30`,
        [conversation.id]
      );

      const memoryResult = await pool.query(
        `SELECT
           memory_key,
           memory_value,
           memory_type,
           importance
         FROM user_memory
         WHERE user_id = $1
         ORDER BY importance DESC, updated_at DESC
         LIMIT 30`,
        [userId]
      );

      const longTermResult = await pool.query(
        `SELECT
           content,
           memory_type,
           importance
         FROM long_term_memory
         WHERE user_id = $1
         ORDER BY importance DESC, updated_at DESC
         LIMIT 20`,
        [userId]
      );

      const memoryText =
        memoryResult.rows.length > 0
          ? memoryResult.rows
              .map(
                item =>
                  `${item.memory_key}: ${item.memory_value}`
              )
              .join("\n")
          : "No persistent user memory available.";

      const longTermText =
        longTermResult.rows.length > 0
          ? longTermResult.rows
              .map(
                item =>
                  `[${item.memory_type}] ${item.content}`
              )
              .join("\n")
          : "No long-term memory available.";

      const instructions = `
Uri Nkwasibwe IRHCF, AI Agent Platform.

Uvuga neza Kinyarwanda kandi ushobora gukoresha izindi ndimi
iyo umukoresha azikoresheje.

Intego:
- Gusobanukirwa task y'umukoresha.
- Gukoresha context y'ikiganiro.
- Gukoresha persistent memory iyo ari ngombwa.
- Gukoresha long-term memory iyo ari ngombwa.
- Kudahimba amakuru utazi.
- Gutanga ibisubizo bifatika kandi bisobanutse.
- Gutekereza ku buryo bwo gukemura task mbere yo gusubiza.
- Kubaha privacy n'umutekano.
- Iyo hari ikintu udashobora gukora, kubivuga neza.

PERSISTENT USER MEMORY:
${memoryText}

LONG-TERM MEMORY:
${longTermText}
`;

      const input = messagesResult.rows.map(row => ({
        role: row.role,
        content: row.content
      }));

      const aiResponse =
        await openai.responses.create({
          model: "gpt-5.6",
          instructions,
          input
        });

      const reply =
        aiResponse.output_text ||
        "Ntabwo nabashije kubona igisubizo.";

      await pool.query(
        `INSERT INTO messages
         (
           conversation_id,
           role,
           content
         )
         VALUES ($1, $2, $3)`,
        [
          conversation.id,
          "assistant",
          reply
        ]
      );

      await pool.query(
        `UPDATE conversations
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [conversation.id]
      );

      await systemLog(
        "info",
        "chat",
        "Chat completed",
        {
          userId,
          conversationId: conversation.id,
          durationMs: Date.now() - startedAt
        }
      );

      res.json({
        success: true,
        reply,
        sessionId: conversation.session_id,
        conversationId: conversation.id
      });
        } catch (error) {
      console.error("Chat error:", error);

      await systemLog(
        "error",
        "chat",
        "Chat failed",
        {
          userId: req.user?.id || null,
          error: error.message
        }
      );

      res.status(500).json({
        success: false,
        error: error.message || "AI request failed"
      });
    }
  }
);

// ============================================================
// TASKS
// ============================================================

app.post(
  "/api/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      const { task } = req.body;

      if (!task || !task.trim()) {
        return res.status(400).json({
          success: false,
          error: "Task is required"
        });
      }

      const result = await pool.query(
        `INSERT INTO tasks
         (user_id, task, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          req.user.id,
          task.trim(),
          "pending"
        ]
      );

      res.status(201).json({
        success: true,
        task: result.rows[0]
      });
    } catch (error) {
      console.error("Create task error:", error);

      res.status(500).json({
        success: false,
        error: "Could not create task"
      });
    }
  }
);

app.get(
  "/api/tasks",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT *
         FROM tasks
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        tasks: result.rows
      });
    } catch (error) {
      console.error("Tasks load error:", error);

      res.status(500).json({
        success: false,
        error: "Could not load tasks"
      });
    }
  }
);

// ============================================================
// CAPABILITIES
// ============================================================

app.get(
  "/api/capabilities",
  async (req, res) => {
    try {
      const result = await pool.query(
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
         ORDER BY name ASC`
      );

      res.json({
        success: true,
        capabilities: result.rows
      });
    } catch (error) {
      console.error("Capabilities error:", error);

      res.status(500).json({
        success: false,
        error: "Could not load capabilities"
      });
    }
  }
);

// ============================================================
// KNOWLEDGE
// ============================================================

app.post(
  "/api/knowledge",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        title,
        content,
        source,
        sourceType = "text",
        metadata = {}
      } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          error: "Knowledge content is required"
        });
      }

      const result = await pool.query(
        `INSERT INTO knowledge
         (
           user_id,
           title,
           content,
           source,
           source_type,
           metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          req.user.id,
          title || null,
          content.trim(),
          source || null,
          sourceType,
          JSON.stringify(metadata)
        ]
      );

      res.status(201).json({
        success: true,
        knowledge: result.rows[0]
      });
    } catch (error) {
      console.error("Knowledge save error:", error);

      res.status(500).json({
        success: false,
        error: "Could not save knowledge"
      });
    }
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
  console.error(
    "Unhandled server error:",
    error
  );

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          "Nkwasibwe IRHCF backend started successfully."
        );
      }
    );
  } catch (error) {
    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();
