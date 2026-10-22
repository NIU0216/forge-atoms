/**
 * DeepSeek OpenAI-compatible chat client.
 * Reads DEEPSEEK_API_KEY from env; never logs the key value.
 */

const DEFAULT_BASE = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';
const TIMEOUT_MS = 90000;

function getConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

function hasApiKey() {
  return Boolean(getConfig().apiKey);
}

function stripFences(text) {
  let s = String(text || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return s.trim();
}

async function fetchOnce(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ system?: string, user: string, temperature?: number, response_format?: object }} opts
 * @returns {Promise<string>}
 */
async function chat({ system, user, temperature = 0.7, response_format } = {}) {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) {
    const err = new Error('缺少 DEEPSEEK_API_KEY：请在环境变量中配置 DeepSeek API Key 后再试。');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  if (!user) throw new Error('chat: user message required');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const body = {
    model,
    messages,
    temperature,
    stream: false,
  };
  if (response_format) body.response_format = response_format;

  const url = `${baseUrl}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchOnce(
        url,
        { method: 'POST', headers, body: JSON.stringify(body) },
        TIMEOUT_MS
      );
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`DeepSeek API ${res.status}`);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw lastErr;
      }

      if (!res.ok) {
        const msg =
          (data && (data.error?.message || data.message)) ||
          `DeepSeek API error ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('DeepSeek API returned empty content');
      }
      return content;
    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') {
        lastErr = new Error('DeepSeek API 请求超时');
      }
      const retryable =
        attempt === 0 &&
        (err.status === 429 ||
          (err.status && err.status >= 500) ||
          err.name === 'AbortError' ||
          /timeout|ECONNRESET|fetch failed|network/i.test(String(err.message)));
      if (retryable) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error('DeepSeek API failed');
}

/**
 * Ask for JSON and parse. Strips markdown fences.
 */
async function chatJson(opts) {
  const systemExtra =
    '你必须只输出合法 JSON，不要 markdown 代码围栏，不要解释文字。';
  const system = opts.system ? `${opts.system}\n\n${systemExtra}` : systemExtra;
  const raw = await chat({
    ...opts,
    system,
    response_format: opts.response_format || { type: 'json_object' },
  });
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // try to extract first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) {}
    }
    throw new Error('无法解析模型返回的 JSON：' + e.message);
  }
}

module.exports = { chat, chatJson, hasApiKey, stripFences, getConfig };
