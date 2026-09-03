import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// 보호 라우트 패턴 예시. 클라가 supabase-js로 로그인해 받은 토큰 필요.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});
// 이후 기능 라우트 여기에 추가: workouts, crews, feed ...

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`crewfit server on http://localhost:${port}`));
