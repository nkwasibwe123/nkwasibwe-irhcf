const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "Nkwasibwe IRHCF",
    status: "online",
    message: "Nkwasibwe IRHCF backend is running."
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy"
  });
});

app.post("/api/chat", (req, res) => {
  const message = req.body?.message || "";

  res.json({
    reply: `Nkwasibwe IRHCF yakiriye ubutumwa bwawe: ${message}`
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nkwasibwe IRHCF backend running on port ${PORT}`);
});