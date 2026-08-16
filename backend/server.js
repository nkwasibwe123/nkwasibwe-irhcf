 const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// =========================
// DATABASE SETUP
// =========================

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Database tables ready!");
}

pool.connect()
  .then(client => {
    console.log("PostgreSQL connected successfully!");
    client.release();
    return createTables();
  })
  .catch(error => {
    console.error("Database connection error:", error);
  });

// =========================
// AUTHENTICATION
// =========================

function createToken(user) {
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

// =========================
// HOME
// =========================

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Nkwasibwe IRHCF AI backend is running!"
  });
});

// =========================
// HEALTH CHECK
// =========================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected"
    });
  }
});

// =========================
// REGISTER
// =========================

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

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Email is already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    const token = createToken(user);

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

// =========================
// LOGIN
// =========================

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, password_hash, created_at
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
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

// =========================
// CURRENT USER
// =========================

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, created_at
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
});

// =========================
// CHAT
// =========================

app.post("/api/chat", authenticateToken, async (req, res) => {
  try {
    const {
      message,
      sessionId = "default"
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    const userId = req.user.id;

    // Save user's message
    await pool.query(
      `INSERT INTO conversations
       (user_id, session_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [userId, sessionId, "user", message.trim()]
    );

    // Get conversation history
    const result = await pool.query(
      `SELECT role, content
       FROM conversations
       WHERE user_id = $1
       AND session_id = $2
       ORDER BY created_at ASC
       LIMIT 20`,
      [userId, sessionId]
    );

    const conversation = result.rows.map(row => ({
      role: row.role,
      content: row.content
    }));

    // Ask OpenAI
    const aiResponse = await openai.responses.create({
      model: "gpt-5.6",

      instructions:
        "Uri Nkwasibwe IRHCF, AI assistant uvuga neza Kinyarwanda. " +
        "Fasha umukoresha mu buryo busobanutse, bufatika kandi bwubaha. " +
        "Koresha context y'ibiganiro byabanje kugira ngo utange igisubizo gihuye n'ikiganiro.",

      input: conversation
    });

    const reply = aiResponse.output_text;

    // Save AI response
    await pool.query(
      `INSERT INTO conversations
       (user_id, session_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [userId, sessionId, "assistant", reply]
    );

    res.json({
      success: true,
      reply,
      sessionId
    });

  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "AI request failed"
    });
  }
});

// =========================
// CONVERSATION HISTORY
// =========================

app.get(
  "/api/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           session_id,
           MAX(created_at) AS last_message,
           COUNT(*) AS message_count
         FROM conversations
         WHERE user_id = $1
         GROUP BY session_id
         ORDER BY last_message DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        conversations: result.rows
      });

    } catch (error) {
      console.error("Conversation history error:", error);

      res.status(500).json({
        success: false,
        error: "Could not load conversation history"
      });
    }
  }
);

// =========================
// GET ONE CONVERSATION
// =========================

app.get(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await pool.query(
        `SELECT id, role, content, created_at
         FROM conversations
         WHERE user_id = $1
         AND session_id = $2
         ORDER BY created_at ASC`,
        [req.user.id, sessionId]
      );

      res.json({
        success: true,
        sessionId,
        messages: result.rows
      });

    } catch (error) {
      console.error("Conversation error:", error);

      res.status(500).json({
        success: false,
        error: "Could not load conversation"
      });
    }
  }
);

// =========================
// DELETE CONVERSATION
// =========================

app.delete(
  "/api/conversations/:sessionId",
  authenticateToken,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      await pool.query(
        `DELETE FROM conversations
         WHERE user_id = $1
         AND session_id = $2`,
        [req.user.id, sessionId]
      );

      res.json({
        success: true,
        message: "Conversation deleted"
      });

    } catch (error) {
      console.error("Delete conversation error:", error);

      res.status(500).json({
        success: false,
        error: "Could not delete conversation"
      });
    }
  }
);

// =========================
// START SERVER
// =========================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});    
    
