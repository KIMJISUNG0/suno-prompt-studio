import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const GEM_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
// 프로 권한이 있으면 환경변수로 덮어쓰고, 없으면 flash 기본
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-pro').trim();

// 환경변수로 커스터마이즈 가능: GEMINI_MODEL_FALLBACKS="gemini-pro"
const FALLBACK_MODELS = (process.env.GEMINI_MODEL_FALLBACKS || 'gemini-pro')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEBUG = !!process.env.DEBUG_ERRORS;
const log = (...args) => { if (DEBUG) console.log('[gemini]', ...args); };
async function generateWithModel(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEM_API_KEY}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [ { text: prompt } ]
      }
    ]
  };
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || res.statusText);
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');
    return { text: text.trim(), latency: Date.now()-started };
  } catch (err) {
    throw { model, error: err.message || String(err), latency: Date.now()-started };
  }
}

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    hasKey: !!GEM_API_KEY,
    primary: PRIMARY_MODEL,
    fallbacks: FALLBACK_MODELS,
    envFallbacks: process.env.GEMINI_MODEL_FALLBACKS || null,
    debug: DEBUG,
    env: {
      GEMINI_API_KEY: !!GEM_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_MODEL_FALLBACKS: process.env.GEMINI_MODEL_FALLBACKS,
      DEBUG_ERRORS: process.env.DEBUG_ERRORS
    }
  });
});

app.post('/api/gemini', async (req, res) => {
  if (!GEM_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  const prompt = (req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });
  const start = Date.now();

  const tried = [];
  const errors = [];
  let result = null;
  let usedModel = null;
  for (const modelName of [PRIMARY_MODEL, ...FALLBACK_MODELS.filter(m => m !== PRIMARY_MODEL)]) {
    if (!modelName) continue;
    tried.push(modelName);
    try {
      const r = await generateWithModel(modelName, prompt);
      result = r;
      usedModel = modelName;
      break;
    } catch (err) {
      errors.push(err);
      log('fail model', modelName, err.error);
    }
  }
  if (result) {
    return res.json({
      text: result.text,
      model: usedModel,
      tried,
      latency: result.latency,
      ms: Date.now() - start
    });
  } else {
    const lastErr = errors[errors.length-1] || {};
    res.status(500).json({
      error: 'Failed to generate content from Gemini API',
      tried,
      errors,
      lastError: lastErr.error,
      ms: Date.now() - start
    });
  }
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 11000;
app.listen(PORT, () => console.log('[server] listening on', PORT, 'primary:', PRIMARY_MODEL, 'fallbacks:', FALLBACK_MODELS.join(',')));
