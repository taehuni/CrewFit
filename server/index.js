import {createCalendarRouter} from './routes/calendar.js';
import {createPartnersRouter} from './routes/partners.js';
import { createCoachRouter } from './routes/coach.js';
import express from 'express';
import cors from 'cors';
import meRouter from './routes/me.js';
import dashboardRouter from './routes/dashboard.js';
import { createExercisesRouter } from './routes/exercises.js';
import { createFeedbackRouter } from './routes/feedback.js';
import { createCrewsRouter } from './routes/crews.js';
import { requireAuth } from './middleware/auth.js';
import { fileURLToPath } from 'node:url';
import { serveFrontend } from './config/frontend.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
app.use('/api/calendar',createCalendarRouter(requireAuth));
app.use('/api/partners',createPartnersRouter(requireAuth));
app.use('/api/coach', createCoachRouter(requireAuth));
app.use('/api/dashboard', dashboardRouter);
app.use('/api/exercises', createExercisesRouter(requireAuth));
app.use('/api/feedback', createFeedbackRouter(requireAuth));
app.use('/api/crews', createCrewsRouter(requireAuth));

if (process.env.NODE_ENV === 'production') {
  serveFrontend(app, fileURLToPath(new URL('../client/dist/', import.meta.url)));
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`crewfit server on http://localhost:${port}`));


