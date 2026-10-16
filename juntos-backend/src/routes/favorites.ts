import { Hono } from 'hono';
import type { AppEnv } from '../security';
import { requireAuth } from '../security';
import { getDb } from '../db/index';

const routes = new Hono<AppEnv>();

// ─── Favoritos (por utilizador autenticado) ─────────────────────────────────

// GET /api/favorites
routes.get('/favorites', requireAuth, async (c) => {
  const user = c.get('user');
  const rs = await getDb(c.env).execute({
    sql: 'SELECT poiId, createdAt FROM user_favorites WHERE userId = ? ORDER BY createdAt DESC',
    args: [user.id],
  });
  return c.json(rs.rows.map((r) => ({ poiId: String(r.poiId), createdAt: String(r.createdAt) })));
});

// POST /api/favorites/:poiId
routes.post('/favorites/:poiId', requireAuth, async (c) => {
  const user = c.get('user');
  const poiId = c.req.param('poiId');
  if (!poiId) return c.json({ error: 'Identificador do POI em falta.' }, 400);

  const db = getDb(c.env);
  const poi = await db.execute({ sql: 'SELECT id FROM pois WHERE id = ?', args: [poiId] });
  if (!poi.rows.length) return c.json({ error: 'POI inexistente.' }, 404);

  await db.execute({
    sql: 'INSERT OR IGNORE INTO user_favorites (userId, poiId, createdAt) VALUES (?, ?, ?)',
    args: [user.id, poiId, new Date().toISOString()],
  });
  return c.json({ ok: true, poiId });
});

// DELETE /api/favorites/:poiId
routes.delete('/favorites/:poiId', requireAuth, async (c) => {
  const user = c.get('user');
  const poiId = c.req.param('poiId');
  await getDb(c.env).execute({
    sql: 'DELETE FROM user_favorites WHERE userId = ? AND poiId = ?',
    args: [user.id, poiId],
  });
  return c.json({ ok: true, poiId });
});

// ─── Roteiros familiares gerados (por utilizador autenticado) ───────────────

// GET /api/plans
routes.get('/plans', requireAuth, async (c) => {
  const user = c.get('user');
  const rs = await getDb(c.env).execute({
    sql: 'SELECT id, title, plan_json, created_at, updated_at FROM family_plans WHERE user_id = ? ORDER BY updated_at DESC',
    args: [user.id],
  });
  return c.json(
    rs.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      plan: JSON.parse(String(r.plan_json)),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }))
  );
});

// POST /api/plans — cria ou atualiza (id opcional no corpo)
routes.post('/plans', requireAuth, async (c) => {
  const user = c.get('user');
  const body = (await c.req.json().catch(() => null)) as { id?: string; title?: string; plan?: unknown } | null;
  if (!body || typeof body.plan !== 'object' || body.plan === null) {
    return c.json({ error: 'Plano inválido (campo "plan" obrigatório).' }, 400);
  }

  const now = new Date().toISOString();
  const id = body.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = (body.title || 'Roteiro Familiar').slice(0, 120);

  await getDb(c.env).execute({
    sql: `INSERT INTO family_plans (id, user_id, title, plan_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, plan_json = excluded.plan_json, updated_at = excluded.updated_at`,
    args: [id, user.id, title, JSON.stringify(body.plan), now, now],
  });

  return c.json({ id, title, updatedAt: now }, 201);
});

// DELETE /api/plans/:id
routes.delete('/plans/:id', requireAuth, async (c) => {
  const user = c.get('user');
  await getDb(c.env).execute({
    sql: 'DELETE FROM family_plans WHERE id = ? AND user_id = ?',
    args: [c.req.param('id'), user.id],
  });
  return c.json({ ok: true });
});

export default routes;
