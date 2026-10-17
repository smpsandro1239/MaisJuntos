import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { CommunityReport } from '../../types';

export const ReportsScreen: React.FC = () => {
  const { reports, resolveReport } = useRealtime();

  const [selectedReportId, setSelectedReportId] = useState<string>('rep-4091');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const selectedReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  const filteredReports = reports.filter((r) => {
    if (statusFilter === 'open' && r.status !== 'open') return false;
    if (statusFilter === 'in_review' && r.status !== 'in_review') return false;
    if (statusFilter === 'resolved' && r.status !== 'resolved') return false;
    if (typeFilter !== 'all' && r.issueType !== typeFilter) return false;
    return true;
  });

  const openCount = reports.filter((r) => r.status === 'open').length;
  const inReviewCount = reports.filter((r) => r.status === 'in_review').length;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Meta Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-4 pb-6">
        <div className="flex flex-col max-w-3xl">
          <div className="flex items-center gap-2 text-primary font-label-md text-xs uppercase tracking-wider mb-1 font-bold">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Ciclo Colaborativo & Qualidade dos Dados</span>
            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <span className="text-on-surface-variant font-normal">SLA Alvo: &lt; 4 horas</span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Gestão de Denúncias e Reportes
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-1">
            Moderação de informações enviadas pelas famílias na app mobile para garantir 100% de precisão nos roteiros com crianças.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
          <button
            onClick={() => alert('A abrir histórico completo de moderações...')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-xs font-semibold transition-colors shadow-2xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Histórico de Moderações</span>
          </button>
          <button
            onClick={() => alert('Auditoria exportada para formato CSV.')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-lg text-xs font-bold shadow-xs hover:opacity-95 transition-opacity"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
            <span>Exportar Auditoria</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1 */}
        <div className="rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs uppercase tracking-wider text-outline font-bold">Fila Pendente</span>
            <span className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[18px]">notifications_active</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-3xl text-secondary font-bold">{openCount}</span>
              <span className="font-label-md text-xs text-secondary-container font-semibold">Críticas para validação</span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">3 com impacto em acessibilidade infantil</p>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-container-high flex items-center gap-1.5 text-secondary text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
            <span>2 reportadas há menos de 30 min</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs uppercase tracking-wider text-outline font-bold">Eficiência Operacional</span>
            <span className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant">
              <span className="material-symbols-outlined text-[18px]">avg_pace</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-3xl text-primary font-bold">3.4<span className="text-xl text-on-surface-variant">h</span></span>
              <span className="font-label-md text-xs text-primary font-semibold">-18m vs semana anterior</span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Tempo médio da denúncia à correção</p>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-container-high">
            <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs uppercase tracking-wider text-outline font-bold">Precisão Comunitária</span>
            <span className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-3xl text-on-surface font-bold">89%</span>
              <span className="font-label-md text-xs text-primary font-semibold">+4.2%</span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Reportes confirmados e aplicados</p>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-container-high flex items-center justify-between text-[11px] text-outline">
            <span>Falsos alarmes: 11%</span>
            <span>Amostra: 142 casos</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl bg-surface-container-lowest p-4 border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs uppercase tracking-wider text-outline font-bold">Rede Colaborativa</span>
            <span className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">groups</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-xl text-3xl text-on-surface font-bold">42</span>
              <span className="font-label-md text-xs text-on-surface-variant font-semibold">pais e cuidadores</span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Programa Embaixadores +JUNTOS</p>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-container-high flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full bg-primary text-on-primary text-[8px] font-bold flex items-center justify-center">MS</div>
              <div className="w-5 h-5 rounded-full bg-secondary text-on-secondary text-[8px] font-bold flex items-center justify-center">TC</div>
              <div className="w-5 h-5 rounded-full bg-tertiary-container text-on-tertiary text-[8px] font-bold flex items-center justify-center">RA</div>
            </div>
            <span className="font-label-sm text-[10px] text-outline font-semibold">+39 na região Norte</span>
          </div>
        </div>
      </div>

      {/* Main Split Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left List (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs ${
                    statusFilter === 'all'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  Todos ({reports.length})
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs ${
                    statusFilter === 'open'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  Abertos ({openCount})
                </button>
                <button
                  onClick={() => setStatusFilter('in_review')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs ${
                    statusFilter === 'in_review'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  Em Análise ({inReviewCount})
                </button>
                <button
                  onClick={() => setStatusFilter('resolved')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs ${
                    statusFilter === 'resolved'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  Resolvidos
                </button>
              </div>

              <span className="font-label-sm text-[11px] text-outline flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[14px]">sort</span> Mais recentes
              </span>
            </div>

            {/* Sub-Filters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-surface-container-high">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold mr-1">
                Filtrar:
              </span>
              <button
                onClick={() => setTypeFilter(typeFilter === 'price_changed' ? 'all' : 'price_changed')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === 'price_changed'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">payments</span> Preço Alterado
              </button>
              <button
                onClick={() => setTypeFilter(typeFilter === 'nursery_closed' ? 'all' : 'nursery_closed')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === 'nursery_closed'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">baby_changing_station</span> Fraldário Indisponível
              </button>
              <button
                onClick={() => setTypeFilter(typeFilter === 'schedule_wrong' ? 'all' : 'schedule_wrong')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === 'schedule_wrong'
                    ? 'bg-tertiary text-on-tertiary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">schedule</span> Horário Errado
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const isSelected = selectedReportId === report.id;
              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`bg-surface-container-lowest rounded-2xl p-4 border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-gradient-to-r from-primary-fixed/20 via-surface-container-lowest to-surface-container-lowest shadow-sm'
                      : 'border-surface-container-high hover:border-outline-variant shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          report.issueType === 'price_changed'
                            ? 'bg-secondary-fixed text-on-secondary-fixed'
                            : report.issueType === 'nursery_closed'
                            ? 'bg-primary-fixed text-on-primary-fixed-variant'
                            : 'bg-tertiary-fixed text-on-tertiary-fixed'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {report.issueType === 'price_changed'
                            ? 'payments'
                            : report.issueType === 'nursery_closed'
                            ? 'baby_changing_station'
                            : 'access_time'}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] font-bold ${
                              report.status === 'open'
                                ? 'bg-secondary text-on-secondary'
                                : report.status === 'in_review'
                                ? 'bg-surface-container-highest text-on-surface-variant'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {report.status.toUpperCase()}
                          </span>
                          <span className="font-label-sm text-[11px] text-outline">{report.reportedAgo}</span>
                          <span className="text-outline text-xs">•</span>
                          <span className="font-label-md text-xs font-bold text-on-surface">{report.issueLabel}</span>
                        </div>
                        <h2 className="font-headline-sm text-base text-on-surface font-bold mt-1 truncate">
                          {report.poiName}
                        </h2>
                        <span className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                          Reportado por: <strong className="text-on-surface font-semibold">{report.reporterName}</strong> ({report.reporterSubtitle})
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-surface-container font-label-sm text-[11px] text-primary font-bold shrink-0 self-start">
                      {report.code}
                    </span>
                  </div>

                  {/* Delta Comparison Bar */}
                  <div className="mt-3 p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant">Ficha: <s className="text-outline">{report.oldValue}</s></span>
                      <span className="material-symbols-outlined text-[14px] text-primary">arrow_forward</span>
                      <span className="font-bold text-secondary">{report.newValue}</span>
                    </div>
                    {report.hasPhotoProof && (
                      <div className="flex items-center gap-2">
                        {report.photoUrl && (
                          <img
                            src={report.photoUrl}
                            alt="Comprovativo fotográfico"
                            loading="lazy"
                            className="w-10 h-10 rounded-lg object-cover border border-surface-container-high shrink-0"
                          />
                        )}
                        <span className="text-[11px] text-outline italic">Comprovativo com foto</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2 border-t border-surface-container-high flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                      <span className="material-symbols-outlined text-[15px] text-tertiary">military_tech</span>
                      <span>{report.badgeLevel || `Confiança: ${report.reporterTrust}%`}</span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => resolveReport(report.id, true)}
                        className="px-3 py-1 rounded-xl bg-primary text-on-primary font-label-md text-xs font-bold shadow-xs hover:opacity-95 transition-opacity flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">done_all</span> Aceitar & Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detailed Dossier (5 Cols) */}
        {selectedReport && (
          <div className="xl:col-span-5 sticky top-20 flex flex-col gap-4">
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-md p-5 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between pb-2 border-b border-surface-container-high">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold">
                      INCIDENTE SELECIONADO
                    </span>
                    <span className="font-label-sm text-xs text-outline font-bold">{selectedReport.code}</span>
                  </div>
                  <h3 className="font-headline-md text-lg text-on-surface font-bold mt-1">
                    {selectedReport.poiName}
                  </h3>
                  <span className="font-body-sm text-xs text-on-surface-variant truncate block">
                    {selectedReport.poiAddress}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">apartment</span>
                </div>
              </div>

              {/* Spatial Evidence Mockup */}
              <div>
                <span className="font-label-md text-[11px] uppercase tracking-wider text-outline font-bold flex items-center gap-1 mb-1.5">
                  <span className="material-symbols-outlined text-[14px]">map</span> Localização do Reporte & Validação Espacial
                </span>
                <div
                  className="w-full h-36 rounded-xl relative overflow-hidden bg-surface-container flex items-end p-2.5 border border-surface-container-high"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDw8tvw9WyeEnbidKisexswh2HbezuICy1v_bY26rntDvKqb_cHnH3TvI10xIcDUdDH-XfqWb5e-aZZIceEcmJO2t1VVxESAb1-S_1t1W07jh0vDbUxJBIU733vqWP7748aIiJcSWfXtytNwu4nx99wn1SVaITowZkn2q6cTEE_S9ydj2rvWxk0TqAkHgxMcXb7E2H2maxAQV0uO_4mz5MUb5RQFx3m3vmrmRyUGYD1z-58IHhgpEnpXQ')",
                  }}
                >
                  <div className="bg-surface/90 backdrop-blur-md rounded-lg px-2.5 py-1 text-on-surface flex items-center gap-2 text-xs font-semibold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Reporte emitido a {selectedReport.gpsDistanceProofMeters} metros da bilheteira oficial</span>
                  </div>
                </div>
              </div>

              {/* Discrepância Box */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2.5">
                <span className="font-label-md text-[11px] uppercase tracking-wider text-outline font-bold">
                  Discrepância Reportada
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high">
                    <span className="font-label-sm text-[10px] text-outline uppercase font-bold">Ficha no Sistema</span>
                    <div className="font-headline-sm text-base text-on-surface font-bold mt-0.5">{selectedReport.oldValue}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary-fixed/40 border border-secondary/20">
                    <span className="font-label-sm text-[10px] text-secondary uppercase font-bold">Reportado no Local</span>
                    <div className="font-headline-sm text-base text-secondary font-bold mt-0.5">{selectedReport.newValue}</div>
                  </div>
                </div>
                <div>
                  <span className="font-label-sm text-[10px] text-outline font-bold">Comentário da Família:</span>
                  <p className="font-body-sm text-xs text-on-surface italic mt-0.5 leading-relaxed">
                    "{selectedReport.comment}"
                  </p>
                </div>
              </div>

              {/* Direct Facility Contact */}
              <div className="p-3 rounded-xl bg-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-[10px] uppercase text-outline font-bold">Contacto Direto</span>
                    <span className="font-label-lg text-xs font-bold text-on-surface">{selectedReport.poiPhone}</span>
                  </div>
                </div>
                <a
                  className="px-3 py-1.5 rounded-xl bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary font-label-md text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                  href={`tel:${selectedReport.poiPhone}`}
                >
                  <span className="material-symbols-outlined text-[15px]">call</span>
                  <span>Ligar Agora</span>
                </a>
              </div>

              {/* Ambassador Profile */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0 text-sm">
                  {selectedReport.reporterName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-label-lg text-xs font-bold text-on-surface">{selectedReport.reporterName}</span>
                    <span className="px-1.5 py-0.2 bg-primary-fixed text-primary font-bold text-[9px] rounded">
                      Confiança: {selectedReport.reporterTrust}%
                    </span>
                  </div>
                  <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
                    {selectedReport.reporterSubtitle}
                  </span>
                </div>
              </div>

              {/* Final Actions */}
              <div className="flex flex-col gap-2 pt-1 border-t border-surface-container-high">
                <button
                  onClick={() => resolveReport(selectedReport.id, true)}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-lg text-xs font-bold shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Aprovar & Propagar Atualização na App Mobile</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => alert('Mensagem enviada a solicitar foto complementar!')}
                    className="py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-md text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                    <span>Pedir Fotos</span>
                  </button>
                  <button
                    onClick={() => resolveReport(selectedReport.id, false)}
                    className="py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-error font-label-md text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">report_off</span>
                    <span>Rejeitar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Collaborative Notice */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high border border-surface-container-highest text-on-surface-variant flex items-start gap-2.5 text-xs">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0">info</span>
              <div>
                <strong className="text-on-surface font-semibold block">Regra de Recompensa Comunitária:</strong>
                Ao aprovar esta alteração, {selectedReport.reporterName} receberá automaticamente 50 pontos de mérito no Programa Embaixadores.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
