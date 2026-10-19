// Durable Object WebSocket (FASE 4)
// Regras obrigatórias (PLANO.md):
// - Hibernation via state.acceptWebSocket()
// - PROIBIDO guardar sockets em fields de instância → SEMPRE state.getWebSockets()
// - Handshake: cookie juntos_session válido → 401 se ausente/inválido
// - Origin: ausente em produção → 401; fora de ALLOWED_ORIGINS → 403
// - Broadcast via RPC (método público), nunca endpoint HTTP
import type { Env } from './env';
import { isAllowedOrigin, isProd, COOKIE_NAME } from './security';
import { verifyWsTicket } from './wsTicket';
import { getSessionWithUser } from './db/auth';
import {
  getAllPoisFromDb,
  getAllReportsFromDb,
  getAppState,
  getDb,
  initDatabase,
  insertOrUpdatePoiInDb,
  setAppState,
} from './db/index';
import { INITIAL_FAMILY_PLAN, INITIAL_METRICS } from './data/mockData';
import type { FamilyPlan, OperationalMetrics, User } from './types';

const MAX_MESSAGE_BYTES = 65536;

interface WsAttachment {
  userId: string;
  role: string;
  name: string;
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(';').forEach((pair) => {
    const parts = pair.split('=');
    const key = parts[0]?.trim();
    if (key) result[key] = decodeURIComponent(parts.slice(1).join('=').trim());
  });
  return result;
}

export class RealtimeDO {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Invocado pelo Worker principal via RPC após mutações críticas
  async broadcast(payload: unknown): Promise<void> {
    const msg = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  private sendAll(payload: unknown): void {
    const msg = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  async fetch(request: Request): Promise<Response> {
    // A. Validação de Origin
    const origin = request.headers.get('Origin');
    if (!origin) {
      if (isProd(this.env)) {
        return new Response(JSON.stringify({ error: 'Origin obrigatório em produção.' }), { status: 401 });
      }
      // Desenvolvimento (curl/devtools) permite ausência de Origin
    } else if (!isAllowedOrigin(this.env, origin)) {
      return new Response(JSON.stringify({ error: 'Origem não permitida pelas políticas de segurança.' }), {
        status: 403,
      });
    }

    // B. Autenticação ANTES de aceitar o WebSocket.
    //  1) Bilhete efémero `?ticket=` — necessário em produção, onde o cookie de
    //     sessão vive no domínio Vercel e o browser não o envia ao Worker.
    //  2) Cookie de sessão — fallback (dev local / mesmo domínio).
    let sessionId: string | undefined;
    let ticketUserId: string | undefined;
    const ticket = new URL(request.url).searchParams.get('ticket');
    if (ticket && this.env.SESSION_SECRET) {
      const ticketData = await verifyWsTicket(this.env.SESSION_SECRET, ticket);
      if (ticketData) {
        sessionId = ticketData.sessionId;
        ticketUserId = ticketData.userId;
      }
    }
    if (!sessionId) {
      const cookies = parseCookieHeader(request.headers.get('Cookie'));
      sessionId = cookies[COOKIE_NAME];
    }
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Sessão não iniciada: autenticação obrigatória.' }), {
        status: 401,
      });
    }

    await initDatabase(this.env);
    const db = getDb(this.env);
    const sessionData = await getSessionWithUser(db, sessionId);
    if (!sessionData) {
      return new Response(JSON.stringify({ error: 'Sessão não iniciada: autenticação obrigatória.' }), {
        status: 401,
      });
    }

    // Defesa em profundidade: o bilhete é emitido para um utilizador concreto;
    // se a sessão da BD já não pertencer a esse utilizador, recusa-se.
    if (ticketUserId && sessionData.user.id !== ticketUserId) {
      return new Response(JSON.stringify({ error: 'Bilhete de sessão inválido.' }), { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // Anexos sobrevivem à hibernação (fonte de verdade para RBAC em mensagens)
    const attachment: WsAttachment = {
      userId: sessionData.user.id,
      role: sessionData.user.role,
      name: sessionData.user.name,
    };
    server.serializeAttachment(attachment);

    this.state.acceptWebSocket(server);

    // Estado inicial lido da Turso (sem cache em field — perde-se na hibernação)
    const [pois, reports, metrics, familyPlan] = await Promise.all([
      getAllPoisFromDb(db),
      getAllReportsFromDb(db),
      getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS }),
      getAppState<FamilyPlan>(db, 'family_plan', { ...INITIAL_FAMILY_PLAN }),
    ]);

    server.send(
      JSON.stringify({
        type: 'init',
        data: {
          pois,
          reports,
          metrics,
          familyPlan,
          connectedUsers: this.state.getWebSockets().length,
          authenticatedUser: { id: sessionData.user.id, role: sessionData.user.role },
        },
      })
    );

    this.sendAll({ type: 'presence', data: { connectedUsers: this.state.getWebSockets().length } });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const byteLength = typeof message === 'string' ? new TextEncoder().encode(message).length : message.byteLength;
    if (byteLength > MAX_MESSAGE_BYTES) {
      ws.close(1009, 'Mensagem demasiado grande');
      return;
    }

    try {
      const parsed = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
      const attachment = ws.deserializeAttachment() as WsAttachment | null;

      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (parsed.type === 'poi:verify') {
        if (attachment && (attachment.role === 'admin' || attachment.role === 'curator')) {
          const db = getDb(this.env);
          const pois = await getAllPoisFromDb(db);
          const targetId = parsed.data?.id;
          const index = pois.findIndex((p) => p.id === targetId);
          if (index !== -1) {
            pois[index] = {
              ...pois[index],
              status: 'verified',
              verifiedAgoDays: 0,
              verifiedSource: 'Verificação Oficial Presencial',
              verifiedBy: attachment.name,
              dataQualityScore: Math.min(100, pois[index].dataQualityScore + 5),
              updatedAt: new Date().toISOString(),
            };

            const metrics = await getAppState<OperationalMetrics>(db, 'metrics', { ...INITIAL_METRICS });
            metrics.validatedThisWeek += 1;
            metrics.pendingValidation = Math.max(0, metrics.pendingValidation - 1);
            await insertOrUpdatePoiInDb(db, pois[index]);
            await setAppState(db, 'metrics', metrics);

            this.broadcast({ type: 'poi:update', data: pois[index] });
          }
        }
      }
    } catch {
      // Pacotes malformados são ignorados (paridade com server.ts)
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sendAll({ type: 'presence', data: { connectedUsers: this.state.getWebSockets().length } });
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    // O runtime fecha o socket; apenas presença é atualizada
    this.sendAll({ type: 'presence', data: { connectedUsers: this.state.getWebSockets().length } });
  }
}
