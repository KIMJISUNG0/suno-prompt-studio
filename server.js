import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const GEM_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
// 프로 권한이 있으면 환경변수로 덮어쓰고, 없으면 flash 기본
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();

// 환경변수로 커스터마이즈 가능: GEMINI_MODEL_FALLBACKS="gemini-1.5-flash,gemini-1.5-flash-8b,gemini-1.5-pro"
// -latest 변형은 현재 generateContent() 에서 404 빈도가 높아 기본 필터링
const FALLBACK_MODELS = (() => {
  const raw = (process.env.GEMINI_MODEL_FALLBACKS || 'gemini-1.5-flash,gemini-1.5-flash-8b,gemini-1.5-pro')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const cleaned = raw
    .map(m => m.replace(/-latest$/,'').trim()) // -latest 제거 시도
    .filter(m => !m.includes('..'));
  // PRIMARY 가 맨 앞, 나머지 중복 제거
  const order = [PRIMARY_MODEL, ...cleaned.filter(m => m !== PRIMARY_MODEL)];
  // 허용 prefix 검증(간단 필터)
  const allowPrefixes = ['gemini-1.5-flash','gemini-1.5-pro'];
  return order.filter(m => allowPrefixes.some(p => m.startsWith(p)));
})();

const DEBUG = !!process.env.DEBUG_ERRORS;
const log = (...args) => { if (DEBUG) console.log('[gemini]', ...args); };

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    hasKey: !!GEM_API_KEY,
    primary: PRIMARY_MODEL,
    fallbacks: FALLBACK_MODELS,
    envFallbacks: process.env.GEMINI_MODEL_FALLBACKS || null,
    debug: DEBUG
  });
});

app.post('/api/gemini', async (req, res) => {
  if (!GEM_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  const prompt = (req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

  const start = Date.now();
  const genAI = new GoogleGenerativeAI(GEM_API_KEY);
  const systemInstruction = 'Refine structured music prompts. Plain text only.';
  const tried = [];
  let lastErr;

  for (const modelName of FALLBACK_MODELS) {
    tried.push(modelName);
    try {
      log('try model', modelName);
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
      const modelStart = Date.now();
      const result = await model.generateContent(prompt);
      const text = result.response?.text?.();
      if (!text) throw new Error('Empty response');
      const totalMs = Date.now() - start;
      const modelMs = Date.now() - modelStart;
      log('success model', modelName, 'totalMs', totalMs, 'modelMs', modelMs);
      return res.json({
        text: text.replace(/[*#]/g, '').trim(),
        model: modelName,
        ms: totalMs,
        modelLatency: modelMs,
        tried
      });
    } catch (e) {
      lastErr = e;
      const msg = (e?.message || '').toLowerCase();
      log('fail model', modelName, msg);
      if (msg.includes('not found') || msg.includes('unsupported') || msg.includes('is not supported')) continue; // fallback 계속
      break; // 즉시 중단
    }
  }

  let kind = 'unknown';
  if (lastErr) {
    const m = String(lastErr);
    if (/PERMISSION/i.test(m)) kind = 'permission';
    else if (/QUOTA|exceed/i.test(m)) kind = 'quota';
    else if (/NOT_FOUND|model/i.test(m)) kind = 'model_not_found';
    else if (/network|fetch|ECONN|ENOTFOUND|ETIMEDOUT/i.test(m)) kind = 'network';
    else if (/Empty response/i.test(m)) kind = 'empty';
  }

  res.status(500).json({
    error: 'Failed to generate content from Gemini API',
    tried,
    kind,
    ms: Date.now() - start,
    detail: DEBUG && lastErr ? String(lastErr).slice(0,500) : undefined
  });
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('[server] listening on', PORT, 'primary:', PRIMARY_MODEL, 'fallbacks:', FALLBACK_MODELS.join(',')));
