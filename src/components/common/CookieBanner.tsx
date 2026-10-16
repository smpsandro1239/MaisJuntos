import React, { useState } from 'react';

export const PRIVACY_EVENT = 'juntos:open-privacy';

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return localStorage.getItem('juntos_consent') === null;
    } catch {
      return false;
    }
  });

  if (!visible) return null;

  const decide = (choice: 'all' | 'essential') => {
    try {
      localStorage.setItem('juntos_consent', JSON.stringify({ choice, ts: Date.now() }));
    } catch {
      // armazenamento indisponível — apenas fecha o banner
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0">cookie</span>
        <p className="font-body-sm text-xs text-on-surface-variant flex-1">
          Usamos apenas armazenamento essencial (sessão e preferências) para o +JUNTOS funcionar. Não usamos
          cookies de publicidade nem rastreadores de terceiros.{' '}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(PRIVACY_EVENT))}
            className="text-primary font-semibold hover:underline"
          >
            Política de Privacidade e Termos
          </button>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => decide('essential')}
            className="px-3 py-2 rounded-xl border border-surface-container-high text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high transition-colors"
          >
            Só essenciais
          </button>
          <button
            type="button"
            onClick={() => decide('all')}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
};
