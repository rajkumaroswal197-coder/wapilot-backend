const express = require('express');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: process.env.AUTH_PATH || '/app/.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
  }
});

let state = 'connecting';
let qrDataUrl = null;
let pairingCode = null;
let lastError = '';
let activeJob = null;
let totalSent = 0;
let lastMessage = '';
let selectedReplyStop = false;

const MAX_PER_RUN = 5;       // safety cap per run
const MIN_INTERVAL_SECONDS = 60;

function status() {
  return {
    state, qrDataUrl, pairingCode, lastError,
    totalSent, active: !!activeJob,
    jobSent: activeJob ? activeJob.sent : 0,
    lastMessage
  };
}

client.on('qr', async qr => {
  try {
    qrDataUrl = await QRCode.toDataURL(qr);
    pairingCode = null;
    state = 'qr';
    lastError = '';
  } catch (e) { lastError = e.message; }
});
client.on('authenticated', () => { state = 'connecting'; qrDataUrl = null; pairingCode = null; });
client.on('ready', () => { state = 'connected'; qrDataUrl = null; pairingCode = null; lastError = ''; });
client.on('auth_failure', msg => { state = 'disconnected'; lastError = String(msg || 'Authentication failed'); });
client.on('disconnected', reason => {
  state = 'disconnected';
  lastError = String(reason || 'Disconnected');
  stopJob('WhatsApp disconnected');
});
client.on('message', msg => {
  if (!activeJob || msg.fromMe) return;
  if (msg.from === activeJob.chatId) stopJob('Reply received — automation stopped');
});

function stopJob(reason = 'Stopped manually') {
  if (activeJob?.timer) clearTimeout(activeJob.timer);
  if (activeJob) lastMessage = reason;
  activeJob = null;
}

async function runNext() {
  if (!activeJob || state !== 'connected') return;
  if (activeJob.sent >= activeJob.count) {
    stopJob('Completed requested count');
    return;
  }
  try {
    await client.sendMessage(activeJob.chatId, activeJob.message);
    activeJob.sent += 1;
    totalSent += 1;
    lastMessage = `Sent ${activeJob.sent}/${activeJob.count}`;
  } catch (e) {
    lastError = e.message;
    stopJob('Sending failed');
    return;
  }
  if (activeJob && activeJob.sent < activeJob.count) {
    activeJob.timer = setTimeout(runNext, activeJob.interval * 1000);
  } else {
    stopJob('Completed requested count');
  }
}

app.get('/api/status', (req, res) => res.json(status()));

app.post('/api/pair', async (req, res) => {
  if (state === 'connected') return res.status(409).json({ error: 'Already connected. Use QR only if you are linking a new session.' });
  const phone = String(req.body.phone || '').replace(/\D/g, '');
  if (phone.length < 8 || phone.length > 15) return res.status(400).json({ error: 'Enter country code + phone number, digits only.' });
  try {
    if (state === 'disconnected') {
      state = 'connecting';
      client.initialize().catch(e => { state = 'disconnected'; lastError = e.message; });
    }
    // Give WhatsApp Web time to load before requesting the code.
    const started = Date.now();
    while (!client.pupPage && Date.now() - started < 45000) {
      await new Promise(r => setTimeout(r, 500));
    }
    if (!client.pupPage) throw new Error('WhatsApp Web is still loading. Try again in a few seconds.');
    const code = await client.requestPairingCode(phone, true, 180000);
    pairingCode = code;
    qrDataUrl = null;
    state = 'pairing';
    res.json({ pairingCode: code, status: state });
  } catch (e) {
    lastError = e.message;
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/qr', async (req, res) => {
  try {
    if (typeof client.cancelPairingCode === 'function' && state === 'pairing') {
      await client.cancelPairingCode();
      pairingCode = null;
      state = 'connecting';
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/contacts', async (req, res) => {
  if (state !== 'connected') return res.status(409).json({ error: 'Connect WhatsApp first.' });
  try {
    const chats = await client.getChats();
    const contacts = chats
      .filter(c => !c.isGroup && c.id?._serialized)
      .map(c => ({ id: c.id._serialized, name: c.name || c.id.user }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 250);
    res.json({ contacts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/start', async (req, res) => {
  if (state !== 'connected') return res.status(409).json({ error: 'WhatsApp is not connected.' });
  if (activeJob) return res.status(409).json({ error: 'A sending task is already running.' });
  const { chatId, message } = req.body || {};
  const count = Number(req.body?.count);
  const interval = Number(req.body?.interval);
  if (!chatId || typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Choose a contact and enter a message.' });
  if (!Number.isInteger(count) || count < 1 || count > MAX_PER_RUN) return res.status(400).json({ error: `Count must be between 1 and ${MAX_PER_RUN} per run.` });
  if (!Number.isInteger(interval) || interval < MIN_INTERVAL_SECONDS || interval > 3600) return res.status(400).json({ error: `Interval must be ${MIN_INTERVAL_SECONDS}–3600 seconds.` });
  activeJob = { chatId, message: message.trim().slice(0, 1000), count, interval, sent: 0, timer: null };
  lastError = '';
  runNext();
  res.json({ ok: true, message: 'Sending started.' });
});

app.post('/api/stop', (req, res) => {
  stopJob('Stopped manually');
  res.json({ ok: true });
});

app.post('/api/logout', async (req, res) => {
  stopJob('Logged out');
  try {
    await client.logout();
    state = 'disconnected';
    qrDataUrl = null;
    pairingCode = null;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, state }));

app.listen(PORT, () => console.log(`waPilot listening on ${PORT}`));
client.initialize().catch(e => {
  state = 'disconnected';
  lastError = e.message;
  console.error('WhatsApp initialization failed:', e);
});
