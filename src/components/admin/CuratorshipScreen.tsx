import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { POI } from '../../types';

interface CuratorshipScreenProps {
  onSelectPoiToEdit: (poi: POI) => void;
  onOpenNewPoiModal: () => void;
}

export const CuratorshipScreen: React.FC<CuratorshipScreenProps> = ({
  onSelectPoiToEdit,
  onOpenNewPoiModal,
}) => {
  const { pois, reports, verifyPoi, deletePoi } = useRealtime();

  const [selectedPoiId, setSelectedPoiId] = useState<string>('poi-planetario-braga');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [concelhoFilter, setConcelhoFilter] = useState<string>('braga');
  const [onlyWithAlerts, setOnlyWithAlerts] = useState<boolean>(false);
  const [searchTable, setSearchTable] = useState<string>('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>(['poi-planetario-braga']);

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) || pois[0];
  const relatedReport = reports.find((r) => r.poiId === selectedPoi?.id);

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const filteredPois = pois.filter((poi) => {
    if (searchTable) {
      const q = searchTable.toLowerCase();
      if (!poi.name.toLowerCase().includes(q) && !poi.city.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (concelhoFilter !== 'todos' && poi.city.toLowerCase() !== concelhoFilter.toLowerCase()) {
      return false;
    }
    if (onlyWithAlerts && !poi.hasActiveReport) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Curatorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-primary font-bold">
              Gestão Cultural · Norte de Portugal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            <span className="font-label-sm text-xs text-on-surface-variant font-medium">Sprint Semanal #14</span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Curadoria & Validação de POIs
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5 max-w-2xl">
            Verificação editorial humana, auditoria cadastral de infraestruturas infantis e acompanhamento em tempo real do Data Quality Score.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setOnlyWithAlerts(!onlyWithAlerts)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
              onlyWithAlerts
                ? 'bg-secondary text-on-secondary border-secondary'
                : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-surface-container-highest'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>{onlyWithAlerts ? 'Filtro Alertas Ativo' : 'Filtros Avançados'}</span>
          </button>

          <button
            onClick={onOpenNewPoiModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary shadow-xs transition-all text-xs font-bold active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
            <span>Novo POI Manual</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Pendentes */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-on-surface-variant font-semibold">Pendentes de Verificação</span>
            <div className="w-8 h-8 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl text-secondary font-bold leading-none">14</span>
            <span className="font-label-sm text-[10px] text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full font-bold">
              +3 hoje
            </span>
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant mt-1">
            Aguardam aprovação editorial prévia
          </span>
        </div>

        {/* Card 2: Qualidade Média */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-on-surface-variant font-semibold">Data Quality Score Médio</span>
            <div className="w-8 h-8 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl text-primary font-bold leading-none">92%</span>
            <span className="font-label-sm text-[10px] text-primary-container bg-primary-fixed/40 px-2 py-0.5 rounded-full font-bold">
              ↑ 4.1% vs mês ant.
            </span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '92%' }}></div>
          </div>
        </div>

        {/* Card 3: A Expirar */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-on-surface-variant font-semibold">A Expirar (&gt;30 dias)</span>
            <div className="w-8 h-8 rounded-xl bg-tertiary-fixed/60 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[18px]">update</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl text-tertiary font-bold leading-none">8</span>
            <span className="font-label-sm text-[10px] text-on-tertiary-fixed-variant bg-tertiary-fixed px-2 py-0.5 rounded-full font-bold">
              Atenção
            </span>
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant mt-1">
            Requerem contacto telefónico direto
          </span>
        </div>

        {/* Card 4: Total Ativos */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-on-surface-variant font-semibold">Total POIs Ativos</span>
            <div className="w-8 h-8 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[18px]">place</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl text-on-surface font-bold leading-none">342</span>
            <span className="font-label-sm text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full font-bold">
              18 Concelhos
            </span>
          </div>
          <span className="font-body-sm text-[11px] text-on-surface-variant mt-1">
            Braga, Guimarães, Porto & Cávado
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-xs mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">
              travel_explore
            </span>
            <input
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-surface-container-low rounded-xl text-on-surface placeholder:text-outline text-xs sm:text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Filtrar por nome do POI, concelho, museu, parque..."
              type="text"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 px-3 pr-8 bg-surface-container-low rounded-xl text-on-surface text-xs font-semibold appearance-none border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full sm:w-auto"
            >
              <option value="todos">Status: Todos</option>
              <option value="pendente">Status: Pendentes (14)</option>
              <option value="verificado">Status: Verificados (312)</option>
              <option value="revisar">Status: A Expirar (8)</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">
              keyboard_arrow_down
            </span>
          </div>

          {/* Concelho Dropdown */}
          <div className="relative">
            <select
              value={concelhoFilter}
              onChange={(e) => setConcelhoFilter(e.target.value)}
              className="h-11 px-3 pr-8 bg-surface-container-low rounded-xl text-on-surface text-xs font-semibold appearance-none border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full sm:w-auto"
            >
              <option value="todos">Concelho: Todos</option>
              <option value="braga">Braga (142)</option>
              <option value="guimarães">Guimarães (84)</option>
              <option value="porto">Porto (96)</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[18px]">
              keyboard_arrow_down
            </span>
          </div>
        </div>

        {/* Active Reports Toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithAlerts}
              onChange={(e) => setOnlyWithAlerts(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
            <span className="ml-2 font-label-md text-xs text-on-surface flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
              <span>Apenas com alertas de pais</span>
            </span>
          </label>
          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold">
            5 ativos
          </span>
        </div>
      </div>

      {/* Main Split Layout: Table (Left) + Inspector Drawer (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Table Container (8 Cols) */}
        <div className="xl:col-span-8 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">
          {/* Table Header & Bulk Toolbar */}
          <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedRowIds.length === filteredPois.length}
                onChange={() => {
                  if (selectedRowIds.length === filteredPois.length) {
                    setSelectedRowIds([]);
                  } else {
                    setSelectedRowIds(filteredPois.map((p) => p.id));
                  }
                }}
                className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
              />
              <span className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                {selectedRowIds.length} POIs Selecionados de {filteredPois.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  selectedRowIds.forEach((id) => verifyPoi(id));
                }}
                className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span> Aprovação Rápida
              </button>
              <button
                onClick={() => alert('Lista exportada com sucesso!')}
                className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span> Exportar
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-surface-container-lowest font-label-sm text-[11px] uppercase tracking-wider text-outline border-b border-surface-container-high">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Ponto de Interesse (POI)</th>
                  <th className="py-3 px-4">Faixa & Preço</th>
                  <th className="py-3 px-4">Data Quality</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {filteredPois.map((poi) => {
                  const isSelected = selectedPoiId === poi.id;
                  const isChecked = selectedRowIds.includes(poi.id);

                  return (
                    <tr
                      key={poi.id}
                      onClick={() => setSelectedPoiId(poi.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-surface-container-low'
                      }`}
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(poi.id)}
                          className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-xs bg-surface-container">
                            <img
                              src={poi.coverImage}
                              alt={poi.name}
                              className="w-full h-full object-cover"
                            />
                            {poi.hasActiveReport && (
                              <span
                                className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-white"
                                title="Alerta ativo de utilizador"
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-lg text-xs font-bold text-on-surface group-hover:text-primary transition-colors flex items-center gap-1">
                              {poi.name}
                              <span className="material-symbols-outlined text-primary text-[15px]">visibility</span>
                            </span>
                            <span className="font-body-sm text-xs text-on-surface-variant">
                              {poi.categoryLabel} • {poi.city}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-label-md text-xs text-on-surface font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-primary">child_care</span>
                            {poi.minAge} aos {poi.maxAge} anos
                          </span>
                          <span className="font-body-sm text-[11px] text-on-surface-variant">
                            {poi.isFree ? 'Gratuito' : `Biol. Familiar ${poi.priceFamily.toFixed(2)}€`}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[130px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between font-label-sm text-[10px]">
                            <span className="font-bold text-primary">{poi.dataQualityScore}%</span>
                            <span className="text-on-surface-variant">5/5 itens</span>
                          </div>
                          <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${poi.dataQualityScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-on-surface-variant">
                            Auditado há {poi.verifiedAgoDays}d
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {poi.hasActiveReport ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            Pendente (Reporte)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed/40 text-on-primary-fixed-variant font-label-sm text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            Verificado
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => verifyPoi(poi.id)}
                            className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-all"
                            title="Validar de imediato"
                          >
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </button>
                          <button
                            onClick={() => onSelectPoiToEdit(poi)}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-all"
                            title="Editar ficha completa"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="px-4 py-3 bg-surface-container-lowest border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
            <span>A apresentar {filteredPois.length} POIs</span>
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold">1</button>
              <button className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface">2</button>
            </div>
          </div>
        </div>

        {/* Curatorial Inspection & Fast Action Drawer (4 Cols) */}
        {selectedPoi && (
          <div className="xl:col-span-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-md p-5 flex flex-col sticky top-20 gap-4">
            {/* Drawer Top Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold">
                <span className="material-symbols-outlined text-[14px]">flag</span>
                <span>
                  {selectedPoi.hasActiveReport ? '1 Reporte Ativo de Pai' : 'Ficha Auditada'}
                </span>
              </div>
              <button
                onClick={() => onSelectPoiToEdit(selectedPoi)}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
              >
                <span>Ficha Completa</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </button>
            </div>

            {/* POI Preview Header with Banner */}
            <div className="relative rounded-xl overflow-hidden aspect-[16/9] shadow-inner group">
              <img
                src={selectedPoi.coverImage}
                alt={selectedPoi.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                <span className="font-headline-sm text-sm text-white font-bold leading-tight">
                  {selectedPoi.name}
                </span>
                <span className="font-body-sm text-[11px] text-white/90 truncate">
                  {selectedPoi.address}
                </span>
              </div>
            </div>

            {/* Reported Issue Alert Box if any */}
            {relatedReport ? (
              <div className="p-3 rounded-xl bg-secondary-fixed/40 border border-secondary/20 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
                  report_problem
                </span>
                <div className="flex flex-col text-xs">
                  <span className="font-label-md text-on-secondary-fixed font-bold">
                    Reporte da Comunidade ({relatedReport.reportedAgo})
                  </span>
                  <p className="font-body-sm text-on-secondary-fixed mt-0.5 leading-snug">
                    "{relatedReport.comment}"
                  </p>
                  <span className="font-label-sm text-[10px] text-on-secondary-fixed-variant mt-1 font-semibold">
                    — {relatedReport.reporterName} ({relatedReport.reporterSubtitle})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-300">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Nenhum reporte pendente. Horários e bilhética verificados.</span>
              </div>
            )}

            {/* Checklist de Validação Auditada */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-label-sm uppercase tracking-wider text-outline font-bold text-[10px]">
                  Checklist de Validação Auditada
                </span>
                <span className="text-primary font-bold">4 de 4 Validados</span>
              </div>

              <div className="space-y-1.5 bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest shadow-2xs">
                  <span className="font-body-sm text-on-surface font-medium">Horário confirmado por telefone</span>
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest shadow-2xs">
                  <span className="font-body-sm text-on-surface font-medium">Acessibilidade de carrinho (rampas)</span>
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest shadow-2xs">
                  <span className="font-body-sm text-on-surface font-medium">Fraldário e WC adaptado infantil</span>
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest shadow-2xs">
                  <span className="font-body-sm text-on-surface font-medium">Preçário atualizado</span>
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                </div>
              </div>
            </div>

            {/* Geocoding Micro-Widget */}
            <div>
              <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold block mb-1">
                Localização Verificada (Geocoding)
              </span>
              <div
                className="w-full h-20 rounded-xl bg-cover bg-center relative overflow-hidden flex items-end p-2 border border-surface-container-high"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAEmsVygt9zCnROuvtYjOGngw8yxyuiNsawCCVlVIRzOp9PmU04FQ4Rbsu6DfAIFrSNOx9mZCpHbRWk5zUT5Xv_thj36B1R_-OO3gGdncAZ-IIa-F6qx0CUIySMUkEhMzUGaGf_xWaF796DBeweDWOMylVXtIt8hIRfGjaqkPMznxdrQggrAmP29TTTpcNnKhstX8nPY1Zl-PERQ9xyfRJOgpjVE3xRSXCHPE3U42rRNzrLnT06GEM_7w')",
                }}
              >
                <div className="bg-surface/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-on-surface flex items-center gap-1 shadow-2xs">
                  <span className="material-symbols-outlined text-[12px] text-primary">pin_drop</span>
                  {selectedPoi.latitude.toFixed(4)}° N, {Math.abs(selectedPoi.longitude).toFixed(4)}° W
                </div>
              </div>
            </div>

            {/* Fast Action Buttons */}
            <div className="flex flex-col gap-2 pt-1 border-t border-surface-container-high">
              <button
                onClick={() => verifyPoi(selectedPoi.id)}
                className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Marcar como Verificado Hoje</span>
              </button>
              <button
                onClick={() => alert(`Mensagem institucional enviada para ${selectedPoi.phone}`)}
                className="w-full py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">outgoing_mail</span>
                <span>Pedir Esclarecimento à Entidade</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Deseja arquivar "${selectedPoi.name}"?`)) {
                    deletePoi(selectedPoi.id);
                  }
                }}
                className="w-full py-1.5 px-3 rounded-xl text-error hover:bg-error/10 font-label-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">archive</span>
                <span>Arquivar ou Ocultar da App</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
