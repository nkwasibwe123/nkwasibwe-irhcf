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
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    const aiResponse = await openai.responses.create({
      model: "gpt-5.6",
      instructions:
        "Uri Nkwasibwe IRHCF, AI assistant uvuga neza Kinyarwanda. Subiza mu buryo busobanutse, bugufi kandi bufasha umukoresha.",
      input: message
    });

    res.json({
      success: true,
      reply: aiResponse.output_text
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
