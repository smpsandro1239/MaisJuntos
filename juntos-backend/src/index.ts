import { Hono } from 'hono';
import type { AppEnv } from './security';
import { corsMiddleware, rateLimit, securityHeaders } from './security';
import { initDatabase } from './db/index';
import authRoutes from './routes/auth';
import poiRoutes from './routes/pois';
import reportRoutes from './routes/reports';
import miscRoutes from './routes/misc';
import type { Env } from './env';

export { RealtimeDO } from './realtime-do';
export { RateLimitDO } from './rate-limit-do';

const app = new Hono<AppEnv>();

app.use('*', securityHeaders);
app.use('*', corsMiddleware);
// Limite global por IP apenas em métodos mutantes — leituras não pagam o custo
// de uma ida ao Durable Object (o limite de 60/min em GETs não protege nada).
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') {
    await next();
    return;
  }
  return rateLimit('API_RATE_LIMITER')(c, next);
});

app.route('/api/auth', authRoutes);
app.route('/api/pois', poiRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api', miscRoutes);

// Upgrade WebSocket → encaminhado para o Durable Object (auth + Origin no DO)
app.get('/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return c.json({ error: 'É necessário o cabeçalho Upgrade: websocket.' }, 426);
  }
  const id = c.env.REALTIME.idFromName('global');
  const stub = c.env.REALTIME.get(id);
  return stub.fetch(c.req.raw);
});

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/') || path === '/ws') {
    return c.json({ error: 'Recurso não encontrado.' }, 404);
  }
  return c.text('Servidor de API +JUNTOS. O frontend é servido pela Vercel.', 404);
});

// Tratamento global de erros sem stack traces (paridade com server.ts)
app.onError((err: any, c) => {
  const status = err?.status || err?.statusCode || 500;
  if (status >= 500) {
    console.error('[Worker] Erro interno:', err?.message || 'erro desconhecido');
  }
  const clientMessage =
    status === 500 ? 'Ocorreu um erro interno no servidor.' : err?.message || 'Pedido inválido.';
  return c.json({ error: clientMessage }, status);
});

// Rotas que não dependem da Turso (não devem falhar por falta de configuração)
const PATHS_SEM_BD = ['/api/healthz', '/api/db/status'];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/') && !PATHS_SEM_BD.includes(path)) {
      try {
        await initDatabase(env);
      } catch (err: any) {
        console.error('[Worker] Falha ao inicializar a base de dados:', err?.message || 'erro desconhecido');
        return new Response(JSON.stringify({ error: 'Ocorreu um erro interno no servidor.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
