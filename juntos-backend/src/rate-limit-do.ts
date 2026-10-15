// Rate limiting durável (FASE 7 — correção)
// Porquê: o binding `unsafe: ratelimit` do wrangler exige um namespace real
// criado via API/dashboard. Com um namespace_id inexistente, `limit()` devolve
// sempre { success: true } (no-op silencioso) — verificado em produção com
// wrangler tail. Alternativa autónoma: Durable Object com janela fixa por
// (limiter, IP). Um DO por chave → sem contenção global.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

interface Janela {
  inicio: number;
  contagem: number;
}

export class RateLimitDO extends DurableObject<Env> {
  async limit(limite: number, periodoSegundos: number): Promise<{ success: boolean; remaining: number }> {
    const agora = Date.now();
    const janelaMs = periodoSegundos * 1000;
    const atual = (await this.ctx.storage.get<Janela>('janela')) ?? { inicio: agora, contagem: 0 };

    let inicio = atual.inicio;
    let contagem = atual.contagem;
    if (agora - inicio >= janelaMs) {
      inicio = agora;
      contagem = 0;
    }
    contagem += 1;
    await this.ctx.storage.put('janela', { inicio, contagem });

    return { success: contagem <= limite, remaining: Math.max(0, limite - contagem) };
  }
}
