import React, { useState } from 'react';
import { POI } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';

interface PoiDetailScreenProps {
  poi: POI;
  onBack: () => void;
  onOpenReportModal: () => void;
  onAddToPlan?: () => void;
}

export const PoiDetailScreen: React.FC<PoiDetailScreenProps> = ({
  poi,
  onBack,
  onOpenReportModal,
  onAddToPlan,
}) => {
  const { favorites, toggleFavorite } = useAuth();
  const { familyPlan } = useRealtime();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [addedToPlan, setAddedToPlan] = useState(false);

  const isFav = favorites.includes(poi.id);
  const images = poi.images.length > 0 ? poi.images : [poi.coverImage];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: poi.name,
        text: `Olha este plano ideal para os miúdos na app +JUNTOS: ${poi.name}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert('Link da atividade copiado para a área de transferência!');
    }
  };

  const handleAddPlanClick = () => {
    setAddedToPlan(true);
    if (onAddToPlan) onAddToPlan();
    setTimeout(() => setAddedToPlan(false), 2500);
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-surface pb-36">
      {/* Interactive Photo Carousel */}
      <div className="relative w-full aspect-[4/3] max-h-[460px] bg-surface-container-high overflow-hidden select-none">
        <div
          className="flex w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {images.map((imgSrc, index) => (
            <div key={index} className="w-full h-full shrink-0 relative">
              <img
                src={imgSrc}
                alt={`${poi.name} foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
            </div>
          ))}
        </div>

        {/* Floating Top Utility Badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-xs text-primary font-label-md text-xs font-semibold pointer-events-auto">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Destaque Editorial
          </span>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              aria-label="Partilhar"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface hover:text-primary flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">share</span>
            </button>
            <button
              aria-label="Guardar nos Favoritos"
              onClick={() => toggleFavorite(poi.id)}
              className={`w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center shadow-md active:scale-95 transition-transform ${
                isFav ? 'text-secondary' : 'text-outline hover:text-secondary'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isFav ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {isFav ? 'favorite' : 'favorite_border'}
              </span>
            </button>
          </div>
        </div>

        {/* Pager Indicator & Navigation Dots */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-white font-label-sm text-xs tracking-wider">
            <span>{currentSlide + 1}</span>
            <span>/</span>
            <span>{images.length}</span>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            {images.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Foto ${idx + 1}`}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentSlide
                    ? 'w-4 bg-surface-container-lowest'
                    : 'w-2 bg-surface-container-lowest/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content Stream */}
      <div className="px-4 max-w-3xl mx-auto w-full flex flex-col gap-5 pt-4">
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-primary-container font-label-md text-xs tracking-wide uppercase font-bold">
              <span className="material-symbols-outlined text-[15px]">{poi.categoryIcon || 'rocket_launch'}</span>
              {poi.categoryLabel}
            </span>
            <div className="flex items-center gap-1 text-tertiary">
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span className="font-label-lg text-sm text-on-surface font-bold">{poi.rating.toFixed(1)}</span>
              <span className="text-on-surface-variant font-body-sm text-xs">({poi.reviewCount} famílias)</span>
            </div>
          </div>

          <h2 className="font-headline-md text-2xl text-on-surface font-bold tracking-tight">
            {poi.name}
          </h2>
          <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
            {poi.fullDescription}
          </p>
        </div>

        {/* Garantia de Dados +JUNTOS Editorial Box */}
        <div className="rounded-2xl bg-primary-fixed/30 dark:bg-primary-fixed-dim/20 p-4 border border-primary/20 shadow-xs flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-label-lg text-sm text-primary font-bold">Garantia de Dados +JUNTOS</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest font-label-sm text-[10px] text-primary-container font-bold shadow-2xs">
                  Atualizado
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-snug">
                ✓ Dados verificados editorialmente há {poi.verifiedAgoDays} dias (Fonte: {poi.verifiedSource}). Preço, horários e infraestrutura presencialmente confirmados pela nossa curadoria.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={onOpenReportModal}
              className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-secondary font-label-md text-xs py-1 px-2.5 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <span>Reportar erro ou alteração</span>
              <span className="text-[13px]">⚠️</span>
            </button>
          </div>
        </div>

        {/* Resumo de Decisão Imediata (Grelha 2x2) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base text-on-surface font-bold">Resumo de Decisão</h3>
            <span className="text-on-surface-variant font-label-sm text-xs">Filtros prioritários</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Item 1: Distância */}
            <div className="bg-surface-container-lowest rounded-2xl p-3.5 border border-surface-container-high shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-full bg-primary-fixed/40 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">directions_car</span>
                </span>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                  GPS Ativo
                </span>
              </div>
              <div>
                <span className="font-label-sm text-[10px] text-on-surface-variant block uppercase tracking-wider font-semibold">Acesso</span>
                <p className="font-headline-sm text-lg text-on-surface font-bold leading-tight mt-0.5">
                  {poi.distanceMinutes} min
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  {poi.distanceKm} km do centro histórico
                </p>
              </div>
            </div>

            {/* Item 2: Idades */}
            <div className="bg-surface-container-lowest rounded-2xl p-3.5 border border-surface-container-high shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">family_restroom</span>
                </span>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-secondary-fixed-dim/40 text-secondary font-bold">
                  Ideal 5-8
                </span>
              </div>
              <div>
                <span className="font-label-sm text-[10px] text-on-surface-variant block uppercase tracking-wider font-semibold">Faixa Etária</span>
                <p className="font-headline-sm text-lg text-on-surface font-bold leading-tight mt-0.5">
                  {poi.minAge} aos {poi.maxAge} anos
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Sessões de 35 min adaptadas
                </p>
              </div>
            </div>

            {/* Item 3: Preço */}
            <div className="bg-surface-container-lowest rounded-2xl p-3.5 border border-surface-container-high shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </span>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-tertiary-fixed-dim/30 text-tertiary font-bold">
                  &lt; 3 grátis
                </span>
              </div>
              <div>
                <span className="font-label-sm text-[10px] text-on-surface-variant block uppercase tracking-wider font-semibold">Bilheteira</span>
                <p className="font-headline-sm text-lg text-on-surface font-bold leading-tight mt-0.5">
                  {poi.isFree ? 'Gratuito' : `${poi.priceChild.toFixed(2)} €`}
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Criança (Adulto {poi.priceAdult.toFixed(2)} €)
                </p>
              </div>
            </div>

            {/* Item 4: Horário Hoje */}
            <div className="bg-surface-container-lowest rounded-2xl p-3.5 border border-surface-container-high shadow-xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-full bg-primary-fixed/40 text-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                </span>
                <span className="inline-flex items-center gap-1 font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                  Aberto
                </span>
              </div>
              <div>
                <span className="font-label-sm text-[10px] text-on-surface-variant block uppercase tracking-wider font-semibold">Hoje</span>
                <p className="font-headline-sm text-lg text-on-surface font-bold leading-tight mt-0.5">
                  10:00 – 18:30
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Última entrada às 17:45
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Comodidades Familiares Verificadas */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base text-on-surface font-bold">Comodidades Familiares</h3>
            <span className="font-label-sm text-xs text-primary font-bold">
              {poi.amenities.length} de {poi.amenities.length} validadas
            </span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col gap-3">
            {poi.amenities.map((amenity) => (
              <div key={amenity.id} className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{amenity.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-sm text-on-surface font-semibold">{amenity.label}</p>
                  <p className="font-body-sm text-xs text-on-surface-variant">{amenity.description}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dicas e Destaques para Pais */}
        <div className="flex flex-col gap-2">
          <h3 className="font-headline-sm text-base text-on-surface font-bold">Destaques da Experiência</h3>
          <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container-high flex flex-col gap-3">
            {poi.experienceHighlights.map((highlight) => (
              <div key={highlight.number} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0 font-label-md text-xs font-bold">
                  {highlight.number}
                </span>
                <div>
                  <h4 className="font-label-lg text-sm text-on-surface font-bold">{highlight.title}</h4>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {highlight.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Localização & Mapa */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base text-on-surface font-bold">Localização & Chegada</h3>
            <span className="font-label-md text-xs text-primary font-semibold">{poi.city}</span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-surface-container-high shadow-xs flex flex-col">
            <div
              className="w-full h-44 bg-cover bg-center relative"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDTSdoFecr0G_AFi_ehaex1pDPjMLzsg6_kPQhha8BxJAeAfQN22RbT3DnBydmRsU8KfU4_qt278kXoxWfMGSYp7ip9n2h0OvacMtI51P923pqtlBo68STo0K1kQgkaF74FLzVBadEd-PFaJuYt-NsUudlDmOAae-96Gl_rx3LixZllB6FJkhsAtuhTlCI3wD1_mTWPU9bo_zcl-29_CXfCWQEoBCHkS_BqCBv-fMDXlRmZ4R4iWduUzg')",
              }}
            >
              <div className="absolute inset-0 bg-primary/10" />
              <div className="absolute bottom-3 left-3 bg-surface-container-lowest/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                <span className="material-symbols-outlined text-secondary-container text-[18px]">pin_drop</span>
                <span className="font-label-md text-xs font-semibold text-on-surface">Campus de Gualtar</span>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-1">
              <p className="font-label-lg text-sm text-on-surface font-bold">{poi.address}</p>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Ao lado do Complexo Pedagógico da Universidade do Minho. Entrada com sinalética visível a partir da rotunda principal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container-high shadow-[0_-8px_24px_rgba(20,122,130,0.12)] p-4 pb-safe">
        <div className="max-w-md mx-auto flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <a
              className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              href={`https://maps.google.com/?q=${encodeURIComponent(poi.address + ' ' + poi.city)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="material-symbols-outlined text-[18px]">turn_sharp_right</span>
              Como Chegar
            </a>
            <a
              className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
              href={`tel:${poi.phone}`}
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              Ligar / Contacto
            </a>
          </div>

          <button
            onClick={handleAddPlanClick}
            className={`w-full h-12 rounded-xl text-on-primary font-label-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all ${
              addedToPlan ? 'bg-emerald-600' : 'bg-secondary-container hover:opacity-95'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {addedToPlan ? 'check_circle' : 'add_circle'}
            </span>
            <span>{addedToPlan ? 'Adicionado ao Roteiro de Família!' : '+ Adicionar ao Plano Familiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
