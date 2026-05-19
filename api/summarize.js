const GEMINI_API_KEY = process.env.NOTEAI_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.NOTEAI_GROQ_API_KEY || process.env.GROQ_API_KEY;

const buildSummaryPrompt = (text) => `
You are an expert note summarizer.

Summarize the following notes into a clean, concise, and easy-to-read format.

Follow this exact structure:

# Short Catchy Title

## Key Points
- Important point
- Important point
- Important point

## Quick Summary
Write a short paragraph (3-5 lines max).

Rules:
- Keep it concise
- Remove slang/emojis/repetition
- Preserve meaning
- Max 200 words

NOTES:
${text}
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: "Text too short" });
  }

  // Set up SSE headers to maintain compatibility with the streaming frontend
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let summaryText = "";

  // 1. Try Gemini First
  if (GEMINI_API_KEY) {
    try {
      console.log("NoteAI Summary: Attempting with Gemini (gemini-2.5-flash)...");
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: buildSummaryPrompt(text) }],
          temperature: 0.2,
          max_tokens: 600
        })
      });

      if (response.ok) {
        const data = await response.json();
        summaryText = data.choices[0].message.content.trim();
        console.log("NoteAI Summary: Gemini succeeded!");
      } else {
        const errText = await response.text();
        console.warn(`NoteAI Summary: Gemini failed with: ${errText}. Trying Groq fallback...`);
      }
    } catch (err) {
      console.error("NoteAI Summary: Gemini error:", err);
    }
  }

  // 2. Try Groq Second (Fallback)
  if (!summaryText && GROQ_API_KEY) {
    try {
      console.log("NoteAI Summary: Attempting fallback with Groq (llama-3.3-70b-versatile)...");
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: buildSummaryPrompt(text) }],
          temperature: 0.2,
          max_tokens: 600
        })
      });

      if (response.ok) {
        const data = await response.json();
        summaryText = data.choices[0].message.content.trim();
        console.log("NoteAI Summary: Groq fallback succeeded!");
      } else {
        const errText = await response.text();
        console.error(`NoteAI Summary: Groq failed with: ${errText}`);
      }
    } catch (err) {
      console.error("NoteAI Summary: Groq error:", err);
    }
  }

  if (summaryText) {
    // Write SSE format back to the client
    res.write(`data: ${JSON.stringify({ content: summaryText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    res.write(`data: ${JSON.stringify({ error: "Failed to generate summary. All AI models are currently occupied." })}\n\n`);
    res.end();
  }
}
