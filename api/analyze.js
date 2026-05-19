import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const MODELS = [
  "llama-3.3-70b-versatile",
  "deepseek-r1-distill-llama-70b",
  "gemma2-9b-it"
];

// Helper for fetch with timeout
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 9500 } = options; 
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function checkRateLimit(ip) {
  if (!DATABASE_URL) {
    return { allowed: true };
  }

  try {
    const sql = neon(DATABASE_URL);
    
    // 1. Record the request
    await sql`INSERT INTO request_logs (ip_address) VALUES (${ip})`;
    
    // 2. Count requests in the last 10 minutes
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM request_logs 
      WHERE ip_address = ${ip} 
      AND created_at > NOW() - INTERVAL '10 minutes'
    `;
    
    const count = parseInt(result[0].count);
    const limit = 10; // 10 requests per 10 minutes
    
    if (count > limit) {
      return { allowed: false, count, limit };
    }
    
    return { allowed: true, count, limit };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }
}

export default async function handler(req, res) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get client IP for rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  // Rate Limit check
  const rateLimitStatus = await checkRateLimit(ip);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({ 
      error: 'Too many investigations from this precinct. Take a coffee break, Detective.',
      details: `Limit: ${rateLimitStatus.limit} requests per 10 minutes.`
    });
  }

  const { code, errorMessage, structuralFindings, language } = req.body;

  if (!GEMINI_API_KEY && !GROQ_API_KEY) {
    return res.status(500).json({ error: 'API key is missing in forensic lab.' });
  }

  const systemPrompt = `
    You are a Senior Forensic Code Investigator. 
    A technical parser has identified "Structural Findings".
    
    YOUR MISSION:
    1. Analyze the code, the error, and the structural findings.
    2. Synthesize a highly detailed, cinematic "Crime Report" in JSON format.
    3. Use hard-boiled detective noir terminology.
    4. GENERATE A LOGICAL EXECUTION TIMELINE leading to the crash.
    
    JSON SCHEMA:
    {
      "caseId": "CC-XXXX",
      "verdict": {
        "title": "string",
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "category": "SYNTAX | LOGIC | PERFORMANCE | SECURITY"
      },
      "executionTimeline": [
        { "step": number, "description": "string", "status": "neutral | warning | danger" }
      ],
      "crimeScene": {
        "suspectLine": number,
        "suspectLineContent": "string",
        "theVictim": "string",
        "theWeapon": "string"
      },
      "investigationNotes": {
        "synopsis": "string",
        "forensicEvidence": "string",
        "recommendation": "string"
      },
      "metadata": {
        "confidenceScore": number
      }
    }
  `;

  const userPrompt = `
    EVIDENCE MATERIAL:
    LANGUAGE: ${language || 'javascript'}

    CODE:
    ${code}

    RUNTIME ERROR:
    ${errorMessage || "No runtime error reported."}

    STRUCTURAL FINDINGS FROM PARSER:
    ${JSON.stringify(structuralFindings, null, 2)}
  `;

  // 1. Try Gemini first
  if (GEMINI_API_KEY) {
    try {
      console.log('Attempting forensic analysis with Gemini (gemini-2.5-flash)...');
      
      const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 9000,
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        return res.status(200).json(result);
      } else {
        const errText = await response.text();
        console.warn(`Gemini analysis failed: ${errText}. Falling back to Groq...`);
      }
    } catch (error) {
      console.error('Gemini analysis error, falling back to Groq:', error);
    }
  }

  // 2. Fallback to Groq
  if (GROQ_API_KEY) {
    let lastError = null;

    for (const model of MODELS) {
      try {
        console.log(`Attempting forensic analysis with Groq model: ${model}...`);
        
        const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 8500, 
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });

        if (response.status === 429) {
          console.warn(`Model ${model} hit rate limit. Trying fallback...`);
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json();
          lastError = errorData.error?.message || 'Unknown forensic error';
          continue;
        }

        const data = await response.json();
        const result = JSON.parse(data.choices[0].message.content);
        return res.status(200).json(result);

      } catch (error) {
        lastError = error.message;
        continue;
      }
    }

    return res.status(503).json({ 
      error: 'All forensic models are currently occupied or timed out. Please try again later.',
      details: lastError
    });
  }

  return res.status(500).json({ error: 'Forensic Lab failed: Gemini key failed and Groq is not configured.' });
}
