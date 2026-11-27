# waPilot 2.0

Mobile-friendly WhatsApp linked-device dashboard with QR login, phone-number pairing code, status polling, contact list, message counter, manual stop, and stop-on-reply.

## Important limits
- Each run is capped at **5 messages**.
- Minimum interval is **60 seconds**.
- The dashboard counts messages sent; it does not offer unlimited automated sending.
- Use only for consensual, expected messages. Unofficial WhatsApp Web automation can break or lead to account restrictions. This is not an official WhatsApp product.

## Deploy on Render
1. Upload all files in this ZIP to a GitHub repository.
2. In Render, create a **New Web Service** and connect that repository.
3. Choose **Docker** runtime. Do not choose Node runtime.
4. Add a persistent disk, mount path: `/app/.wwebjs_auth` (1 GB is sufficient for a small session).
5. Deploy, then open the Render URL.

## Login
- QR: open QR Login and scan from WhatsApp → Linked devices → Link a device.
- Pairing code: choose 8-digit Code, enter phone number with country code (India example: 91 followed by the 10-digit number), then enter the displayed code in WhatsApp → Linked devices → Link a device → Link with phone number instead.
- Pairing code support depends on the current WhatsApp Web version and may stop working after upstream changes. If it fails, use QR login.

## Sending
1. Wait for Connected.
2. Refresh contacts and select one contact.
3. Enter a message, count (1–5), and interval (60–3600 seconds).
4. Press Start. Press Stop at any time. A reply from the selected contact stops the run.

## Session persistence
The Render disk is required to keep the linked-device session across restarts/redeploys. Do not share the Render URL or session files publicly.
