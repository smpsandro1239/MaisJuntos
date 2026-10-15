// Configuração de endpoints do backend.
// Em desenvolvimento local ficam vazios → pedidos relativos (proxy do Vite/Express).
// Em produção (Vercel) definir VITE_API_URL e VITE_WS_URL no ambiente do projeto
// e correr `vercel --prod` (são valores de build-time).
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
