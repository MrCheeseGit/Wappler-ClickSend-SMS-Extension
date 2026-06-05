/**
 * ClickSend SMS for Wappler Server Connect (Node).
 * Credentials: process.env.CLICKSEND_USERNAME + CLICKSEND_API_KEY (Wappler config env).
 */

const axios = require('axios');

const BASE_URL = 'https://rest.clicksend.com';
const MAX_MESSAGES_PER_REQUEST = 1000;

/**
 * @returns {{ username: string, apiKey: string }}
 */
function getCredentials() {
    const username = process.env.CLICKSEND_USERNAME;
    const apiKey = process.env.CLICKSEND_API_KEY;
    if (!username || !apiKey) {
        throw new Error(
            'Missing CLICKSEND_USERNAME or CLICKSEND_API_KEY. Add them in Wappler Project Settings → Environment (app/config/config.json env), then restart the server.'
        );
    }
    return { username: String(username).trim(), apiKey: String(apiKey).trim() };
}

/**
 * @returns {string}
 */
function getAuthHeader() {
    const { username, apiKey } = getCredentials();
    const token = Buffer.from(`${username}:${apiKey}`, 'utf8').toString('base64');
    return `Basic ${token}`;
}

/**
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<object>}
 */
async function clickSendRequest(method, path, body) {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    try {
        const response = await axios({
            method,
            url,
            data: body,
            headers: {
                Authorization: getAuthHeader(),
                'Content-Type': 'application/json'
            },
            validateStatus: () => true
        });
        return response.data;
    } catch (error) {
        const message = error.response?.data?.response_msg || error.message || 'ClickSend request failed';
        throw new Error(message);
    }
}

/**
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseGrid(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        try {
            return parseGrid(JSON.parse(value));
        } catch {
            return [];
        }
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => value[k])
            .filter((row) => row && typeof row === 'object');
    }
    return [];
}

/**
 * @param {unknown} input
 * @returns {string}
 */
function resolveFieldName(input) {
    const s = String(input || '').trim();
    if (!s) return '';

    const binding = s.match(/\{\{([^}]+)\}\}/);
    const path = binding ? binding[1].trim() : s;

    if (path.includes('{{')) return '';

    const pathMatch = path.match(/(?:^|[.\[])([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (pathMatch) return pathMatch[1];

    if (path.includes('.')) {
        const parts = path.split('.').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : '';
    }

    return path;
}

/**
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
function parseGridRaw(value) {
    return parseGrid(value);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} fieldName
 * @returns {unknown}
 */
function getRowFieldValue(row, fieldName) {
    if (!fieldName || !row) return '';
    if (Object.prototype.hasOwnProperty.call(row, fieldName)) {
        return row[fieldName];
    }
    const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
    return key ? row[key] : '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizePhone(value) {
    let s = String(value ?? '').trim();
    if (!s) return '';

    s = s.replace(/[^\d+]/g, '');
    if (!s) return '';

    if (s.startsWith('00')) {
        s = `+${s.slice(2)}`;
    } else if (!s.startsWith('+')) {
        s = `+${s}`;
    }

    const digits = s.replace(/\D/g, '');
    if (digits.length < 8) return '';

    return s;
}

/**
 * @param {unknown} value
 * @returns {number|undefined}
 */
function parseSchedule(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * @param {object} ctx
 * @param {Function} parseOptional
 * @param {object} options
 * @returns {{ messages: Array<object>, skipped: number }}
 */
function buildMessagesFromOptions(ctx, options) {
    const mode = ctx.parseOptional(options.mode, 'string', 'single');
    const body = ctx.parseOptional(options.body, 'string', '');
    const from = ctx.parseOptional(options.from, 'string', '');
    const schedule = parseSchedule(ctx.parseOptional(options.schedule, '*', ''));
    const shortenUrls = !!ctx.parseOptional(options.shorten_urls, 'boolean', false);
    const customString = ctx.parseOptional(options.custom_string, 'string', '');
    const source = ctx.parseOptional(options.source, 'string', 'wappler');

    if (!body.trim()) {
        throw new Error('Message body is required.');
    }

    const base = {
        body: body.trim(),
        source
    };
    if (from) base.from = String(from).trim();
    if (schedule !== undefined) base.schedule = schedule;
    if (customString) base.custom_string = String(customString).trim();

    const messages = [];
    let skipped = 0;

    if (mode === 'fromQuery') {
        const sourceData = ctx.parseOptional(options.sourceData, '*', []);
        const rows = Array.isArray(sourceData) ? sourceData : parseGrid(sourceData);
        if (!rows.length) {
            throw new Error(
                'Query results are empty. Add a database query step above this action, then bind its output to Query results.'
            );
        }

        const phoneField = resolveFieldName(options.phoneColumn);
        if (!phoneField) {
            throw new Error('Phone column is required when sending to query results.');
        }

        for (const row of rows) {
            const phone = normalizePhone(getRowFieldValue(row, phoneField));
            if (!phone) {
                skipped += 1;
                continue;
            }
            messages.push({ ...base, to: phone });
        }
    } else {
        const to = normalizePhone(ctx.parseOptional(options.to, 'string', ''));
        if (!to) {
            throw new Error('Recipient number (to) is required for single SMS mode.');
        }
        messages.push({ ...base, to });
    }

    if (!messages.length) {
        throw new Error('No valid recipient phone numbers found.');
    }

    const payload = { messages };
    if (shortenUrls) {
        payload.shorten_urls = true;
    }

    return { messages: payload.messages, payload, skipped };
}

/**
 * ClickSend often returns http_code 200 and response_code SUCCESS even when no SMS
 * was queued (e.g. INVALID_SENDER_ID). Inspect per-message status and queued_count.
 *
 * @param {object} apiResponse
 * @returns {{ success: boolean, data: object, error: string|null, http_code: number|null }}
 */
function formatClickSendResponse(apiResponse) {
    const httpCode = apiResponse?.http_code ?? null;
    const responseCode = String(apiResponse?.response_code || '').toUpperCase();
    const data = apiResponse?.data ?? apiResponse;
    const messages = Array.isArray(data?.messages) ? data.messages : [];

    const failed = messages.filter((m) => String(m?.status || '').toUpperCase() !== 'SUCCESS');
    const queuedCount = data?.queued_count;
    const nothingQueued =
        typeof queuedCount === 'number' && messages.length > 0 && queuedCount === 0;

    const apiOk = responseCode === 'SUCCESS' || httpCode === 200;
    const success = apiOk && failed.length === 0 && !nothingQueued;

    let error = null;
    if (!success) {
        if (failed.length) {
            const first = failed[0];
            const status = String(first.status || 'FAILED');
            const hint =
                status === 'INVALID_SENDER_ID'
                    ? ' Register this Sender ID in ClickSend, or leave From empty (shared number).'
                    : '';
            error = `ClickSend message failed: ${status} (to ${first.to || '?'}).${hint}`;
        } else if (!apiOk) {
            error = String(apiResponse?.response_msg || 'ClickSend API error');
        } else if (nothingQueued) {
            error = 'ClickSend accepted the request but queued 0 messages. Check From (Sender ID) and recipient numbers.';
        } else {
            error = String(apiResponse?.response_msg || 'ClickSend API error');
        }
    }

    return {
        success,
        http_code: httpCode,
        data,
        error
    };
}

/**
 * @param {Array<object>} messages
 * @param {boolean} shortenUrls
 * @returns {Array<object>}
 */
function chunkMessages(messages, shortenUrls) {
    const chunks = [];
    for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
        const slice = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
        const payload = { messages: slice };
        if (shortenUrls) payload.shorten_urls = true;
        chunks.push(payload);
    }
    return chunks;
}

/**
 * @param {string} path
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function sendMessagesBatched(path, payload) {
    const { messages, shorten_urls: shortenUrls } = payload;
    const chunks = chunkMessages(messages, !!shortenUrls);
    const batches = [];
    let totalSent = 0;

    for (let i = 0; i < chunks.length; i++) {
        const result = await clickSendRequest('POST', path, chunks[i]);
        const formatted = formatClickSendResponse(result);
        if (!formatted.success) {
            return {
                success: false,
                http_code: formatted.http_code,
                data: { batches, total_sent: totalSent },
                error: formatted.error || `Batch ${i + 1} failed`
            };
        }
        const batchCount =
            result?.data?.total_count ??
            result?.data?.messages?.length ??
            chunks[i].messages.length;
        totalSent += batchCount;
        batches.push({
            batch: i + 1,
            http_code: formatted.http_code,
            response: result
        });
    }

    return {
        success: true,
        http_code: 200,
        data: {
            total_sent: totalSent,
            batch_count: batches.length,
            batches,
            clicksend: batches[batches.length - 1]?.response
        },
        error: null
    };
}

exports.sendsms = async function (options) {
    try {
        const built = buildMessagesFromOptions(this, options);
        const result = await sendMessagesBatched('/v3/sms/send', built.payload);
        if (built.skipped > 0 && result.data) {
            result.data.skipped_invalid_numbers = built.skipped;
        }
        return result;
    } catch (error) {
        return {
            success: false,
            http_code: null,
            data: null,
            error: error.message
        };
    }
};

exports.calculateprice = async function (options) {
    try {
        const built = buildMessagesFromOptions(this, options);
        const result = await sendMessagesBatched('/v3/sms/price', built.payload);
        if (built.skipped > 0 && result.data) {
            result.data.skipped_invalid_numbers = built.skipped;
        }
        return result;
    } catch (error) {
        return {
            success: false,
            http_code: null,
            data: null,
            error: error.message
        };
    }
};

exports.sendcampaign = async function (options) {
    try {
        const listId = parseInt(String(this.parseOptional(options.list_id, '*', '')), 10);
        if (!Number.isFinite(listId) || listId <= 0) {
            throw new Error('ClickSend list_id is required (integer from your ClickSend contact list).');
        }

        const name = this.parseOptional(options.name, 'string', '');
        const body = this.parseOptional(options.body, 'string', '');
        const from = this.parseOptional(options.from, 'string', '');

        if (!name.trim()) throw new Error('Campaign name is required.');
        if (!body.trim()) throw new Error('Campaign message body is required.');

        const payload = {
            list_id: listId,
            name: name.trim(),
            body: body.trim(),
            source: this.parseOptional(options.source, 'string', 'wappler')
        };

        if (from) payload.from = from.trim();

        const schedule = parseSchedule(this.parseOptional(options.schedule, '*', ''));
        if (schedule !== undefined) payload.schedule = schedule;

        const urlToShorten = this.parseOptional(options.url_to_shorten, 'string', '');
        if (urlToShorten) payload.url_to_shorten = urlToShorten.trim();

        const sendersRaw = String(options.sendersJson || '').trim();
        if (sendersRaw) {
            try {
                const parsed = JSON.parse(sendersRaw);
                if (Array.isArray(parsed) && parsed.length) {
                    payload.senders = parsed;
                }
            } catch {
                throw new Error('Senders JSON must be a valid JSON array.');
            }
        }

        const apiResponse = await clickSendRequest('POST', '/v3/sms-campaigns/send', payload);
        return formatClickSendResponse(apiResponse);
    } catch (error) {
        return {
            success: false,
            http_code: null,
            data: null,
            error: error.message
        };
    }
};

exports._getCredentials = getCredentials;
exports._normalizePhone = normalizePhone;
exports._resolveFieldName = resolveFieldName;
exports._buildMessagesFromOptions = buildMessagesFromOptions;
