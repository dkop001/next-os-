export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, model, messages } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'Provider parameter is required (gemini or groq).' });
  }

  // Support secure client-side override headers OR server-side env fallbacks securely
  const geminiApiKey = req.headers['x-gemini-key'] || process.env.IDE_GEMINI_API_KEY;
  const groqApiKey = req.headers['x-groq-key'] || process.env.IDE_GROQ_API_KEY;

  try {
    if (provider === 'gemini') {
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'IDE_GEMINI_API_KEY is not configured on the secure server.' });
      }

      console.log(`Securely proxying Gemini IDE request for model: ${model || 'gemini-2.5-flash'}`);
      
      const payload = {
        model: model || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an elite coding expert assistant on JKC IDE.' },
          ...messages
        ],
        temperature: 0.7,
      };

      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return res.status(geminiRes.status).json({ error: `Gemini Secure Request Failed: ${errText}` });
      }

      const data = await geminiRes.json();
      return res.status(200).json(data);

    } else if (provider === 'groq') {
      if (!groqApiKey) {
        return res.status(500).json({ error: 'IDE_GROQ_API_KEY is not configured on the secure server.' });
      }

      console.log(`Securely proxying Groq IDE request (qwen-2.5-coder-32b)`);

      const payload = {
        model: 'qwen-2.5-coder-32b',
        messages: [
          { role: 'system', content: 'You are an elite coding expert assistant on JKC IDE.' },
          ...messages
        ],
        temperature: 0.7,
      };

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return res.status(groqRes.status).json({ error: `Groq Secure Request Failed: ${errText}` });
      }

      const data = await groqRes.json();
      return res.status(200).json(data);
    } else {
      return res.status(400).json({ error: `Invalid provider: ${provider}` });
    }
  } catch (err) {
    console.error('Secure proxy compilation error:', err);
    return res.status(500).json({ error: `Secure server handler failed: ${err.message}` });
  }
}
