const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "";
const MAX_MESSAGES = 3;              // safety cap; deliberately not unlimited
const MIN_INTERVAL_MS = 60 * 1000;   // minimum one minute between messages

let clientReady = false;
let qrDataUrl = null;
let connectionState = "Starting WhatsApp client…";
let activeJob = null;
let lastError = "";

function auth(req, res, next) {
  if (API_KEY && req.get("x-api-key") !== API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}
app.use("/api", auth);

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "wapilot" }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  }
});

client.on("qr", async qr => {
  qrDataUrl = await QRCode.toDataURL(qr);
  clientReady = false;
  connectionState = "QR scan required";
});
client.on("authenticated", () => { connectionState = "Authenticated; loading chats…"; });
client.on("ready", () => {
  clientReady = true;
  qrDataUrl = null;
  connectionState = "Connected";
  lastError = "";
});
client.on("auth_failure", msg => {
  clientReady = false;
  connectionState = "Authentication failed";
  lastError = String(msg);
});
client.on("disconnected", reason => {
  clientReady = false;
  connectionState = "Disconnected";
  lastError = String(reason);
  stopJob("WhatsApp disconnected");
});

// Any incoming message from the selected chat stops the sequence immediately.
client.on("message", msg => {
  if (!activeJob || activeJob.status !== "running") return;
  if (msg.from === activeJob.chatId && !msg.fromMe) {
    stopJob("Reply received — automation stopped");
  }
});

function stopJob(reason) {
  if (!activeJob || activeJob.status !== "running") return;
  activeJob.status = "stopped";
  activeJob.stopReason = reason;
  activeJob.stoppedAt = new Date().toISOString();
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runJob(job) {
  try {
    for (let i = 0; i < job.maxMessages; i++) {
      if (!activeJob || activeJob.id !== job.id || job.status !== "running") return;
      await client.sendMessage(job.chatId, job.message);
      job.sent += 1;
      job.lastSentAt = new Date().toISOString();
      if (job.sent >= job.maxMessages) {
        job.status = "completed";
        job.stopReason = "Safety limit reached";
        return;
      }
      await sleep(job.intervalMs);
    }
  } catch (e) {
    job.status = "error";
    job.stopReason = "Send failed";
    lastError = e.message || String(e);
  }
}

app.get("/api/status", (req, res) => res.json({
  connected: clientReady, state: connectionState, qr: qrDataUrl,
  activeJob, lastError, maxMessages: MAX_MESSAGES,
  minIntervalSeconds: MIN_INTERVAL_MS / 1000
}));

app.get("/api/contacts", async (req, res) => {
  if (!clientReady) return res.status(409).json({ error: "Scan QR and connect first" });
  try {
    const chats = await client.getChats();
    const contacts = chats
      .filter(c => !c.isGroup && c.id && c.id._serialized.endsWith("@c.us"))
      .map(c => ({ id: c.id._serialized, name: c.name || c.pushname || c.id.user }))
      .sort((a,b) => a.name.localeCompare(b.name));
    res.json({ contacts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/start", async (req, res) => {
  if (!clientReady) return res.status(409).json({ error: "WhatsApp is not connected" });
  if (activeJob && activeJob.status === "running") {
    return res.status(409).json({ error: "An automation is already running" });
  }
  const { chatId, message, maxMessages, intervalSeconds } = req.body || {};
  const count = Number(maxMessages);
  const interval = Number(intervalSeconds);
  if (!chatId || !String(chatId).endsWith("@c.us")) return res.status(400).json({ error: "Select a valid contact" });
  if (typeof message !== "string" || !message.trim() || message.length > 500) return res.status(400).json({ error: "Message must be 1–500 characters" });
  if (!Number.isInteger(count) || count < 1 || count > MAX_MESSAGES) return res.status(400).json({ error: `Choose 1–${MAX_MESSAGES} messages` });
  if (!Number.isInteger(interval) || interval < 60 || interval > 3600) return res.status(400).json({ error: "Interval must be 60–3600 seconds" });
  const job = {
    id: Date.now().toString(), chatId, message: message.trim(),
    maxMessages: count, intervalMs: interval * 1000,
    sent: 0, status: "running", startedAt: new Date().toISOString()
  };
  activeJob = job;
  res.json({ ok: true, job: { ...job, message: undefined } });
  runJob(job);
});

app.post("/api/stop", (req, res) => {
  stopJob("Stopped manually");
  res.json({ ok: true, activeJob });
});

app.get("/api/health", (req, res) => res.json({ ok: true, service: "waPilot", connected: clientReady }));

app.listen(PORT, () => console.log(`waPilot listening on ${PORT}`));
client.initialize().catch(e => {
  connectionState = "Client failed to start";
  lastError = e.message || String(e);
  console.error(e);
});
