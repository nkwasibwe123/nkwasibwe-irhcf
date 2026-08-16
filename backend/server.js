const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Temporary conversation memory
const conversations = {};

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Nkwasibwe IRHCF AI backend is running!"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    // Create memory for new session
    if (!conversations[sessionId]) {
      conversations[sessionId] = [];
    }

    // Add user's message to memory
    conversations[sessionId].push({
      role: "user",
      content: message
    });

    // Keep the last 20 messages
    if (conversations[sessionId].length > 20) {
      conversations[sessionId] =
        conversations[sessionId].slice(-20);
    }

    const aiResponse = await openai.responses.create({
      model: "gpt-5.6",

      instructions:
        "Uri Nkwasibwe IRHCF, AI assistant uvuga neza Kinyarwanda. " +
        "Fasha umukoresha mu buryo busobanutse, bufatika kandi bwubaha. " +
        "Koresha context y'ibiganiro byabanje kugira ngo utange igisubizo gihuye n'ikiganiro.",

      input: conversations[sessionId]
    });

    const reply = aiResponse.output_text;

    // Save AI response to memory
    conversations[sessionId].push({
      role: "assistant",
      content: reply
    });

    res.json({
      success: true,
      reply: reply,
      sessionId: sessionId
    });

  } catch (error) {
    console.error("OpenAI error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "AI request failed"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
