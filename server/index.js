import express from 'express';
import cors from 'cors';
import meRouter from './routes/me.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
app.use('/api/dashboard', dashboardRouter);
// 이후 라우트: feedback, crews, exercises (docs/architecture/api.md 3절)

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`crewfit server on http://localhost:${port}`));
