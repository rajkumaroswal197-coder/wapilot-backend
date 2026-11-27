const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data", "jobs.json");

function readJobs() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); }
  catch { return []; }
}
function writeJobs(jobs) {
  fs.mkdirSync(path.dirname(DATA), {recursive:true});
  fs.writeFileSync(DATA, JSON.stringify(jobs, null, 2));
}
let jobs = readJobs();

app.get("/api/health", (_req,res) => res.json({ok:true, service:"waPilot backend"}));
app.get("/api/jobs", (_req,res) => res.json(jobs));

/*
  Safe starter backend:
  - creates a bounded apology-message plan
  - does NOT connect to WhatsApp or send messages by itself
  - real delivery must be implemented with an authorized WhatsApp Business API account
*/
app.post("/api/jobs", (req,res) => {
  const {contact, phone, count} = req.body || {};
  const n = Number(count);
  if (!contact || !phone) return res.status(400).json({error:"Contact name and phone are required."});
  if (!Number.isInteger(n) || n < 1 || n > 3) {
    return res.status(400).json({error:"For safety, choose between 1 and 3 messages per plan."});
  }
  const job = {
    id: Date.now().toString(),
    contact: String(contact).slice(0,80),
    phone: String(phone).slice(0,30),
    message: "Sorry",
    count: n,
    status: "draft",
    note: "Draft only. No WhatsApp message has been sent.",
    createdAt: new Date().toISOString()
  };
  jobs.unshift(job);
  writeJobs(jobs);
  res.status(201).json(job);
});

app.post("/api/jobs/:id/stop", (req,res) => {
  const job = jobs.find(x => x.id === req.params.id);
  if (!job) return res.status(404).json({error:"Plan not found."});
  job.status = "stopped";
  job.note = "Stopped by user. No messages were sent by this starter backend.";
  writeJobs(jobs);
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`waPilot backend running on http://localhost:${PORT}`);
});
