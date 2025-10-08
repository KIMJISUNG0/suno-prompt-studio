import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Gemini API 키를 코드에 직접 삽입
const GEM_API_KEY = 'AIzaSyD5a-tlQDGxE7BRamVmVbmwsUxmCzdnYdM';
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-pro').trim();
const RAW_FALLBACKS = (process.env.GEMINI_MODEL_FALLBACKS || 'gemini-pro').split(',').map(s => s.trim()).filter(Boolean);

const cleanName = (m) => m.replace(/-latest$/,'').trim();
const FALLBACK_MODELS = Array.from(new Set([ cleanName(PRIMARY_MODEL), ...RAW_FALLBACKS.map(cleanName) ]));

const DEBUG = String(process.env.DEBUG_ERRORS || '').toLowerCase() === '1';

// 주요 악기 우선순위 리스트
const corePriority = ['Piano', 'Breakbeat Drums', 'Reese Bass', 'Sub Bass', 'Atmos Pad', 'Synth Lead', 'Amen Break'];

function sortCore(coreList) {
  return corePriority.filter(i => coreList.includes(i)).concat(coreList.filter(i => !corePriority.includes(i)));
}

async function genWithModel(model, prompt) {
  // CORE 항목 자동 정렬
  let sortedPrompt = prompt;
  const coreMatch = prompt.match(/CORE:\s*([^|]*)/i);
  if (coreMatch) {
    const coreRaw = coreMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const sortedCore = sortCore(coreRaw);
    sortedPrompt = prompt.replace(/CORE:\s*([^|]*)/i, `CORE: ${sortedCore.join(', ')}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(GEM_API_KEY)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: sortedPrompt }]}]
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HTTP ${r.status} ${r.statusText} — ${txt.slice(0,500)}`);
  }
  const j = await r.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text).filter(Boolean).join('\n').trim();
  if (!text) throw new Error('Empty response');
  return text;
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
  if (!GEM_API_KEY) return res.status(500).json({ ok:false, error:'Missing GEMINI_API_KEY' });
  const prompt = (req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ ok:false, error:'Empty prompt' });

  const start = Date.now();
  const tried = [];
  let lastErr;

  for (const model of FALLBACK_MODELS) {
    tried.push(model);
    try {
      const modelStart = Date.now();
      const text = await genWithModel(model, prompt);
      return res.json({
        ok: true,
        text,
        model,
        tried,
        ms: Date.now() - start,
        modelMs: Date.now() - modelStart
      });
    } catch (e) {
      lastErr = e;
      if (DEBUG) console.error('[gemini]', model, 'failed:', String(e).slice(0,500));
    }
  }
  return res.status(500).json({
    ok:false,
    error:'Gemini request failed',
    tried,
    ms: Date.now() - start,
    detail: DEBUG && lastErr ? String(lastErr).slice(0,500) : undefined
  });
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 11000;
app.listen(PORT, () => console.log('[server] listening on', PORT, 'primary:', PRIMARY_MODEL, 'fallbacks:', FALLBACK_MODELS.join(',')));
