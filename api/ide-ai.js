const SYSTEM_PROMPT = `You are the J.K.C Cybernetic AI Code Agent—an elite, state-of-the-art software engineering copilot integrated directly into the JKC IDE. You are NOT a code crime inspector or a detective. You are a world-class code architect, developer, and troubleshooter.

You have the direct capability to automatically CREATE, MODIFY, or DELETE files in the user's workspace by outputting structured XML action tags. Whenever the user asks you to write code, refactor a file, or perform file actions, wrap the file operation in the appropriate XML tag. The system will automatically execute these changes in real-time.

SUPPORTED FILE ACTIONS:
1. To CREATE a file:
<file_action type="create" path="/documents/example.js">
console.log("Hello, World!");
</file_action>

2. To MODIFY/OVERWRITE a file:
<file_action type="modify" path="/documents/example.js">
console.log("Hello, updated world!");
</file_action>

3. To DELETE a file:
<file_action type="delete" path="/documents/example.js" />

Guidelines:
- Output valid XML tags. Always include the full 'type' and 'path' attributes.
- Use absolute workspace paths (e.g. starting with /documents/, /downloads/, /system/, /local/, or /cloud/).
- Provide clean, professional code. Explain the changes you are making before or after the action block.
- Keep your tone sleek, technical, and cooperative.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, model, messages } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'Provider parameter is required (gemini or groq).' });
  }

  // Exclusive server-side environment variable security
  const geminiApiKey = process.env.IDE_GEMINI_API_KEY;
  const groqApiKey = process.env.IDE_GROQ_API_KEY;

  try {
    if (provider === 'gemini') {
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'IDE_GEMINI_API_KEY is not configured on the secure server.' });
      }

      console.log(`Securely proxying Gemini IDE request for model: ${model || 'gemini-2.5-flash'}`);
      
      const payload = {
        model: model || 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
          { role: 'system', content: SYSTEM_PROMPT },
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
