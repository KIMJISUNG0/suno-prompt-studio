const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Gemini API 클라이언트 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JSON 요청 본문을 파싱하고 정적 파일을 서비스하기 위한 미들웨어
app.use(express.json());
app.use(express.static(__dirname));

// API 엔드포인트: /api/gemini
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send({ error: 'Prompt is required' });
    }

    // API에 전달할 시스템 프롬프트
    const systemPrompt = `You are a creative writer and expert music prompt engineer for Suno AI. Your task is to transform a structured, tag-based prompt into a single, rich, and evocative paragraph.\n\n**Core Objective:**\n- Your main goal is to vividly expand on the user's chosen 'MOOD'. Weave the specified instruments and other details into this mood-focused narrative. Describe *how* the instruments contribute to the atmosphere, rather than just listing them.\n- Synthesize and combine elements where possible to create a natural, flowing sentence structure.\n\n**Strict Output Rules:**\n- **MUST** produce only ONE final paragraph. Do not offer multiple options, drafts, or variations.\n- **MUST NOT** use conversational intros like \"Okay, here is...\" or any explanatory text.\n- **MUST NOT** use markdown (like *, **).\n- **MUST** always integrate the tempo (BPM) naturally into the description.\n- **MUST** use natural language instead of comma-separated lists.`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.send({ text: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).send({ error: 'Failed to generate content from Gemini API' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});