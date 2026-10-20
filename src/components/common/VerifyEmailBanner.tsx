import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

// Barra de aviso quando a conta tem sessão iniciada mas o email ainda não foi
// confirmado. Permite reenviar o email de confirmação ou dispensar o aviso.
//
// É posicionada ABAIXO do header fixo e reserva a sua altura numa variável CSS
// (`--verify-banner-h`), consumida pelo `padding-top` das <main>. Assim o aviso
// nunca tapa o header (em especial o botão de perfil no canto superior direito).
export const VerifyEmailBanner: React.FC = () => {
  const { user, isLoggedIn, resendVerification } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('juntos_verify_dismissed') === 'true'
  );
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const visible = isLoggedIn && user.emailVerified === false && !dismissed;

  // Reserva espaço no topo (abaixo do header fixo de 4rem) para o aviso não o tapar.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty('--verify-banner-h', '0px');
      return;
    }
    const apply = () => root.style.setProperty('--verify-banner-h', `${ref.current?.offsetHeight ?? 0}px`);
    apply();
    const observer = new ResizeObserver(apply);
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      root.style.setProperty('--verify-banner-h', '0px');
    };
  }, [visible]);

  if (!visible) return null;

  const handleResend = async () => {
    setSending(true);
    const result = await resendVerification();
    setStatus(result.ok ? result.message || 'Email de confirmação reenviado.' : result.error || 'Não foi possível reenviar.');
    setSending(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('juntos_verify_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div
      ref={ref}
      className="fixed top-[calc(4rem+env(safe-area-inset-top,0px))] inset-x-0 z-30 bg-primary text-on-primary px-4 py-2.5 shadow-md"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-3 flex-wrap justify-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
          <span className="font-body-sm text-xs sm:text-sm">
            {status || 'Confirma o teu email para ativar todas as funcionalidades da conta.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResend}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg bg-on-primary/15 hover:bg-on-primary/25 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {sending ? 'A enviar...' : 'Reenviar email'}
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dispensar aviso"
            className="w-7 h-7 rounded-lg hover:bg-on-primary/20 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
