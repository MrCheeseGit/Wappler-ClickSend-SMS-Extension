# ClickSend SMS (Wappler Server Connect)

Send SMS via [ClickSend](https://www.clicksend.com/) from Wappler Server Connect (Node): single messages, bulk send from a database query, price preview, and SMS campaigns to a ClickSend contact list.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.0.1-green)

Built by **[Mr Cheese](https://www.mrcheese.co.uk)**.

---

## Requirements

- Wappler **Server Connect (Node)**
- ClickSend account with API access
- Environment variables configured in the project (see below)

---

## Credentials (required)

**Do not** put API keys in extension step options (they are saved in API JSON and may be committed to Git).

Add to **Wappler Project Settings → Environment** (`app/config/config.json` under `env`):

| Variable | Description |
|----------|-------------|
| `CLICKSEND_USERNAME` | Your ClickSend API username (often your account email) |
| `CLICKSEND_API_KEY` | Your ClickSend API key |

Restart the Node server after changing env values.

---

## Installation

Copy into your Wappler project:

```bash
cp clicksend.js [YOUR_PROJECT]/lib/modules/
cp clicksend_sendsms.hjson clicksend_calculateprice.hjson clicksend_sendcampaign.hjson [YOUR_PROJECT]/extensions/server_connect/modules/
```

**Quit Wappler completely and restart.**

**Upgrading:** copy the same files again (especially `clicksend.js`), then restart Wappler and the Node server.

Actions appear under **Mr Cheese**:

- **ClickSend Send SMS**
- **ClickSend Calculate SMS Price**
- **ClickSend SMS Campaign**

Wappler installs `axios` via `usedModules` in the HJSON files.

---

## Actions

### Send SMS

| Mode | Use |
|------|-----|
| **Single recipient** | One number via data picker (`{{$_GET.phone}}`, etc.) |
| **Send to query results** | Bind a prior **Database Query** step; pick the **phone column** (same pattern as [Wap-Lastic](../Wap-Lastic-Extension)) |

Uses `POST /v3/sms/send`. Sends up to **1000 messages per API call**; larger lists are split into batches automatically.

### Calculate SMS Price

Same recipient options as **Send SMS**, but calls `POST /v3/sms/price` (no messages sent).

### Send SMS Campaign

Sends to a **ClickSend contact list** by `list_id` (from your ClickSend dashboard). Uses `POST /v3/sms-campaigns/send`.

This does **not** read phone numbers from a Wappler query. For query-based bulk SMS, use **Send to query results**.

---

## Typical workflows

### Single SMS

```
API: ClickSend Send SMS
  Mode: Single recipient
  To: {{$_GET.phone}}
  Body: Your message
  From: +447... or YourBrand
```

### Bulk from query

```
1. Database Query (SELECT)     ← phones + any filters
2. ClickSend Send SMS
     Mode: Send to query results
     Query results: {{contactsQuery}}
     Phone column: {{contactsQuery[0].mobile}}
     Body: Hello from our app
```

### Campaign (ClickSend list)

```
1. Create list in ClickSend dashboard → note list_id
2. ClickSend SMS Campaign
     list_id: 428
     name: March promo
     body: Your message (include opt-out for marketing)
     from: Your sender ID
```

---

## Response shape

All actions return an object suitable for App Connect:

```json
{
  "success": true,
  "http_code": 200,
  "data": { },
  "error": null
}
```

Bulk send `data` includes `total_sent`, `batch_count`, and per-batch ClickSend responses.

---

## Troubleshooting: API says success but no SMS arrives

ClickSend can return **HTTP 200** and `response_code: SUCCESS` while **queuing zero messages**. Check the step output `data.messages[].status` (v1.0.1+ also sets `success: false` and a clear `error`).

| Symptom | Cause | Fix |
|---------|--------|-----|
| `INVALID_SENDER_ID` | **From** is not registered in your ClickSend account | Leave **From** empty (shared number, like a plain API connector step), or register the alpha tag / number in ClickSend first |
| `queued_count: 0` | Same as above, or invalid numbers | Fix **From** or **To** (E.164, e.g. `+351...`) |

Minimal working payload (no `from`):

```json
{
  "messages": [
    { "source": "myapp", "to": "+351...", "body": "Your text" }
  ]
}
```

---

## Notes

- Use **E.164** phone format where possible (`+447700900123`).
- **From (Sender ID):** optional. If set, it must be an approved dedicated number or alpha tag in ClickSend; otherwise messages are not queued.
- ClickSend may restrict messages containing **URLs** for new accounts.
- **Marketing** SMS often requires an opt-out (e.g. “Reply STOP” or ClickSend `StopMsg.me` placeholder).
- Invalid or empty numbers in query mode are **skipped**; see `skipped_invalid_numbers` in the response.

---

## v1.1 ideas

- Import query rows into a ClickSend list, then campaign send
- List picker (fetch contact lists from API)
- Cancel SMS, templates, delivery receipts

---

## Works well with Generate Auth Code

Pair this extension with **[Generate Auth Code for Wappler](https://github.com/MrCheeseGit/Wappler-Generate-Auth-Code-Extension)** for SMS verification flows:

```
Generate Auth Code  →  ClickSend Send SMS
```

1. **Generate Auth Code** — e.g. numeric, length `6`
2. **ClickSend Send SMS** — bind `body` to include `{{authCode.code}}` and `to` to the user’s number

Typical uses: registration PIN, login OTP, password-reset codes sent by text. Both extensions appear under **Mr Cheese** in Server Connect.

---

## Links

- [Generate Auth Code extension (GitHub)](https://github.com/MrCheeseGit/Wappler-Generate-Auth-Code-Extension)
- [ClickSend SMS API](https://developers.clicksend.com/docs/messaging/sms)
- [Send SMS Campaign](https://developers.clicksend.com/docs/messaging/sms-campaigns/other/send-sms-campaign)

---

MIT © [Mr Cheese](https://www.mrcheese.co.uk)
