import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';

export const CategoriesScreen: React.FC = () => {
  const { metrics } = useRealtime();
  const [categories, setCategories] = useState(metrics.categoryDistribution);
  const [newCatName, setNewCatName] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    setCategories([
      ...categories,
      {
        category: newCatName.toLowerCase().replace(/\s+/g, '-'),
        label: newCatName,
        count: 0,
        percentage: 0,
        color: '#147a82',
      },
    ]);
    setNewCatName('');
  };

  return (
    <div className="flex flex-col gap-6 py-4 pb-16">
      <div>
        <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Gestão de Categorias Familiares</h1>
        <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
          Taxonomia nuclear de pontos de interesse adaptada às necessidades dos pais.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs flex flex-col gap-3">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Categorias Ativas ({categories.length})
          </span>
          <div className="divide-y divide-surface-container-high">
            {categories.map((cat) => (
              <div key={cat.category} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <div>
                    <span className="font-bold text-sm text-on-surface">{cat.label}</span>
                    <span className="text-xs text-on-surface-variant block">{cat.count} locais associados</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-semibold">
                    {cat.percentage}% do catálogo
                  </span>
                  <button className="p-1 text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs flex flex-col gap-4">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Adicionar Nova Categoria
          </span>
          <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Nome da Categoria</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Teatros & Marionetas"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-xs hover:bg-primary-container transition-all"
            >
              Adicionar à Taxonomia
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const CsvImportScreen: React.FC = () => {
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleSimulateImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImportedCount(28);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6 py-4 pb-16">
      <div>
        <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Importação em Lote (CSV / GeoJSON)</h1>
        <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
          Carregamento em massa de inventários municipais, roteiros ou dados abertos de turismo.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-8 shadow-xs flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-3">
          <span className="material-symbols-outlined text-[36px]">upload_file</span>
        </div>
        <h3 className="font-headline-sm text-lg font-bold text-on-surface">Arrasta o teu ficheiro CSV aqui</h3>
        <p className="font-body-sm text-xs text-on-surface-variant mt-1 max-w-sm">
          Colunas suportadas: Nome, Morada, Concelho, Latitude, Longitude, Preço, Idades, Carrinho_Bebé, Fraldário.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSimulateImport}
            disabled={importing}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-xs hover:bg-primary-container transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
            <span>{importing ? 'A processar e geocodificar...' : 'Importar Ficheiro de Teste'}</span>
          </button>
          <button
            onClick={() => alert('Download do modelo CSV iniciado!')}
            className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors"
          >
            Descarregar Modelo CSV
          </button>
        </div>

        {importedCount && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{importedCount} novos POIs importados e encaminhados para a fila de curadoria!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const AuditLogsScreen: React.FC = () => {
  const { metrics } = useRealtime();

  return (
    <div className="flex flex-col gap-6 py-4 pb-16">
      <div>
        <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Auditoria & Logs do Sistema</h1>
        <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
          Registo imutável de todas as verificações presenciais, atualizações de preços e alterações da comunidade.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
        <div className="p-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between text-xs">
          <span className="font-bold text-on-surface">Últimos Eventos de Integridade</span>
          <span className="text-primary font-semibold">Tempo Real Ativo</span>
        </div>
        <div className="divide-y divide-surface-container-high">
          {metrics.recentEditorialActions.map((log) => (
            <div key={log.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: log.color }}></span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{log.author}</span>
                  <span className="text-xs text-on-surface-variant">Modificação: {log.poiName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                  {log.badge}
                </span>
                <span className="text-outline font-mono text-[11px]">{log.timeAgo}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6 py-4 pb-16 max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Configurações & Parâmetros</h1>
        <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
          Configuração de limites operacionais, alertas e regras de negócio para o +JUNTOS.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs flex flex-col gap-4">
        <h3 className="font-headline-sm text-sm font-bold text-on-surface">Regras de Validação Editorial</h3>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
            <div>
              <span className="font-bold text-on-surface block">Meta de SLA para Denúncias</span>
              <span className="text-on-surface-variant text-[11px]">Prazo máximo de resolução após reporte de família</span>
            </div>
            <span className="font-bold text-primary">&lt; 4 horas</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
            <div>
              <span className="font-bold text-on-surface block">Data Quality Score Mínimo</span>
              <span className="text-on-surface-variant text-[11px]">Pontuação mínima para publicação automática</span>
            </div>
            <span className="font-bold text-primary">85%</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
            <div>
              <span className="font-bold text-on-surface block">Utilizador Curador Ativo</span>
              <span className="text-on-surface-variant text-[11px]">{user.email}</span>
            </div>
            <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded uppercase text-[10px]">
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Turso Database Connection Status */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">database</span>
            </span>
            <div>
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">Base de Dados Turso (LibSQL)</h3>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Conta: <strong className="text-primary font-mono">smpsandro1239</strong> • SQLite distribuído
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ligado & Ativo
          </span>
        </div>

        <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Endpoint / URL de Conexão:</span>
            <span className="font-mono text-primary font-semibold text-[11px]">
              libsql://juntos-smpsandro1239.aws-eu-west-1.turso.io
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant">Gestão Web Turso:</span>
            <a
              href="https://app.turso.tech/smpsandro1239"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
            >
              <span>app.turso.tech/smpsandro1239</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-surface-container-high text-[11px]">
            <span className="text-on-surface-variant">Tabelas sincronizadas:</span>
            <span className="text-on-surface font-semibold">pois, reports, app_state</span>
          </div>
        </div>
      </div>
    </div>
  );
};
