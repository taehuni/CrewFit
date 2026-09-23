import express from 'express';
import cors from 'cors';
import meRouter from './routes/me.js';
import dashboardRouter from './routes/dashboard.js';
import { createExercisesRouter } from './routes/exercises.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/exercises', createExercisesRouter(requireAuth));
app.use('/api/feedback', createFeedbackRouter(requireAuth));
// 이후 라우트: crews (docs/architecture/api.md 3절)

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`crewfit server on http://localhost:${port}`));
