const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const getQuizQuestionCount = (text) => {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 120) return 4;
  if (wordCount < 250) return 6;
  if (wordCount < 500) return 8;
  if (wordCount < 900) return 10;
  return 12;
};

const normalizeQuizData = (quizData, questionCount) => {
  if (!Array.isArray(quizData)) {
    throw new Error("Quiz response was not an array.");
  }

  return quizData
    .filter((item) => (
      item &&
      typeof item.question === "string" &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      Number.isInteger(item.correctAnswerIndex) &&
      item.correctAnswerIndex >= 0 &&
      item.correctAnswerIndex <= 3
    ))
    .slice(0, questionCount);
};

const buildQuizPrompt = (text, questionCount) => `
You are an expert educator. Create an engaging multiple-choice quiz based on the following text.
The quiz length has already been chosen based on the size and density of the topic.
Return EXACTLY a JSON array of ${questionCount} objects, where each object represents one question.

Follow this exact JSON structure:
[
  {
    "question": "What is the main topic?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0
  }
]

Make sure "correctAnswerIndex" is an integer from 0 to 3 that corresponds to the correct option.
Cover the most important ideas across the whole text. For longer texts, include a mix of main concepts, supporting details, and practical implications.
Avoid repeating the same concept in multiple questions.
Do not include any markdown formatting, only valid JSON.

TEXT TO BASE QUIZ ON:
${text}
`;

const parseQuizResponse = (responseText, questionCount) => {
  // Clean markdown backticks if any
  let cleanText = responseText.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  }
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  const parsed = JSON.parse(cleanText);
  const rawQuiz = Array.isArray(parsed) ? parsed : parsed.quiz;

  if (!rawQuiz) {
    throw new Error("No quiz array found in response");
  }

  const quizData = normalizeQuizData(rawQuiz, questionCount);

  if (quizData.length === 0) {
    throw new Error("No valid quiz questions returned.");
  }

  return quizData;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: "Text too short to generate a quiz." });
    }

    const questionCount = getQuizQuestionCount(text);
    let quizData = null;
    let lastError = null;

    // 1. Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        console.log("NoteAI Quiz: Attempting with Gemini (gemini-2.5-flash)...");
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GEMINI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{ role: 'user', content: buildQuizPrompt(text, questionCount) }],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0].message.content;
          quizData = parseQuizResponse(content, questionCount);
          console.log("NoteAI Quiz: Gemini succeeded!");
        } else {
          const errText = await response.text();
          console.warn(`NoteAI Quiz: Gemini failed: ${errText}. Trying Groq fallback...`);
          lastError = errText;
        }
      } catch (err) {
        console.error("NoteAI Quiz: Gemini error:", err);
        lastError = err.message;
      }
    }

    // 2. Try Groq second (Fallback)
    if (!quizData && GROQ_API_KEY) {
      try {
        console.log("NoteAI Quiz: Attempting fallback with Groq (llama-3.3-70b-versatile)...");
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: `${buildQuizPrompt(text, questionCount)}\n\nFor JSON mode, return a JSON object with one key named "quiz". The value of "quiz" must be the quiz array described above.` }],
            temperature: 0.2,
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices[0].message.content;
          quizData = parseQuizResponse(content, questionCount);
          console.log("NoteAI Quiz: Groq fallback succeeded!");
        } else {
          const errText = await response.text();
          console.error(`NoteAI Quiz: Groq failed: ${errText}`);
          lastError = errText;
        }
      } catch (err) {
        console.error("NoteAI Quiz: Groq fallback error:", err);
        lastError = err.message;
      }
    }

    if (quizData) {
      return res.status(200).json({
        quiz: quizData,
        questionCount: quizData.length
      });
    }

    return res.status(500).json({
      error: "Failed to generate quiz from all available engines.",
      details: lastError
    });

  } catch (error) {
    console.error("Quiz API Error:", error);
    return res.status(500).json({ error: "Failed to generate quiz: " + error.message });
  }
}
