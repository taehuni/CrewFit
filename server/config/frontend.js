import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Register after API routes so SPA navigation never masks API or asset errors.
export function serveFrontend(app, directory) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index)) throw new Error('Frontend build missing; build client before starting production.');
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API를 찾을 수 없습니다.' } }));
  app.use(express.static(directory, { index: false, dotfiles: 'deny' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/assets/') || path.extname(req.path) || req.path.split('/').some(part => part.startsWith('.')) || !req.accepts('html')) return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
