import type { Env } from './env';

// Broadcast via RPC do Durable Object (nunca endpoint HTTP interno).
// O DO está em src/realtime-do.ts (FASE 4).
type RealtimeStub = { broadcast(payload: unknown): Promise<void> };

export async function broadcast(env: Env, payload: unknown): Promise<void> {
  try {
    const stub = env.REALTIME.get(env.REALTIME.idFromName('global')) as unknown as RealtimeStub;
    await stub.broadcast(payload);
  } catch {
    // Sem binding REALTIME (dev sem DO) ou DO indisponível — não bloqueia a mutação
  }
}
