import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// Testes de integração do Worker +JUNTOS que não exigem Turso (bindings de
// teste não trazem TURSO_DATABASE_URL/AUTH_TOKEN). Cobrem contrato HTTP:
// healthcheck, 404 diferenciado (texto na raiz vs JSON em /api), cabeçalhos de
// segurança e proteção CSRF. A paridade de rotas com dados é coberta por
// tests/api-coverage.test.ts (Express).

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Worker +JUNTOS", () => {
  it("GET /api/healthz devolve provider cloudflare-workers", async () => {
    const res = await SELF.fetch("https://example.com/api/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; provider: string };
    expect(body.provider).toBe("cloudflare-workers");
    expect(typeof body.status).toBe("string");
  });

  it("raiz não-API devolve 404 com texto informativo", async () => {
    const request = new IncomingRequest("https://example.com/");
    const ctx = createExecutionContext();
    const res = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Servidor de API +JUNTOS");
  });

  it("rota /api inexistente devolve 404 JSON", async () => {
    const res = await SELF.fetch("https://example.com/api/nao-existe");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Recurso não encontrado.");
  });

  it("aplica cabeçalhos de segurança em todas as respostas", async () => {
    const res = await SELF.fetch("https://example.com/api/healthz");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  // Nota: em produção (NODE_ENV=production) o Worker recusa Origin ausente com
  // 403 ("Origin obrigatório em produção."). No ambiente de teste do miniflare
  // o NODE_ENV não é production, pelo que o pedido passa o CSRF e chega à
  // validação (400/Zod). O contrato determinístico testável aqui é a recusa de
  // Origin NÃO autorizada (403), abaixo.
  it("CSRF: POST com Origin não autorizada → 403", async () => {
    const res = await SELF.fetch("https://example.com/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://atacante.example" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Origem não autorizada.");
  });

  it("WS: GET /ws sem Upgrade → 426", async () => {
    const res = await SELF.fetch("https://example.com/ws");
    expect(res.status).toBe(426);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Upgrade: websocket");
  });

  it("aprovar proposta sem sessão → 401 (RBAC antes da lógica)", async () => {
    const res = await SELF.fetch("https://example.com/api/reports/rep-inexistente/approve", {
      method: "POST",
      headers: { Origin: "https://maisjuntos-five.vercel.app" },
    });
    expect(res.status).toBe(401);
  });
});
