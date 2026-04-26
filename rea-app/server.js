import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import projectsRouter from './routes/projects.js';
import searchRouter from './routes/search.js';
import screeningRouter from './routes/screening.js';
import extractionRouter from './routes/extraction.js';
import appraisalRouter from './routes/appraisal.js';
import synthesisRouter from './routes/synthesis.js';
import exportRouter from './routes/export.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api/search', searchRouter);
app.use('/api/screening', screeningRouter);
app.use('/api/extraction', extractionRouter);
app.use('/api/appraisal', appraisalRouter);
app.use('/api/synthesis', synthesisRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🐕 REA Automation App running at http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Connected' : '❌ No key found'}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
