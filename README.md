# Interview Prep — AI Question Generator

A simple web page that generates 3 tailored interview questions for any job role, powered by Google Gemini AI. Tap any question card to reveal a sample answer.

**Live site:** https://interview-prep2026.netlify.app

---

## What it does

1. Enter a job title (e.g. Customer Success Manager)
2. Click **Generate questions**
3. Three role-specific interview questions appear as interactive flashcards
4. Tap a card to flip it and reveal a sample answer
5. Move your cursor away from the card to flip it back

---

## Tech decisions

### Why Gemini 2.5 Flash?
The brief recommended `ai.google.dev` as a free option with no credit card required. Gemini 2.5 Flash is the current free tier model and is optimised for speed — ideal for a focused task like generating three short questions. A faster model means a shorter loading state and a better user experience.

### Why vanilla HTML, CSS, and JavaScript?
No framework, no build step, no dependencies to install or update. The entire app is three files that open directly in a browser. This keeps the code easy to read, easy to run, and straightforward to deploy to a static host like GitHub Pages.

### Why separate files instead of one HTML file?
Splitting structure (HTML), style (CSS), and behaviour (JS) into separate files follows the principle of separation of concerns. It makes each file easier to read and maintain independently.

### Why Netlify?
Free static hosting with built-in serverless functions. Unlike GitHub Pages, Netlify allows server-side code — this is what makes it possible to store the API key securely in environment variables instead of the source code. HTTPS is included automatically.

### Why a flashcard UI?
A plain list of questions works, but a flashcard adds a layer of interactivity that makes the tool genuinely useful for interview practice — not just reading, but actively testing recall. The flip animation is handled entirely in CSS using 3D transforms, with JavaScript only toggling a single class.

---

## Known trade-offs

**API key is stored securely in environment variables.**
The Gemini API key is never written in the source code or committed to the repository. It lives in Netlify's environment variables and is accessed only by the serverless function at runtime. Even with full access to the repository, there is no key to steal.

---

## How to run locally

The app uses a Netlify serverless function to keep the API key secure,
so it cannot run by simply opening `index.html` in a browser — it needs
a server that can execute the function.

The easiest way to run it locally is with the Netlify CLI:

1. Clone the repository
   ```
   git clone https://github.com/DexyMaroni/interview-prep.git
   cd interview-prep
   ```

2. Install the Netlify CLI
   ```
   npm install -g netlify-cli
   ```

3. Create a `.env` file in the project root and add your API key
   ```
   GEMINI_API_KEY=your-key-here
   ```
   Get a free key at: https://ai.google.dev

4. Start the local dev server
   ```
   netlify dev
   ```

5. Open `http://localhost:8888` in your browser

The Netlify CLI reads the `.env` file, runs the serverless function locally,
and serves the static files — matching the live environment exactly.

> **Note:** The `.env` file is listed in `.gitignore` and is never committed
> to the repository. The API key stays on your machine only.

---

## Project structure

```
interview-prep/
├── index.html                  — page structure and element layout
├── style.css                   — all visual styles, including the 3D card flip
├── script.js                   — card rendering, flip behaviour, calls the function
├── netlify.toml                — Netlify config: publish directory and functions folder
├── .gitignore                  — excludes .env so the API key is never committed
├── README.md                   — this file
└── netlify/
    └── functions/
        └── ask.js              — serverless function: reads API key, calls Gemini
```

---

## Built with

- [Google Gemini 2.5 Flash](https://ai.google.dev) — AI model
- [DM Serif Display + DM Sans](https://fonts.google.com) — Typography
- [Netlify](https://netlify.com) — Hosting and serverless functions