import express from "express";
import cors from "cors";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

import routes from "./routes/routes.js";
import { sendLogToDiscord } from "./other/discordLogger.js";
import config from "./main/config.js";

const app = express();

// ================= Middleware Maintenance =================
app.use((req, res, next) => {
  if (config.maintenanceMode) {
    const logMessage = `Service unavailable. Request from ${req.ip} blocked.`;
    sendLogToDiscord(logMessage, "Error");
    return res.status(503).send({
      message: "Service temporarily unavailable due to maintenance.",
    });
  }
  next();
});

// ================= Middleware Logging =================
app.use((req, res, next) => {
  const startTime = new Date();
  res.on("finish", () => {
    const endTime = new Date();
    const responseTime = endTime - startTime;

    const requestData = {
      method: req.method,
      url: req.originalUrl,
      responseTime,
    };

    const logMessage = `Request handled. Method: ${req.method}, URL: ${req.originalUrl}`;
    sendLogToDiscord(logMessage, "Info", requestData);
  });
  next();
});

// ================= CORS =================
app.use(
  cors({
    origin: ["http://rick.hidencloud.com:24576/"], // ganti dengan domain yg diizinkan
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ================= API Routes =================
// semua route custom kamu misalnya /api/news, /api/member, dll
app.use("/api", routes);

// ================= Puppeteer Proxy =================
// jadi langsung tersedia di server yg sama
app.get("/fetch", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing ?url=" });

  console.log(`[INFO] Fetching via Puppeteer: ${targetUrl}`);
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    );

    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
    const html = await page.content();
    await browser.close();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[ERROR] Puppeteer fetch failed:", err.message);
    res.status(500).json({
      error: "Puppeteer fetch failed",
      detail: err.message,
    });
  }
});

// ================= Root =================
app.get("/", (req, res) => {
  const logMessage = `Welcome message sent to ${req.ip}.`;
  sendLogToDiscord(logMessage, "Info");
  res.json({
    message: "Welcome To JKT48 WEB API 🚀",
    author: "https://github.com/mastopa",
    usage: {
      api: "/api/news",
      proxy: "/fetch?url=YOUR_URL",
    },
  });
});

// ================= Start Server =================
const port = process.env.PORT || config.port || 8080;
app.listen(port, () =>
  console.log(`✅ Server running on http://localhost:${port}`)
);
