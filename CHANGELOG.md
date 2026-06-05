# Changelog

## [1.0.1] - 2026-06-05

### Added

- **Send SMS** (`sendsms`): single recipient or bulk from prior query step
- **Calculate SMS Price** (`calculateprice`): price preview with same recipient options
- **Send SMS Campaign** (`sendcampaign`): send to ClickSend `list_id`
- Credentials from `process.env` (`CLICKSEND_USERNAME`, `CLICKSEND_API_KEY`)
- Automatic batching above 1000 recipients per ClickSend send API limit
- Phone normalisation and column name extraction from data picker bindings

### Fixed

- **Success detection:** ClickSend can return HTTP 200 / `SUCCESS` while queuing zero messages (e.g. `INVALID_SENDER_ID` on an unregistered **From**). The extension checks `data.messages[].status` and `queued_count` and returns `success: false` with a clear `error`.

### Documentation

- README troubleshooting for “API says success but no SMS arrives”; **From** field help in HJSON.
