/* ==============================================
   netlify/functions/ask.js
   Serverless function — runs on Netlify's servers.

   Why this exists:
   The Gemini API key must never be exposed in
   the browser. This function acts as a secure
   middleman — the browser sends it a job role,
   it calls Gemini using the key stored in
   Netlify's environment variables, and returns
   the questions. The key never reaches the client.

   Flow:
   Browser → POST /.netlify/functions/ask
           → this function reads process.env.GEMINI_API_KEY
           → calls Gemini API
           → returns JSON to the browser
============================================== */

// Gemini API endpoint — uses the stable 2.5 Flash model
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// System prompt — defines output format and enforces word limits
const SYSTEM_PROMPT = `You generate exactly 3 interview question-and-answer pairs for a given job role.

Rules:
- Each question: under 20 words, open-ended, specific to the role
- Each answer: under 40 words, 2 to 3 key talking points only
- No preamble, no sign-off, no extra commentary
- Return only a valid JSON array in this exact shape:
[
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." }
]`;

exports.handler = async function (event) {

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Read the job role from the request body sent by the browser
  let role;
  try {
    const body = JSON.parse(event.body);
    role = body.role?.trim();
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }

  // Validate that a role was provided
  if (!role) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Job role is required" }),
    };
  }

  // Read the API key from Netlify's environment variables
  // This is set in Netlify → Site settings → Environment variables
  // It is never stored in the code or the repository
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key is not configured on the server" }),
    };
  }

  // Call the Gemini API
  const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [{ text: `Generate 3 interview question-answer pairs for: ${role}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
      },
    }),
  });

  // Handle errors from the Gemini API
  if (!geminiResponse.ok) {
    const errorData = await geminiResponse.json().catch(() => ({}));
    const message   = errorData?.error?.message || `Gemini API error (${geminiResponse.status})`;
    return {
      statusCode: geminiResponse.status,
      body: JSON.stringify({ error: message }),
    };
  }

  const data    = await geminiResponse.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Extract the JSON array from the response
  const jsonStart = rawText.indexOf("[");
  const jsonEnd   = rawText.lastIndexOf("]");

  if (jsonStart === -1 || jsonEnd === -1) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not parse response from AI. Please try again." }),
    };
  }

  const pairs = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));

  // Return the parsed pairs to the browser
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs }),
  };
};