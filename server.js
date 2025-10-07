import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const GEM_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
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

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!GEM_API_KEY,
    primary: PRIMARY_MODEL,
    fallbacks: FALLBACK_MODELS,
    debug: !!process.env.DEBUG_ERRORS,
    envFallbacks: process.env.GEMINI_MODEL_FALLBACKS || null
  });
});

app.post('/api/gemini', async (req, res) => {
  if (!GEM_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  const prompt = (req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

  const genAI = new GoogleGenerativeAI(GEM_API_KEY);
  const systemInstruction = 'Refine structured music prompts. Plain text only.';
  const tried = [];
  let lastErr;

  for (const modelName of FALLBACK_MODELS) {
    tried.push(modelName);
    try {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
      const t0 = Date.now();
      const result = await model.generateContent(prompt);
      const text = result.response?.text?.();
      if (!text) throw new Error('Empty response');
      return res.json({
        text: text.replace(/[*#]/g, '').trim(),
        model: modelName,
        ms: Date.now() - t0,
        tried
      });
    } catch (e) {
      lastErr = e;
      const msg = (e?.message || '').toLowerCase();
      // 모델 미존재 / 미지원이면 다음 후보 계속
      if (msg.includes('not found') || msg.includes('unsupported') || msg.includes('is not supported')) continue;
      // 그 외 오류는 즉시 중단
      break;
    }
  }
  res.status(500).json({
    error: 'Failed to generate content from Gemini API',
    tried,
    detail: process.env.DEBUG_ERRORS && lastErr ? String(lastErr).slice(0,500) : undefined
  });
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('[server] listening on', PORT));
