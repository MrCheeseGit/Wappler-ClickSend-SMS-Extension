# ClickSend examples

Generic API step fragments. Replace connection and table names with your project.

| File | Demonstrates |
|------|----------------|
| [send-single.json](send-single.json) | One SMS to a bound phone number |
| [send-from-query.json](send-from-query.json) | Query step + bulk SMS |
| [send-campaign.json](send-campaign.json) | Campaign to a ClickSend `list_id` |

Ensure `CLICKSEND_USERNAME` and `CLICKSEND_API_KEY` are set in project env before testing.

Examples omit **From (Sender ID)** so ClickSend uses the shared number. Add `from` only if that sender is registered in your ClickSend account (see main README troubleshooting).
