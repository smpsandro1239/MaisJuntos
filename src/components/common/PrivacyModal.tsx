import React, { useEffect, useState } from 'react';
import { PRIVACY_EVENT } from './CookieBanner';

export const PrivacyModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(PRIVACY_EVENT, open);
    return () => window.removeEventListener(PRIVACY_EVENT, open);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 relative">
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Fechar"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="font-headline-sm text-xl text-on-surface font-bold">Privacidade e Termos de Utilização</h2>
        <p className="font-body-sm text-xs text-on-surface-variant mt-1">
          Em conformidade com o RGPD (Regulamento UE 2016/679). Última atualização: outubro de 2026.
        </p>

        <div className="mt-5 flex flex-col gap-5 font-body-sm text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">1. Que dados recolhemos</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                <strong>Conta:</strong> nome, email e palavra-passe (armazenada unicamente como hash PBKDF2/SHA-256,
                nunca em texto simples).
              </li>
              <li>
                <strong>Preferências:</strong> pontos de interesse favoritos e roteiros familiares que crias, associados
                à tua conta.
              </li>
              <li>
                <strong>Contribuições:</strong> alertas/reportes sobre espaços, que passam a ser informação pública da
                comunidade.
              </li>
              <li>
                <strong>Localização:</strong> apenas quando autorizas, no momento de validar a proximidade a um espaço.
                Não é guardada permanentemente.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">2. Dados de menores</h3>
            <p>
              O +JUNTOS destina-se a ser usado por adultos responsáveis pela família. Nomes e idades de crianças são
              opcionais e servem exclusivamente para personalizar sugestões. Ao introduzi-los, o adulto declara ter
              responsabilidade parental e presta o consentimento necessário (RGPD, art. 8.º).
            </p>
          </section>

          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">3. Partilha com terceiros</h3>
            <p>
              Não vendemos nem cedemos dados pessoais. Recorremos a serviços de infraestrutura (alojamento, base de dados)
              e a uma API pública de meteorologia que recebe apenas coordenadas aproximadas de cidades — nunca dados
              pessoais.
            </p>
          </section>

          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">4. Os teus direitos</h3>
            <p>
              Podes aceder, corrigir, exportar e eliminar os teus dados. O direito ao esquecimento está disponível
              diretamente na app: com a sessão iniciada, abre o teu perfil e escolhe{' '}
              <strong>«Apagar a minha conta»</strong>. A eliminação é imediata e irreversível; os reportes comunitários
              são anonimizados.
            </p>
          </section>

          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">5. Cookies e armazenamento local</h3>
            <p>
              Usamos apenas armazenamento essencial: um cookie de sessão (<code>HttpOnly</code>, <code>Secure</code>) e
              preferências locais (tema escuro, consentimento). Não existem cookies de publicidade nem rastreadores de
              terceiros.
            </p>
          </section>

          <section>
            <h3 className="font-label-lg text-on-surface font-bold mb-1">6. Contacto</h3>
            <p>
              Para exercer qualquer direito ou colocar questões de privacidade, contacta o responsável pelo tratamento em{' '}
              <span className="text-on-surface font-semibold">privacidade@maisjuntos.pt</span>.
            </p>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
