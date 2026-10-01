import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CMS content prefixes mapped to content-render.html
const CONTENT_PREFIXES = [
  '/blog/*',
  '/notes/*',
  '/formula-sheet/*',
  '/pyq/*',
  '/mock/*',
  '/news/*',
  '/exam-update/*',
  '/college/*',
  '/career/*',
  '/guide/*'
];

// Serve content-render.html for dynamic CMS routes
app.get(CONTENT_PREFIXES, (req, res) => {
  res.sendFile(path.join(__dirname, 'content-render.html'));
});

// Serve static files with automatic .html extension resolution
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for non-matching GET requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Study Grid Prep server running on http://0.0.0.0:${PORT}`);
});
