const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", key: process.env.ANTHROPIC_API_KEY ? "key set" : "key missing" });
});

app.post("/v1/messages", async (req, res) => {
  try {
    console.log("API KEY:", process.env.ANTHROPIC_API_KEY ? "present" : "MISSING");
    const response = await fetch("https://api.proxyapi.ru/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    console.log("Anthropic response status:", response.status);
    console.log("Anthropic response:", JSON.stringify(data).slice(0, 200));
    res.json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3001);
