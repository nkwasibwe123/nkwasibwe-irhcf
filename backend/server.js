const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Nkwasibwe IRHCF backend is running!"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.post("/api/chat", (req, res) => {
  const message = req.body.message || "";
  const text = message.toLowerCase();

  let reply;

  if (
    text.includes("muraho") ||
    text.includes("hello") ||
    text.includes("hi")
  ) {
    reply =
      "Muraho! 👋 Ndi Nkwasibwe IRHCF. Nakora iki kugira ngo ngufashe?";
  } else if (text.includes("witwa nde")) {
    reply = "Nitwa Nkwasibwe IRHCF 🤖.";
  } else if (text.includes("nkwasibwe")) {
    reply = "Yego! Ndi hano. Mbwira task ushaka ko dukora.";
  } else if (text.includes("app")) {
    reply =
      "Ndumva ushaka gukora application. 🚀 Mbwira icyo ushaka ko dukoraho.";
  } else {
    reply =
      "Nabyakiriye. 🤖 Ubu ndacyari muri MVP, ariko backend yamaze gukora neza.";
  }

  res.json({
    success: true,
    reply: reply
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
