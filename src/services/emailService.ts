// Serviço de email provider-agnostic.
//
// - Se `RESEND_API_KEY` estiver definida, envia através da API do Resend
//   (usando `fetch` nativo; sem dependências adicionais).
// - Caso contrário, funciona em "modo desenvolvimento": registra o conteúdo
//   no console (útil para testar localmente sem fornecedor de email).
//
// Este serviço NUNCA lança exceção: uma falha de entrega de email não deve
// quebrar o fluxo de autenticação. O resultado indica se foi entregue.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  ok: boolean;
  delivered: boolean;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function appBaseUrl(): string {
  const raw = process.env.APP_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || '+JUNTOS <noreply@maisjuntos.pt>';

  if (!apiKey) {
    console.log('[Email] (modo desenvolvimento — sem RESEND_API_KEY)');
    console.log(`[Email] Para: ${message.to}`);
    console.log(`[Email] Assunto: ${message.subject}`);
    console.log(`[Email] Conteúdo:\n${message.text}`);
    return { ok: true, delivered: false };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[Email] Falha de envio via Resend. HTTP', res.status, detail.slice(0, 200));
      return { ok: false, delivered: false };
    }
    return { ok: true, delivered: true };
  } catch (err: any) {
    console.error('[Email] Erro de rede ao enviar via Resend:', err?.name || 'erro');
    return { ok: false, delivered: false };
  }
}

export function buildVerificationEmail(token: string): EmailMessage & { to?: string } {
  const link = `${appBaseUrl()}/?verifyToken=${encodeURIComponent(token)}`;
  return {
    to: '',
    subject: 'Confirma o teu email — +JUNTOS',
    text: [
      'Bem-vindo(a) ao +JUNTOS!',
      '',
      'Confirma o teu endereço de email para ativar a conta, seguindo a hiperligação:',
      link,
      '',
      'A ligação é válida durante 24 horas. Se não criaste esta conta, ignora este email.',
    ].join('\n'),
    html: [
      '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">',
      '<h2 style="color:#0f766e">Bem-vindo(a) ao +JUNTOS</h2>',
      '<p>Confirma o teu endereço de email para ativares a conta.</p>',
      `<p><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">Confirmar email</a></p>`,
      `<p style="color:#64748b;font-size:13px">A ligação é válida durante 24 horas. Se não criaste esta conta, ignora este email.</p>`,
      '</div>',
    ].join(''),
  };
}

export function buildPasswordResetEmail(token: string): EmailMessage & { to?: string } {
  const link = `${appBaseUrl()}/?resetToken=${encodeURIComponent(token)}`;
  return {
    to: '',
    subject: 'Repor a palavra-passe — +JUNTOS',
    text: [
      'Recebemos um pedido para repor a tua palavra-passe no +JUNTOS.',
      '',
      'Define uma nova palavra-passe através da ligação:',
      link,
      '',
      'A ligação é válida durante 60 minutos e só pode ser usada uma vez.',
      'Se não pediste esta alteração, podes ignorar este email — a tua palavra-passe atual mantém-se.',
    ].join('\n'),
    html: [
      '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">',
      '<h2 style="color:#0f766e">Repor a palavra-passe</h2>',
      '<p>Recebemos um pedido para repor a tua palavra-passe no +JUNTOS.</p>',
      `<p><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">Definir nova palavra-passe</a></p>`,
      '<p style="color:#64748b;font-size:13px">A ligação é válida durante 60 minutos e só pode ser usada uma vez. Se não pediste esta alteração, ignora este email.</p>',
      '</div>',
    ].join(''),
  };
}
