import React, { useState } from 'react';
import { POI } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';

interface PoiEditorScreenProps {
  poi: POI;
  onBack: () => void;
  onSimulateMobile?: () => void;
}

export const PoiEditorScreen: React.FC<PoiEditorScreenProps> = ({
  poi: initialPoi,
  onBack,
  onSimulateMobile,
}) => {
  const { updatePoi } = useRealtime();
  const [poi, setPoi] = useState<POI>({ ...initialPoi });
  const [activeTags, setActiveTags] = useState<string[]>([
    'Astronomia & Espaço',
    'Workshops Científicos',
    'Sessões Imersivas 360º',
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableTags = [
    'Astronomia & Espaço',
    'Workshops Científicos',
    'Sessões Imersivas 360º',
    'Fins de Semana',
    'Festas de Aniversário',
    'Robótica Infantil',
    'Acessível em Dias Chuvosos',
  ];

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    await updatePoi(poi);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col w-full pb-20">
      {/* Top Bar / Breadcrumb & Actions */}
      <div className="flex flex-col gap-2 pt-3 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-on-surface-variant font-label-md text-xs">
            <button onClick={onBack} className="hover:text-primary transition-colors flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px]">home</span>
              <span>Backoffice</span>
            </button>
            <span className="text-outline-variant">/</span>
            <button onClick={onBack} className="hover:text-primary transition-colors font-semibold">
              Curadoria de POIs
            </button>
            <span className="text-outline-variant">/</span>
            <span className="text-primary font-bold px-2 py-0.5 rounded-full bg-surface-container-high">
              {poi.code}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-[10px] uppercase tracking-wider font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span>
              Modo Edição / Rascunho Ativo
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[11px]">
              <span className="material-symbols-outlined text-[14px] text-primary">schedule</span>
              Auto-guardado há 2 min
            </span>
          </div>
        </div>

        {/* Title & Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight flex items-center gap-2">
              <span>Editar Ponto de Interesse (POI)</span>
              <span className="material-symbols-outlined text-primary text-[26px]">verified_user</span>
            </h1>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Registo de atrativo cultural com curadoria técnica para famílias em Portugal Continental e Ilhas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-lg text-xs font-semibold transition-all border border-surface-container-high shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-outline">save</span>
              <span>Guardar Rascunho</span>
            </button>

            {onSimulateMobile && (
              <button
                onClick={onSimulateMobile}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-xs font-semibold transition-all shadow-xs"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">smartphone</span>
                <span>Simular App Mobile</span>
              </button>
            )}

            <button
              onClick={handleSave}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-on-primary font-label-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${
                savedSuccess ? 'bg-emerald-600' : 'bg-primary hover:bg-primary-container'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                {savedSuccess ? 'check_circle' : 'send'}
              </span>
              <span>{savedSuccess ? 'Publicado com Sucesso!' : '+ Publicar e Ativar na App'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form Column (8 / 12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Section 1: Identificação & Categorização */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">edit_note</span>
                </span>
                <div>
                  <h2 className="font-headline-sm text-base text-on-surface font-bold">1. Identificação & Categorização</h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">Metadados principais e indexação no diretório</p>
                </div>
              </div>
              <span className="font-label-sm text-[10px] px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-bold">
                Obrigatório
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block font-label-md text-xs text-on-surface font-bold mb-1">
                  Nome Oficial do Espaço / Atração Cultural <span className="text-secondary">*</span>
                </label>
                <input
                  type="text"
                  value={poi.name}
                  onChange={(e) => setPoi({ ...poi, name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface font-bold mb-1">
                  Slug URI Canónico
                </label>
                <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-11 border border-surface-container-high text-xs">
                  <span className="text-outline">maisjuntos.pt/poi/</span>
                  <input
                    type="text"
                    value={poi.slug}
                    onChange={(e) => setPoi({ ...poi, slug: e.target.value })}
                    className="w-full bg-transparent text-primary font-bold pl-1 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface font-bold mb-1">
                  Categoria Principal da Família <span className="text-secondary">*</span>
                </label>
                <select
                  value={poi.categoryLabel}
                  onChange={(e) => setPoi({ ...poi, categoryLabel: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option>Ciência & Espaço</option>
                  <option>Museus & Ciência Interativa</option>
                  <option>Parques Urbanos & Jardins</option>
                  <option>Quintas Pedagógicas & Natureza</option>
                  <option>Património Histórico & Castelos</option>
                  <option>Teatros & Bibliotecas</option>
                </select>
              </div>

              {/* Tags Selector */}
              <div className="md:col-span-2">
                <label className="block font-label-md text-xs text-on-surface font-bold mb-1.5">
                  Subcategorias & Atributos de Busca Rápida
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
                          isSelected
                            ? 'bg-primary text-on-primary font-bold'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant'
                        }`}
                      >
                        <span>{tag}</span>
                        <span className="material-symbols-outlined text-[14px]">
                          {isSelected ? 'check' : 'add'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Short Description */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-label-md text-xs text-on-surface font-bold">
                    Descrição Curta Editorial (Exibida no feed - máx 140 carateres)
                  </label>
                  <span className="font-label-sm text-xs text-primary font-bold">
                    {poi.shortDescription.length} / 140
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={poi.shortDescription}
                  onChange={(e) => setPoi({ ...poi, shortDescription: e.target.value })}
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Full Description */}
              <div className="md:col-span-2">
                <label className="block font-label-md text-xs text-on-surface font-bold mb-1">
                  Guia Editorial Completo & Recomendações Familiares
                </label>
                <textarea
                  rows={4}
                  value={poi.fullDescription}
                  onChange={(e) => setPoi({ ...poi, fullDescription: e.target.value })}
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Idades, Preçário & Reservas */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">family_restroom</span>
                </span>
                <div>
                  <h2 className="font-headline-sm text-base text-on-surface font-bold">
                    2. Idades Recomendadas, Preçário & Reservas
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">Critérios de pertinência familiar</p>
                </div>
              </div>
              <span className="font-label-sm text-[10px] px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-bold">
                Filtros Essenciais
              </span>
            </div>

            {/* Space Type */}
            <div className="mb-4">
              <label className="block font-label-md text-xs text-on-surface font-bold mb-2">
                Ambiente & Adequação Meteorológica
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPoi({ ...poi, spaceType: 'interior' })}
                  className={`p-3 rounded-xl flex items-center gap-2 text-left border transition-all ${
                    poi.spaceType === 'interior'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">umbrella</span>
                  <div>
                    <span className="block text-xs font-bold">100% Interior</span>
                    <span className="text-[10px] text-on-surface-variant">Ideal para dias de chuva</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPoi({ ...poi, spaceType: 'exterior' })}
                  className={`p-3 rounded-xl flex items-center gap-2 text-left border transition-all ${
                    poi.spaceType === 'exterior'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">wb_sunny</span>
                  <div>
                    <span className="block text-xs font-bold">100% Ar Livre</span>
                    <span className="text-[10px] text-on-surface-variant">Jardins, parques</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPoi({ ...poi, spaceType: 'mixed' })}
                  className={`p-3 rounded-xl flex items-center gap-2 text-left border transition-all ${
                    poi.spaceType === 'mixed'
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-surface-container-high bg-surface-container-low text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">domain_verification</span>
                  <div>
                    <span className="block text-xs font-bold">Misto</span>
                    <span className="text-[10px] text-on-surface-variant">Áreas cobertas + jardim</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Pricing */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high mb-4">
              <span className="font-label-sm text-xs font-bold text-on-surface block mb-3">Preçário Estruturado (€)</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-semibold">Bilhete Criança</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={poi.priceChild}
                      onChange={(e) => setPoi({ ...poi, priceChild: parseFloat(e.target.value) || 0 })}
                      className="w-full h-10 px-3 pl-7 rounded-xl bg-surface-container-lowest text-on-surface font-bold text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-xs">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-semibold">Bilhete Adulto</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={poi.priceAdult}
                      onChange={(e) => setPoi({ ...poi, priceAdult: parseFloat(e.target.value) || 0 })}
                      className="w-full h-10 px-3 pl-7 rounded-xl bg-surface-container-lowest text-on-surface font-bold text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-xs">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-semibold">Pack Família (2A + 2C)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={poi.priceFamily}
                      onChange={(e) => setPoi({ ...poi, priceFamily: parseFloat(e.target.value) || 0 })}
                      className="w-full h-10 px-3 pl-7 rounded-xl bg-surface-container-lowest text-on-surface font-bold text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-xs">€</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Geolocalização */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </span>
                <div>
                  <h2 className="font-headline-sm text-base text-on-surface font-bold">4. Localização Exata & Entrada Familiar</h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">Coordenadas auditadas presencialmente</p>
                </div>
              </div>
              <span className="font-label-sm text-[10px] px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-bold">
                GPS Auditado
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-on-surface mb-1">Concelho</label>
                <input
                  type="text"
                  value={poi.city}
                  onChange={(e) => setPoi({ ...poi, city: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold border border-surface-container-high"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-on-surface mb-1">Morada Completa</label>
                <input
                  type="text"
                  value={poi.address}
                  onChange={(e) => setPoi({ ...poi, address: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs border border-surface-container-high"
                />
              </div>
            </div>

            {/* Map Canvas Preview */}
            <div className="w-full h-44 rounded-xl relative overflow-hidden bg-surface-container-high border border-surface-container-high flex items-end p-3">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAawhMJZfLbN9Hyx_LmnPN7w4SIjMtR2rwBUFETAKfYs563leJyc2B7sHT0NjHBl0oyIloLK-4NyoKphZardvZvj56dlcABntHH52RwI2nC39UEapaZtADGDjGGMISKvdWYAjir3AY6UtV8M7GMQLm5rGk-1z8G7B_8rJAaUpAxZMhzgZQLfh3Y96HklmaCijJYUkQ-iTBGguXMDfZVbA7J6Z5GxJU4e5joXZ3J4r1mSYAmE-ReOdjQ5A"
                alt="Mapa da Entrada"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="relative z-10 w-full bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center justify-between text-xs shadow-xs">
                <span className="font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Pin fixado na rampa norte familiar
                </span>
                <span className="font-mono text-[11px] text-primary font-bold">
                  {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column (4 / 12) */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">
          {/* Data Quality Score Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline font-bold">
                Auditoria de Dados
              </span>
              <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                Nível Editorial A+
              </span>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-container-highest"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <path
                    className="text-primary transition-all duration-700 ease-out"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${poi.dataQualityScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-headline-sm text-base text-on-surface font-bold leading-none">
                    {poi.dataQualityScore}%
                  </span>
                  <span className="font-label-sm text-[9px] text-primary font-semibold">Excelente</span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="font-headline-sm text-sm text-on-surface font-bold leading-tight">
                  Índice de Confiança
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Pronto para publicação na aplicação móvel.
                </p>
              </div>
            </div>

            {/* 5 Pillars Checklist */}
            <div className="space-y-1.5 pt-2 border-t border-surface-container-high text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  Geolocalização & Entrada GPS
                </span>
                <span className="font-bold text-primary">+20%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  Horários Confirmados
                </span>
                <span className="font-bold text-primary">+20%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  Preço e Bilhete Familiar
                </span>
                <span className="font-bold text-primary">+20%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  Checklist Familiar Completa
                </span>
                <span className="font-bold text-primary">+15%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
                  Linha Telefónica Testada
                </span>
                <span className="font-bold text-primary">+10%</span>
              </div>
            </div>
          </div>

          {/* Live Mobile Card Simulation */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-xs text-on-surface font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">phone_android</span>
                <span>Pré-visualização do Cartão</span>
              </h3>
              <span className="font-label-sm text-[10px] text-outline font-semibold">Feed dos Pais</span>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-container border border-surface-container-high">
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-xs border border-surface-container-high">
                <div className="relative w-full h-32 bg-surface-container-high">
                  <img
                    src={poi.coverImage}
                    alt={poi.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-bold text-[9px]">
                      {poi.categoryLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-black/60 text-white font-medium text-[9px] backdrop-blur-xs">
                      {poi.spaceType === 'interior' ? 'Interior 🏛️' : 'Exterior 🌳'}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-surface-bright text-primary font-bold text-[10px] shadow-xs">
                    Pack {poi.priceFamily.toFixed(0)}€
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aberto Hoje
                    </span>
                    <span className="text-[10px] text-outline">{poi.minAge} a {poi.maxAge} anos</span>
                  </div>
                  <h4 className="font-headline-sm text-xs text-on-surface font-bold truncate">
                    {poi.name}
                  </h4>
                  <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-2 mt-1">
                    {poi.shortDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
