# waPilot backend

## What this backend does
- Runs an Express API.
- Stores bounded apology-message plans in `data/jobs.json`.
- Supports listing plans and stopping a plan.
- It does **not** log in to personal WhatsApp or send WhatsApp messages.

## Run locally
Install Node.js, then in this folder run:

```bash
npm install
npm start
```

Open `http://localhost:3000/api/health`.

## API
- `GET /api/health`
- `GET /api/jobs`
- `POST /api/jobs` JSON: `{"contact":"Rahul","phone":"+919000000001","count":2}`
- `POST /api/jobs/:id/stop`

The starter limits each plan to 1–3 messages and creates drafts only. It deliberately has no unofficial WhatsApp Web login or bulk-send automation.

## Real WhatsApp delivery
For supported automated delivery, connect an eligible WhatsApp Business Platform / Cloud API account and implement its approved messaging rules, consent checks, templates where required, and webhook verification. A normal personal WhatsApp account cannot simply be logged into this Cloud API.
