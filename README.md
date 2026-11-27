# waPilot — Personal WhatsApp QR automation

## What it does
- Connects to a personal WhatsApp account by scanning a WhatsApp Web QR.
- Loads one-to-one chats so you can select one contact.
- Sends a chosen message on a timer.
- Stops immediately when an incoming message arrives from that selected chat.
- Shows status in the browser and requests browser notification permission.

## Important safety limits
This build deliberately caps each run at **3 messages**, requires at least **60 seconds** between messages, and allows manual stop. It is not an unlimited message sender. Use it only for a genuine, appropriate conversation and stop if the recipient does not want further contact.

## Important WhatsApp warning
This uses the unofficial `whatsapp-web.js` browser automation library, not an official WhatsApp API. WhatsApp may log out, break compatibility, or restrict the account. Use at your own risk. Never share the QR, session folder, or API key.

## Run locally
Requires Node.js 20+ and Chromium.
```bash
npm install
npm start
```
Open `http://localhost:3000`. Scan the QR from WhatsApp → Linked devices → Link a device.

## Deploying
Deploy as a Docker web service on a host that permits Chromium and provides a **persistent disk/volume**. Mount the persistent volume at `/app/.wwebjs_auth` so the linked-device session survives restarts. Keep one instance only; do not scale to multiple replicas. A sleeping/free web service will not reliably keep automation running. Add an access-control layer before exposing this publicly.

## Notes
- The browser page must remain open to display live status/notifications, but the Node service performs the timed sends and reply detection.
- Browser notifications require permission and may be suppressed by Android/browser battery settings.
- This project does not send anything until you scan the QR, choose a contact, and press Start.
