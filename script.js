/* ==============================================
   INTERVIEW PREP — script.js
   All behaviour for the page.
   Organised in execution order:
   1. Configuration
   2. DOM references
   3. Input validation
   4. UI state helpers
   5. Flashcard rendering
   6. Flashcard flip behaviour
   7. API call
   8. Entry point
============================================== */


/* ----------------------------------------------
   1. CONFIGURATION
   Gemini API key used with duration
   of 30 days for security concerns.
   In a production application, API 
   calls would be routed through a 
   serverless function to keep the 
   API key server-side and secured.
---------------------------------------------- */
const CONFIG = {
  
  API_KEY: "AIzaSyAoqo6pF5P2WiqUqJrwSLuxwuBUY44sKsI",

  // Gemini 2.0 Flash — fast, free tier, well-suited for short responses
  API_URL: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",

  // Hard cap on total tokens returned — prevents runaway long responses
  MAX_TOKENS: 400,

  // System prompt: defines the output format and enforces word limits
  SYSTEM_PROMPT: `You generate exactly 3 interview question-and-answer pairs for a given job role.

Rules:
- Each question: under 20 words, open-ended, specific to the role
- Each answer: under 40 words, 2 to 3 key talking points only
- No preamble, no sign-off, no extra commentary
- Return only a valid JSON array in this exact shape:
[
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." }
]`,
};


/* ----------------------------------------------
   2. DOM REFERENCES
   Grab every element we need once at the top.
   Avoids repeated querySelector calls throughout.
---------------------------------------------- */
const roleInput     = document.getElementById("role-input");
const submitBtn     = document.getElementById("submit-btn");
const hintText      = document.getElementById("hint-text");
const loadingSection  = document.getElementById("loading-section");
const errorSection  = document.getElementById("error-section");
const errorMessage  = document.getElementById("error-message");
const resultsSection = document.getElementById("results-section");


/* ----------------------------------------------
   3. INPUT VALIDATION
   Enable the button only when the input has text.
   Runs on every keystroke so the button state
   always reflects the current input value.
---------------------------------------------- */
roleInput.addEventListener("input", () => {
  const hasText = roleInput.value.trim().length > 0;
  submitBtn.disabled = !hasText;
});

// Also allow submitting by pressing Enter in the input field
roleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !submitBtn.disabled) {
    generateQuestions();
  }
});


/* ----------------------------------------------
   4. UI STATE HELPERS
   Small functions that switch the page between
   its four visual states: idle, loading,
   error, and results.
---------------------------------------------- */

// Show the loading skeletons, hide everything else
function showLoading() {
  loadingSection.hidden  = false;
  errorSection.hidden    = true;
  resultsSection.innerHTML = "";
  submitBtn.disabled     = true;

  // Replace button label with a spinner while waiting
  submitBtn.innerHTML = `
    <span class="spinner"></span>
    Generating…
  `;
}

// Hide loading skeletons and restore the button
function hideLoading() {
  loadingSection.hidden = true;
  submitBtn.disabled    = false;
  submitBtn.innerHTML   = "Generate questions";
}

// Display a human-readable error message
function showError(message) {
  errorSection.hidden   = false;
  errorMessage.textContent = message;
}

// Clear previous results, errors, and hint before a new request
function resetState() {
  errorSection.hidden      = true;
  resultsSection.innerHTML = "";
  hintText.textContent     = "";
  hintText.classList.remove("is-error");
}


/* ----------------------------------------------
   5. FLASHCARD RENDERING
   Builds the three flashcard elements from the
   parsed API data and injects them into the page.
---------------------------------------------- */

// Sanitise user-facing text to prevent XSS
// (the API response is untrusted external data)
function escapeHTML(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Build and inject one flashcard per question-answer pair
function renderCards(pairs, role) {
  pairs.forEach((pair, index) => {
    const number   = String(index + 1).padStart(2, "0"); // "01", "02", "03"
    const question = escapeHTML(pair.question);
    const answer   = escapeHTML(pair.answer);

    // Build the card element using the structure documented in index.html
    const card = document.createElement("article");
    card.className  = "flashcard";
    card.tabIndex   = 0; // makes the card focusable with keyboard Tab
    card.setAttribute("aria-label", `Question ${index + 1} — tap to flip`);

    card.innerHTML = `
      <div class="card-inner">

        <div class="card-front">
          <span class="card-number">${number}</span>
          <p class="card-question">${question}</p>
          <span class="card-hint">Tap to reveal answer</span>
        </div>

        <div class="card-back">
          <p class="card-answer">${answer}</p>
          <span class="card-hint">Move away to flip back</span>
        </div>

      </div>
    `;

    // Attach flip behaviour to this card
    attachFlipBehaviour(card);

    resultsSection.appendChild(card);
  });

  // Show a subtle hint below the input once cards are visible
  hintText.textContent = `Showing questions for: ${escapeHTML(role)}`;
}


/* ----------------------------------------------
   6. FLASHCARD FLIP BEHAVIOUR
   Handles click (flip) and mouseleave (reset).
   Also supports keyboard Enter and Space for
   accessibility.
   CSS does the actual animation — JS only
   toggles the .is-flipped class.
---------------------------------------------- */
function attachFlipBehaviour(card) {

  // Click or tap: toggle the flipped state
  card.addEventListener("click", () => {
    card.classList.toggle("is-flipped");
  });

  // Mouse leaves the card: always reset to front
  card.addEventListener("mouseleave", () => {
    card.classList.remove("is-flipped");
  });

  // Keyboard support: Enter or Space flips the card
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault(); // stop Space from scrolling the page
      card.classList.toggle("is-flipped");
    }
  });
}


/* ----------------------------------------------
   7. API CALL
   Sends the job role to Gemini and returns
   the parsed array of question-answer pairs.
   Throws an error if anything goes wrong so
   the caller can display a message to the user.
---------------------------------------------- */
async function fetchQuestions(role) {

  const response = await fetch(`${CONFIG.API_URL}?key=${CONFIG.API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // System instruction sets the rules for the model
      systemInstruction: {
        parts: [{ text: CONFIG.SYSTEM_PROMPT }],
      },
      // User message contains only the job role — no personal info
      contents: [
        {
          parts: [{ text: `Generate 3 interview question-answer pairs for: ${role}` }],
        },
      ],
      // Cap total output to prevent long responses
      generationConfig: {
        maxOutputTokens: CONFIG.MAX_TOKENS,
      },
    }),
  });

  // Handle non-200 responses (bad key, rate limit, etc.)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message   = errorData?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();

  // Extract the text from Gemini's response structure
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!rawText) {
    throw new Error("The AI returned an empty response. Please try again.");
  }

  // Parse the JSON array from the response text
  // Strip markdown code fences if the model wraps the JSON in them
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const pairs   = JSON.parse(cleaned);

  // Validate the structure before returning
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error("Unexpected response format. Please try again.");
  }

  return pairs;
}


/* ----------------------------------------------
   8. ENTRY POINT
   Called when the user clicks the button or
   presses Enter. Orchestrates all the steps:
   validate → reset → load → fetch → render.
---------------------------------------------- */
async function generateQuestions() {
  const role = roleInput.value.trim();

  // Guard: should not reach here with empty input
  // (button is disabled) but defensive check anyway
  if (!role) {
    hintText.textContent = "Please enter a job title first.";
    hintText.classList.add("is-error");
    roleInput.focus();
    return;
  }

  resetState();
  showLoading();

  try {
    const pairs = await fetchQuestions(role);
    renderCards(pairs, role);
  } catch (error) {
    // Show a friendly message — raw errors can expose API details
    showError(`Something went wrong: ${error.message}`);
  } finally {
    // Always hide loading, whether the request succeeded or failed
    hideLoading();
  }
}

// Wire the button to the entry point
submitBtn.addEventListener("click", generateQuestions);


/* ----------------------------------------------
   ON PAGE LOAD
   The input is pre-filled with "Customer Success
   Manager" from the HTML. Enable the button
   immediately so the user can generate straight away.
---------------------------------------------- */
submitBtn.disabled = roleInput.value.trim().length === 0;