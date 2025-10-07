import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const GEM_API_KEY = process.env.GEMINI_API_KEY || '';
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest'
];

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasKey: !!GEM_API_KEY,
    primary: PRIMARY_MODEL,
    fallbacks: FALLBACK_MODELS,
    debug: !!process.env.DEBUG_ERRORS
  });
});

app.post('/api/gemini', async (req, res) => {
  if (!GEM_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  const prompt = (req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

  const genAI = new GoogleGenerativeAI(GEM_API_KEY);
  const systemInstruction = 'Refine structured music prompts. Plain text only.';
  let lastErr;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
      const t0 = Date.now();
      const result = await model.generateContent(prompt);
      const text = result.response?.text?.();
      if (!text) throw new Error('Empty response');
      return res.json({
        text: text.replace(/[*#]/g, '').trim(),
        model: modelName,
        ms: Date.now() - t0
      });
    } catch (e) {
      lastErr = e;
    }
  }
  res.status(500).json({
    error: 'Failed to generate content from Gemini API',
    detail: process.env.DEBUG_ERRORS ? String(lastErr) : undefined
  });
});

app.use(express.static(__dirname));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('[server] listening on', PORT));
