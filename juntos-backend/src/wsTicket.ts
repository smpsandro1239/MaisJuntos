// Bilhetes efémeros para autenticar o WebSocket sem depender de cookies
// cross-site. O frontend na Vercel (maisjuntos-five.vercel.app) abre o socket
// em juntos-backend.<sub>.workers.dev; um cookie definido no domínio Vercel
// NUNCA é enviado nesse pedido (third-party cookie bloqueado pelo browser), o
// que deixava o WebSocket em 401. O cliente obtém então um bilhete assinado
// (HMAC-SHA256 com SESSION_SECRET, TTL curto) via `/api/auth/ws-ticket`
// same-origin (rewrite da Vercel → o cookie de sessão segue) e apresenta-o no
// handshake `?ticket=...`. O cookie continua a ser aceite como fallback (dev).

const TICKET_TTL_SECONDS = 120;

interface WsTicketPayload {
  sid: string;
  uid: string;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signWsTicket(
  secret: string,
  sessionId: string,
  userId: string,
  ttlSeconds: number = TICKET_TTL_SECONDS
): Promise<string> {
  const payload: WsTicketPayload = {
    sid: sessionId,
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

// Devolve a sessão/user do bilhete ou null se a assinatura for inválida,
// malformada ou o bilhete tiver expirado.
export async function verifyWsTicket(
  secret: string,
  ticket: string
): Promise<{ sessionId: string; userId: string } | null> {
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as WsTicketPayload;
    if (!payload?.sid || !payload?.uid || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return { sessionId: payload.sid, userId: payload.uid };
  } catch {
    return null;
  }
}
