export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!geminiApiKey && !groqApiKey) {
    return res.status(500).json({ error: 'Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the server.' });
  }

  const { messages, tools, tool_choice } = req.body;

  // 1. Try Gemini first if key is available
  if (geminiApiKey) {
    try {
      console.log('Attempting Jarvis request with Gemini (gemini-2.5-flash)...');
      
      const geminiPayload = {
        model: 'gemini-2.5-flash',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      };

      if (tools && tools.length > 0) {
        geminiPayload.tools = tools;
        geminiPayload.tool_choice = tool_choice || 'auto';
      }

      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiApiKey}`,
        },
        body: JSON.stringify(geminiPayload),
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        console.log('Gemini request succeeded!');
        return res.status(200).json(data);
      } else {
        const errText = await geminiRes.text();
        console.warn(`Gemini API failed with status ${geminiRes.status}: ${errText}. Falling back to Groq...`);
      }
    } catch (err) {
      console.error('Gemini request threw error, falling back to Groq:', err);
    }
  }

  // 2. Fallback to Groq
  if (groqApiKey) {
    try {
      console.log('Attempting Jarvis request with Groq fallback (llama-3.3-70b-versatile)...');
      
      const groqPayload = {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      };

      if (tools && tools.length > 0) {
        groqPayload.tools = tools;
        groqPayload.tool_choice = tool_choice || 'auto';
      }

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify(groqPayload),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return res.status(groqRes.status).json({ error: `Groq failed: ${errText}` });
      }

      const data = await groqRes.json();
      console.log('Groq request succeeded!');
      return res.status(200).json(data);
    } catch (err) {
      console.error('Groq proxy error:', err);
      return res.status(500).json({ error: 'Both Gemini and Groq requests failed. Internal server error.' });
    }
  }

  return res.status(500).json({ error: 'Gemini failed and Groq API key is not configured.' });
}
