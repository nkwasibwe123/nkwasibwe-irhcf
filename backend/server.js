const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PORT = process.env.PORT || 3000;

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
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    
    res.json({
      success: true,
      reply: response.output_text
    });

  } catch (error) {
    console.error("OpenAI error:", error);

    res.status(500).json({
      success: false,
      error: "AI request failed"
    });
  }
const response = await openai.responses.create({
      model: "gpt-5.6",
      input: [
        {
          role: "system",
          content:
            "Uri Nkwasibwe IRHCF, AI assistant uvuga neza Kinyarwanda kandi ugafasha umukoresha mu buryo busobanutse."
        },
        {
          role: "user",
          content: message
        }
      ]
    });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
