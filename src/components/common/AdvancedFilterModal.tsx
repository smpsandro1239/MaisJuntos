import React from 'react';

export interface FilterOptions {
  ageRanges: string[];
  maxPrice: number | null; // null means no limit, 0 means free
  spaceType: 'all' | 'interior' | 'exterior' | 'mixed';
  amenities: string[];
  maxDistanceKm: number;
  openOnly: boolean;
}

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onChangeFilters: (filters: FilterOptions) => void;
  resultsCount: number;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  resultsCount,
}) => {
  if (!isOpen) return null;

  const toggleAge = (ageKey: string) => {
    const next = filters.ageRanges.includes(ageKey)
      ? filters.ageRanges.filter((a) => a !== ageKey)
      : [...filters.ageRanges, ageKey];
    onChangeFilters({ ...filters, ageRanges: next });
  };

  const toggleAmenity = (amenityKey: string) => {
    const next = filters.amenities.includes(amenityKey)
      ? filters.amenities.filter((a) => a !== amenityKey)
      : [...filters.amenities, amenityKey];
    onChangeFilters({ ...filters, amenities: next });
  };

  const resetFilters = () => {
    onChangeFilters({
      ageRanges: ['3-5'],
      maxPrice: null,
      spaceType: 'all',
      amenities: [],
      maxDistanceKm: 15,
      openOnly: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-base text-on-surface font-bold leading-tight">
                Filtros Familiares Avançados
              </h2>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Personaliza a busca de acordo com o teu dia e os teus filhos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* 1. Faixa Etária */}
        <div className="flex flex-col gap-2">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Faixa Etária das Crianças
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: '0-2', label: '< 2 anos', sub: 'Bebés / Colo' },
              { id: '3-5', label: '3 a 5 anos', sub: 'Pré-escolar' },
              { id: '6-10', label: '6 a 10 anos', sub: '1º e 2º Ciclo' },
              { id: '11+', label: '11+ anos', sub: 'Teens / Jovens' },
            ].map((age) => {
              const active = filters.ageRanges.includes(age.id);
              return (
                <button
                  key={age.id}
                  type="button"
                  onClick={() => toggleAge(age.id)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${
                    active
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="text-xs">{age.label}</span>
                  <span className="text-[10px] text-outline mt-0.5">{age.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Orçamento Máximo */}
        <div className="flex flex-col gap-2">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Orçamento por Criança
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 0, label: 'Grátis' },
              { val: 5, label: 'Até 5€' },
              { val: 10, label: 'Até 10€' },
              { val: null, label: 'Qualquer' },
            ].map((opt, i) => {
              const active = filters.maxPrice === opt.val;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, maxPrice: opt.val })}
                  className={`py-2 px-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                    active
                      ? 'border-primary bg-primary text-on-primary font-bold shadow-xs'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Tipo de Ambiente / Meteorologia */}
        <div className="flex flex-col gap-2">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Ambiente & Meteorologia
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'interior', label: 'Interior ☔', sub: 'Chuva' },
              { id: 'exterior', label: 'Ar Livre 🌳', sub: 'Sol' },
            ].map((space) => {
              const active = filters.spaceType === space.id;
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, spaceType: space.id as any })}
                  className={`py-2 px-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                    active
                      ? 'border-secondary-container bg-secondary-container text-on-secondary font-bold shadow-xs'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {space.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Comodidades Mandatórias */}
        <div className="flex flex-col gap-2">
          <span className="font-label-md text-xs font-bold text-on-surface uppercase tracking-wider">
            Comodidades Verificadas
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { id: 'fraldario', label: 'Fraldário dedicado e limpo', icon: 'baby_changing_station' },
              { id: 'carrinho', label: 'Acessível com carrinho', icon: 'stroller' },
              { id: 'estacionamento', label: 'Estacionamento fácil no local', icon: 'local_parking' },
              { id: 'neuro', label: 'Sensibilidade neurodivergente', icon: 'psychology' },
            ].map((item) => {
              const active = filters.amenities.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleAmenity(item.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    active
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                  <span className="text-[11px] flex-1 leading-snug">{item.label}</span>
                  {active && (
                    <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-container-high mt-1">
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-outline hover:text-on-surface underline"
          >
            Limpar Filtros
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <span>Ver {resultsCount} Atividades</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
