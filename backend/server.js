     const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.connect()
  .then(client => {
    console.log("PostgreSQL connected successfully!");
    client.release();
  })
  .catch(error => {
    console.error("PostgreSQL connection error:", error);
  });

// Create conversations table
async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Conversations table ready!");
}

createTable().catch(error => {
  console.error("Database table error:", error);
});

// Home
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Nkwasibwe IRHCF AI backend is running!"
  });
});

// Health check
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

// Chat
app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      sessionId = "default"
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    // Save user's message
    await pool.query(
      `INSERT INTO conversations
       (session_id, role, content)
       VALUES ($1, $2, $3)`,
      [sessionId, "user", message]
    );

    // Get previous conversation
    const result = await pool.query(
      `SELECT role, content
       FROM conversations
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [sessionId]
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
       (session_id, role, content)
       VALUES ($1, $2, $3)`,
      [sessionId, "assistant", reply]
    );

    res.json({
      success: true,
      reply: reply,
      sessionId: sessionId
    });

  } catch (error) {
    console.error("Backend error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "AI request failed"
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
}); 
