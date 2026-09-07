import express from 'express';
import cors from 'cors';
import meRouter from './routes/me.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/me', meRouter);
// 이후 라우트: feedback, crews, dashboard, exercises (docs/architecture/api.md 3절)

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`crewfit server on http://localhost:${port}`));
