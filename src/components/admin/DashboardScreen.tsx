import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { AdminTab } from './AdminSidebar';
import { POI } from '../../types';

interface DashboardScreenProps {
  onNavigateTab: (tab: AdminTab) => void;
  onSelectPoiToEdit: (poi: POI) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateTab,
  onSelectPoiToEdit,
}) => {
  const { metrics, reports, pois } = useRealtime();
  const [selectedDistrict, setSelectedDistrict] = useState('Braga (Distrito Sede)');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 800);
  };

  const featuredPoi = pois.find((p) => p.id === 'poi-quinta-pedagogica') || pois[0];
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Welcome & District Filter Bar */}
      <section className="py-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-primary font-label-md text-xs font-bold">
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span className="tracking-wider uppercase">Painel de Controlo Central</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface-variant font-normal">Norte Litoral</span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface mt-1 tracking-tight">
            Visão Operacional & Integridade de Dados
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Sexta-feira, 24 de Maio de 2024 • Última verificação de telemetria há 4 minutos
          </p>
        </div>

        {/* Quick Territory Selector & Sync */}
        <div className="flex flex-wrap items-center gap-2 bg-surface-container p-1.5 rounded-2xl border border-surface-container-high shadow-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest rounded-xl text-on-surface shadow-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-transparent font-label-lg text-xs sm:text-sm text-on-surface focus:outline-none cursor-pointer pr-1"
            >
              <option>Braga (Distrito Sede)</option>
              <option>Porto Metropolitano</option>
              <option>Guimarães & Ave</option>
              <option>Viana do Castelo</option>
              <option>Todo o Norte (Consolidado)</option>
            </select>
          </div>

          <button
            onClick={handleSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface-variant font-label-md text-xs font-semibold transition-colors"
            title="Forçar reindexação"
            type="button"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-primary transition-transform duration-700 ${
                isSyncing ? 'rotate-180' : ''
              }`}
            >
              sync
            </span>
            <span>{isSyncing ? 'A sincronizar...' : 'Sincronizar'}</span>
          </button>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {/* KPI 1: Ativos Validados */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
              Ativos Validados
            </span>
            <span className="p-2 rounded-xl bg-surface-container text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-on-surface leading-none">
              {metrics.totalPois}
            </span>
            <span className="font-label-md text-xs text-primary font-bold">
              +{metrics.validatedThisWeek} esta semana
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant font-body-sm text-xs">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span>Total POIs familiares ativos no app</span>
          </div>
        </div>

        {/* KPI 2: Score Médio Qualidade */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
              Score Médio Qualidade
            </span>
            <span className="p-2 rounded-xl bg-surface-container text-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-primary leading-none">
              {metrics.averageDataQuality}%
            </span>
            <span className="font-label-md text-xs text-on-surface-variant">Meta: 90%</span>
          </div>
          <div className="mt-2 w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: `${metrics.averageDataQuality}%` }}></div>
          </div>
        </div>

        {/* KPI 3: Denúncias */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
              Denúncias da Família
            </span>
            <span className="p-2 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">flag</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-secondary leading-none">
              {openReportsCount}
            </span>
            <span className="font-label-md text-xs text-secondary font-bold">Crítico</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant font-body-sm text-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Aguardam moderação editorial</span>
          </div>
        </div>

        {/* KPI 4: Comunidade Ativa */}
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
              Comunidade Ativa (Mês)
            </span>
            <span className="p-2 rounded-xl bg-surface-container text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">family_restroom</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-on-surface leading-none">
              {metrics.activeCommunityCount.toLocaleString('pt-PT')}
            </span>
            <span className="font-label-sm text-[10px] bg-tertiary-fixed text-on-tertiary-fixed px-1.5 py-0.5 rounded font-bold uppercase">
              Beta Aberta
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant font-body-sm text-xs">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>+14.8% face ao mês anterior</span>
          </div>
        </div>
      </section>

      {/* Operational Shortcuts Bar */}
      <section className="mt-5 p-4 rounded-2xl bg-primary text-on-primary shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary-fixed text-[26px]">bolt</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-base text-on-primary font-bold leading-tight">
              Ações Imediatas em Fila
            </h2>
            <p className="font-body-sm text-xs text-on-primary/80 mt-0.5">
              32 novos locais propostos por parceiros e utilizadores aguardam revisão humana.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigateTab('curadoria-de-pois')}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-on-secondary font-label-lg text-xs font-bold transition-all shadow-xs active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">checklist_rtl</span>
            <span>Validar Fila (32)</span>
          </button>
          <button
            onClick={() => onNavigateTab('denuncias-e-reportes')}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-on-primary font-label-lg text-xs font-bold transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">report_problem</span>
            <span>Resolver {openReportsCount} Denúncias</span>
          </button>
          <button
            onClick={() => {
              const csvContent = 'data:text/csv;charset=utf-8,ID,Nome,Cidade,Score\n' + pois.map(p => `${p.code},"${p.name}",${p.city},${p.dataQualityScore}%`).join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', 'relatorio_pois_juntos.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-on-primary font-label-lg text-xs font-bold transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Relatório CSV</span>
          </button>
        </div>
      </section>

      {/* Main Split Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left Column (8 / 12) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Card: Taxonomia Familiar */}
          <section className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-surface-container-high">
              <div>
                <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
                  Taxonomia Familiar
                </span>
                <h2 className="font-headline-md text-lg text-on-surface font-bold">
                  Distribuição de POIs por Categoria
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> 5 Categorias Nucleares
              </span>
            </div>

            {/* Donut Chart & Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pt-4">
              {/* Donut SVG Illustration */}
              <div className="md:col-span-4 flex flex-col items-center justify-center relative">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 160 160">
                  <circle
                    className="text-surface-container"
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="currentColor"
                    strokeWidth="18"
                  />
                  {/* Parques 38% */}
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="#006067"
                    strokeDasharray="389.5"
                    strokeDashoffset="241"
                    strokeWidth="18"
                  />
                  {/* Museus 26% */}
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="#147a82"
                    strokeDasharray="389.5"
                    strokeDashoffset="140"
                    strokeWidth="18"
                  />
                  {/* Espaços Cobertos 16% */}
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="#ffba27"
                    strokeDasharray="389.5"
                    strokeDashoffset="78"
                    strokeWidth="18"
                  />
                  {/* Quintas 12% */}
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="#b5260b"
                    strokeDasharray="389.5"
                    strokeDashoffset="31"
                    strokeWidth="18"
                  />
                  {/* Restaurantes 8% */}
                  <circle
                    cx="80"
                    cy="80"
                    fill="transparent"
                    r="62"
                    stroke="#6e797a"
                    strokeDasharray="389.5"
                    strokeDashoffset="0"
                    strokeWidth="18"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-headline-lg text-2xl font-bold text-on-surface leading-none">
                    {metrics.totalPois}
                  </span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5 font-bold">
                    Locais
                  </span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="md:col-span-8 flex flex-col gap-2.5">
                {metrics.categoryDistribution.map((cat) => (
                  <div key={cat.category}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-label-md text-on-surface font-semibold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                        {cat.label}
                      </span>
                      <span className="font-label-md text-on-surface-variant">
                        {cat.count} POIs <strong className="text-on-surface font-bold ml-1">({cat.percentage}%)</strong>
                      </span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Card: Territorial Coverage Table */}
          <section className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2 border-b border-surface-container-high">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">map</span>
                  <h2 className="font-headline-md text-lg text-on-surface font-bold">
                    Cobertura Territorial & Coeficiente de Confiança
                  </h2>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Indicador ponderado por auditoria de horários, telefones funcionais e acessos para carrinhos.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('curadoria-de-pois')}
                className="inline-flex items-center gap-1 text-primary font-label-md text-xs font-bold hover:underline"
              >
                <span>Ver lista completa</span>
                <span className="material-symbols-outlined text-[16px]">north_east</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-surface-container-low text-outline font-label-sm text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 rounded-l-lg">Concelho / Polo</th>
                    <th className="py-2.5 px-3">POIs Auditados</th>
                    <th className="py-2.5 px-3">Taxa de Verificação</th>
                    <th className="py-2.5 px-3">Índice Confiança</th>
                    <th className="py-2.5 px-3 rounded-r-lg text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/40">
                  {metrics.territorialCoverage.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/60 transition-colors">
                      <td className="py-3 px-3 font-label-lg text-on-surface flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary font-headline-sm text-xs font-bold">
                          {item.initial}
                        </span>
                        <div>
                          <span className="block font-bold text-xs leading-snug">{item.concelho}</span>
                          <span className="font-body-sm text-[11px] text-on-surface-variant">{item.sublabel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-on-surface font-semibold">{item.poisAudited} POIs</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-surface-container rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${item.verificationRate}%` }}></div>
                          </div>
                          <span className="font-label-sm text-xs font-semibold">{item.verificationRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-md text-xs font-bold">
                          <span className="material-symbols-outlined text-[13px]">shield</span> {item.confidenceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onNavigateTab('curadoria-de-pois')}
                          className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                          title={`Inspecionar ${item.concelho}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Featured Cultural Spot Highlight Card */}
          {featuredPoi && (
            <section className="rounded-2xl overflow-hidden bg-surface-container-lowest border border-surface-container-high shadow-xs flex flex-col sm:flex-row items-stretch">
              <div className="sm:w-2/5 relative min-h-[170px]">
                <img
                  className="w-full h-full object-cover"
                  alt={featuredPoi.name}
                  src={featuredPoi.coverImage}
                />
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-label-sm text-[10px] font-bold flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  <span>POI Destaque da Semana</span>
                </div>
              </div>
              <div className="sm:w-3/5 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                      Auditado • {featuredPoi.city}
                    </span>
                    <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold">
                      100% Validado
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-base text-on-surface font-bold mt-1">
                    {featuredPoi.name}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                    {featuredPoi.shortDescription}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-surface-container-high mt-2">
                  <span className="font-label-sm text-xs text-on-surface-variant">
                    Revisora: <strong className="text-on-surface">Marta F.</strong>
                  </span>
                  <button
                    onClick={() => onSelectPoiToEdit(featuredPoi)}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-variant text-primary font-label-md text-xs font-bold transition-colors"
                    type="button"
                  >
                    Editar Ficha POI
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right Column (4 / 12) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Critical Data Alerts Widget */}
          <section className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                </span>
                <h2 className="font-headline-sm text-base text-on-surface font-bold">Alertas de Dados</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] font-bold">
                2 Críticos
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant my-2.5">
              Inconsistências detetadas pelo crawler automático durante a madrugada.
            </p>

            <div className="space-y-2.5">
              {/* Alert 1 */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high hover:bg-surface-container transition-colors flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                  phone_disabled
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-xs text-on-surface font-bold truncate">
                      3 POIs com Telefone Desatualizado
                    </span>
                    <span className="font-label-sm text-[10px] text-secondary font-bold shrink-0 ml-1">
                      Urgente
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                    Museu Pio XII, Quinta da Silva e Centro Ciência Guimarães.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                      onClick={() => onNavigateTab('curadoria-de-pois')}
                      className="font-label-sm text-primary hover:underline font-bold"
                    >
                      Ligar e Confirmar
                    </button>
                    <span className="text-outline">•</span>
                    <button className="font-label-sm text-on-surface-variant hover:text-on-surface">
                      Dispensar
                    </button>
                  </div>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high hover:bg-surface-container transition-colors flex items-start gap-2.5">
                <span className="material-symbols-outlined text-tertiary-container text-[20px] shrink-0 mt-0.5">
                  update_disabled
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-xs text-on-surface font-bold truncate">
                      Horários &gt; 45 dias sem auditoria
                    </span>
                    <span className="font-label-sm text-[10px] text-outline shrink-0 ml-1">8 POIs</span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                    Risco de alterações de Verão não refletidas na app móvel.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                      onClick={() => onNavigateTab('curadoria-de-pois')}
                      className="font-label-sm text-primary hover:underline font-bold"
                    >
                      Abrir Lote de Revisão
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Real-Time Activity Feed */}
          <section className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                <h2 className="font-headline-sm text-base text-on-surface font-bold">Ações Editoriais</h2>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant font-semibold">Hoje</span>
            </div>

            <div className="relative pl-5 space-y-4 pt-3 before:absolute before:left-2 before:top-4 before:bottom-4 before:w-0.5 before:bg-surface-container-high">
              {metrics.recentEditorialActions.map((action) => (
                <div key={action.id} className="relative">
                  <span
                    className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-surface-container-lowest"
                    style={{ backgroundColor: action.color }}
                  />
                  <div>
                    <p className="font-label-md text-xs text-on-surface leading-tight">
                      <strong className="font-bold">{action.author}</strong> ativou{' '}
                      <em>{action.poiName}</em>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-label-sm text-[11px] text-outline">{action.timeAgo}</span>
                      <span className="font-label-sm text-[10px] px-1.5 py-0.2 bg-surface-container rounded text-on-surface-variant font-semibold">
                        {action.badge}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-4 border-t border-surface-container-high">
              <button
                onClick={() => onNavigateTab('auditoria-e-logs')}
                className="w-full py-2 flex items-center justify-center gap-1 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-bold transition-colors"
              >
                <span>Ver Registo Completo de Logs</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </section>

          {/* Quick Tips for Curators */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high shadow-xs flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-[22px] shrink-0">lightbulb</span>
            <div>
              <span className="font-label-md text-xs text-on-surface font-bold">Dica de Curadoria +JUNTOS</span>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                POIs com indicação explícita de "Acesso a Carrinho de Bebé" têm uma taxa de gravação nos favoritos 3.4x superior pelos pais.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
