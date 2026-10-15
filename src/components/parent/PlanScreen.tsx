import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';
import { POI } from '../../types';

interface PlanScreenProps {
  onSelectPoiById?: (poiId: string) => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({ onSelectPoiById }) => {
  const { familyPlan, togglePlanB, changeCity } = useRealtime();
  const { user } = useAuth();

  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [calendarSaved, setCalendarSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const cities = ['Braga', 'Porto', 'Guimarães'];

  // Real Calendar Event generation (.ICS file download)
  const handleCalendarSync = () => {
    try {
      const now = new Date();
      // Format Saturday event in Portugal
      const eventStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      eventStart.setHours(10, 0, 0, 0);
      const eventEnd = new Date(eventStart.getTime() + 6 * 60 * 60 * 1000);

      const pad = (n: number) => (n < 10 ? '0' + n : n);
      const formatIcsDate = (d: Date) =>
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00Z`;

      const activitiesSummary = familyPlan.activities
        .map((a) => `${a.time} - ${a.title} (${a.costLabel})`)
        .join('\\n');

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//MaisJuntos Portugal//Family Planner//PT',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `SUMMARY:Dia em Família +JUNTOS (${familyPlan.city})`,
        `DESCRIPTION:${familyPlan.title}\\n${familyPlan.subtitle}\\n\\nRoteiro:\\n${activitiesSummary}\\n\\nDica: ${familyPlan.parentTip}`,
        `LOCATION:${familyPlan.city}, Portugal`,
        `DTSTART:${formatIcsDate(eventStart)}`,
        `DTEND:${formatIcsDate(eventEnd)}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `dia-em-familia-${familyPlan.city.toLowerCase()}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCalendarSaved(true);
      setTimeout(() => setCalendarSaved(false), 3000);
    } catch (err) {
      console.warn('Error generating calendar file:', err);
    }
  };

  const handleCopyLink = () => {
    const itineraryText = `✨ Roteiro em Família +JUNTOS (${familyPlan.city}):\n${familyPlan.title}\n\n` +
      familyPlan.activities.map((a) => `⏰ ${a.time} - ${a.title} (${a.costLabel})`).join('\n') +
      `\n\n💰 Orçamento: ${familyPlan.budgetCalculated.toFixed(2)}€\n🚗 Condução: ${familyPlan.drivingMinutesTotal} min\n💡 ${familyPlan.parentTip}`;

    navigator.clipboard.writeText(itineraryText).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleShareWhatsapp = () => {
    const activitiesLines = familyPlan.activities
      .map((a) => `*${a.time}* - ${a.title} (${a.costLabel})`)
      .join('%0A');

    const text = encodeURIComponent(
      `🎉 *Roteiro de Sábado em Família (${familyPlan.city}) - +JUNTOS*%0A%0A` +
      `📌 _${familyPlan.title}_%0A%0A` +
      activitiesLines +
      `%0A%0A💰 *Custo Total:* ${familyPlan.budgetCalculated.toFixed(2)}€%0A` +
      `🚗 *Tempo de carro:* ${familyPlan.drivingMinutesTotal} min%0A` +
      `💡 *Dica:* ${familyPlan.parentTip}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleRegenerate = async () => {
    setIsRotating(true);
    try {
      await changeCity(familyPlan.city);
    } finally {
      setTimeout(() => setIsRotating(false), 600);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 pt-2 px-4 max-w-3xl mx-auto">
      {/* Header Intro */}
      <header className="flex flex-col gap-2 mb-4">
        <div className="inline-flex items-center gap-1.5 bg-primary-fixed/50 dark:bg-primary-fixed-dim/30 self-start px-3 py-1 rounded-full">
          <span className="material-symbols-outlined text-primary text-[16px]">auto_fix_high</span>
          <span className="font-label-sm text-[11px] text-on-primary-fixed-variant uppercase tracking-wider font-bold">
            Assistente Inteligente
          </span>
        </div>
        <h1 className="font-headline-xl-mobile text-2xl sm:text-3xl font-bold text-on-surface leading-tight">
          Cria o teu dia perfeito em família em 3 passos
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant">
          Itinerário completo adaptado à idade dos teus filhos, meteorologia e orçamento.
        </p>
      </header>

      {/* Wizard Compact Bar / Interactive Criteria Controls */}
      <section className="bg-surface-container-low rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-xs text-on-surface-variant flex items-center gap-1 font-semibold">
            <span className="material-symbols-outlined text-[16px] text-primary">tune</span> Critérios do Roteiro
          </span>
          <button
            onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
            className="font-label-md text-xs text-primary font-bold hover:underline"
          >
            Ajustar
          </button>
        </div>

        {/* Quick Selector Pills Grid */}
        <div className="flex flex-wrap gap-2">
          {/* City Selector */}
          <div className="relative">
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="inline-flex items-center gap-1.5 bg-surface-container-lowest text-on-surface px-3 py-1.5 rounded-full shadow-xs text-xs font-semibold border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-primary text-[16px]">location_on</span>
              <span>{familyPlan.city}</span>
              <span className="material-symbols-outlined text-outline text-[14px]">arrow_drop_down</span>
            </button>

            {cityDropdownOpen && (
              <div className="absolute left-0 mt-1 w-36 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high z-20 py-1">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      changeCity(city);
                      setCityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container ${
                      familyPlan.city === city ? 'text-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* When + Meteo */}
          <span className="inline-flex items-center gap-1.5 bg-surface-container-lowest text-on-surface px-3 py-1.5 rounded-full shadow-xs text-xs font-semibold border border-surface-container-high">
            <span className="material-symbols-outlined text-tertiary-container text-[16px]">cloud</span>
            <span>{familyPlan.dateLabel}</span>
          </span>

          {/* Budget */}
          <span className="inline-flex items-center gap-1.5 bg-surface-container-lowest text-on-surface px-3 py-1.5 rounded-full shadow-xs text-xs font-semibold border border-surface-container-high">
            <span className="material-symbols-outlined text-primary text-[16px]">payments</span>
            <span>Até {familyPlan.budgetMax.toFixed(0)} €</span>
          </span>

          {/* Rain Preference */}
          <span className="inline-flex items-center gap-1.5 bg-surface-container-highest text-on-surface-variant px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="material-symbols-outlined text-secondary-container text-[16px]">umbrella</span>
            <span>Interior (Abrigo)</span>
          </span>
        </div>

        {/* Children Profile Badges */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-container-high">
          <span className="font-label-sm text-[11px] text-outline uppercase tracking-wider font-semibold">Crianças:</span>
          {familyPlan.children.map((child, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-surface-container-lowest px-2.5 py-0.5 rounded-full shadow-xs text-xs text-primary font-semibold border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[14px]">
                {i === 0 ? 'face_3' : 'face_6'}
              </span>
              {child.name} ({child.age} anos)
            </span>
          ))}
        </div>
      </section>

      {/* Itinerary Card Section */}
      <section className="mt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-label-sm text-[10px] text-secondary uppercase font-bold tracking-wider">
              Sugerido para Ti
            </span>
            <h2 className="font-headline-sm text-lg text-on-surface font-bold leading-tight">
              Sábado Cultural e Quentinho
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-full text-xs text-primary font-bold">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Otimizado
          </span>
        </div>

        {/* Main Vertical Timeline Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high shadow-sm relative overflow-hidden">
          {/* Continuous Timeline Bar */}
          <div className="absolute left-7 top-10 bottom-10 w-0.5 bg-surface-container-high z-0" />

          <div className="flex flex-col gap-5 relative z-10">
            {/* Activity 1: Manhã */}
            <div className="flex gap-3.5 items-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[18px]">palette</span>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-xs text-primary font-bold">10:30 • Manhã</span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full font-label-sm text-[10px]">
                    1h 45m
                  </span>
                </div>
                <h3
                  onClick={() => onSelectPoiById && onSelectPoiById('poi-biscainhos')}
                  className="font-headline-sm text-sm text-on-surface font-bold cursor-pointer hover:text-primary transition-colors"
                >
                  Museu dos Biscainhos & Oficina Criativa
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Atividade sensorial adaptada aos 4 e 7 anos. Área de jogos e atelier de azulejaria de papel.
                </p>
                <div className="mt-2 rounded-xl overflow-hidden relative shadow-xs">
                  <img
                    className="w-full h-32 object-cover"
                    alt="Museu dos Biscainhos"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPSZs5PwkFW7hlG8iZfvk7KPWWoDda_VKCrZezpR2LytRlVhSClbRaTyoWLWv00b96DNJc2-w4hr8NwnEJlfZNgDS8x1vZZWuLz4SLtsY8cbomGiZgcSumuDvQXSvB9lOClGrWkcY07dd20oqKArZiXvCBg70kovGPet2CIs5IWxCkFaLeCXA7INt5kD_6TBi_VSHRRFfUuh0UQuXhxXScNPAA03XhCRV90adNKGqZtrKY_du4qIgYAQ"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-xs">
                    Espaço Coberto • 8,00 € (Bilhete Familiar)
                  </div>
                </div>
              </div>
            </div>

            {/* Activity 2: Almoço */}
            <div className="flex gap-3.5 items-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-secondary-container text-on-secondary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[18px]">restaurant</span>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-xs text-secondary font-bold">12:45 • Almoço Saudável</span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full font-label-sm text-[10px]">
                    4 min a pé
                  </span>
                </div>
                <h3 className="font-headline-sm text-sm text-on-surface font-bold">Restaurante O Manjar</h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Kid-friendly com 2 cadeirões reservados, espaço amplo para carrinhos e sopa biológica infantil.
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="inline-flex items-center gap-0.5 bg-surface-container text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-semibold">
                    <span className="material-symbols-outlined text-[12px] text-primary">child_care</span> Cadeirões
                  </span>
                  <span className="inline-flex items-center gap-0.5 bg-surface-container text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-semibold">
                    <span className="material-symbols-outlined text-[12px] text-tertiary">nutrition</span> Menu Infantil
                  </span>
                  <span className="inline-flex items-center gap-0.5 bg-surface-container text-on-surface-variant px-2 py-0.5 rounded text-[10px]">
                    ~24,00 € (4 pessoas)
                  </span>
                </div>
              </div>
            </div>

            {/* Activity 3: Tarde (Dynamic according to Plan B toggle) */}
            <div className="flex gap-3.5 items-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[18px]">
                  {familyPlan.isPlanBActive ? 'rocket_launch' : 'icecream'}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-xs text-tertiary font-bold">
                    {familyPlan.isPlanBActive ? '14:30 • Tarde Coberta (Chuva)' : '14:30 • Tarde Doce'}
                  </span>
                  <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full font-label-sm text-[10px]">
                    {familyPlan.isPlanBActive ? '8 min de carro' : '3 min a pé'}
                  </span>
                </div>
                <h3
                  onClick={() => {
                    if (familyPlan.isPlanBActive && onSelectPoiById) {
                      onSelectPoiById('poi-planetario-braga');
                    }
                  }}
                  className={`font-headline-sm text-sm text-on-surface font-bold ${
                    familyPlan.isPlanBActive ? 'cursor-pointer hover:text-primary' : ''
                  }`}
                >
                  {familyPlan.isPlanBActive
                    ? 'Planetário de Braga: Viagem às Constelações'
                    : 'Passeio pelas Arcadas & Gelado Artesanal'}
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  {familyPlan.isPlanBActive
                    ? 'Sessão interativa 360º para famílias, 100% coberto e climatizado com oficina estelar infantil.'
                    : 'Passeio abrigado pelas galerias da Praça da República e paragem na Spirito para mini-cones sem glúten.'}
                </p>
                <div className="mt-1">
                  <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-semibold">
                    Custo: {familyPlan.isPlanBActive ? '8,00 €' : '6,00 €'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rain Weather Alternative Action Banner */}
          <div className="mt-5 bg-surface-container-high rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary-container text-[20px]">water_drop</span>
                <span className="font-label-md text-xs text-on-surface font-semibold">Chuva a aumentar à tarde?</span>
              </div>
              <span className="font-label-sm text-[10px] bg-secondary-container text-on-secondary px-2 py-0.5 rounded-full font-bold">
                Plano B
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Troca o passeio de rua pela sessão imersiva das estrelas em 1 toque.
            </p>
            <button
              onClick={togglePlanB}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl shadow-xs transition-all font-label-md text-xs font-bold ${
                familyPlan.isPlanBActive
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-primary hover:bg-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
              <span>
                {familyPlan.isPlanBActive
                  ? 'Reverter para Passeio & Gelado'
                  : 'Trocar tarde para Planetário de Braga'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Mini Map & Route Insight */}
      <section className="mt-4 bg-surface-container-low rounded-2xl p-4 border border-surface-container-high flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-sm text-on-surface font-bold">Proximidade e Deslocação</h3>
          <span className="material-symbols-outlined text-primary text-[20px]">directions_walk</span>
        </div>
        <div
          className="w-full h-28 bg-cover bg-center rounded-xl shadow-inner relative flex items-end p-2.5 overflow-hidden"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBnI4nwCkUrSyd3uYGRk25UN2fJRZDKxKqCIm1fn7WA6vfqrEYIf8Wh1Eg6nlE9D4uSExIpEy8KKnNwnHSzrifs4xQk01oNP5Y4tLcgkFIUmfXyWizJNMqGu4PQvcHTc7TB8alwmt9FTAgxfCiCZyiOLCSo_6x8ePAn89MAo_wELDZOHzBrPaGZFI5cx7DyWqJevmMpi9uoGeRNYzPPjXWFaT7tx-NWAgmNrtmObpvrk17SsngOCQX1Og')",
          }}
        >
          <div className="bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-xs text-on-surface font-label-sm text-xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[14px]">local_parking</span>
            <span>{familyPlan.parkingInfo}</span>
          </div>
        </div>
      </section>

      {/* Financial & Logistics Summary Section */}
      <section className="mt-4 bg-surface-container-lowest rounded-2xl p-4 border border-surface-container-high shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-xs text-on-surface-variant font-semibold">Sumário Orçamental</span>
          <span className="font-label-sm text-xs text-primary font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span> Dentro da Meta
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="font-headline-lg text-2xl text-primary font-bold">
                {familyPlan.budgetCalculated.toFixed(2)} €
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                / máx {familyPlan.budgetMax.toFixed(2)} €
              </span>
            </div>
            <span className="font-body-sm text-xs text-outline">
              Poupança calculada de {(familyPlan.budgetMax - familyPlan.budgetCalculated).toFixed(2)} €
            </span>
          </div>

          {/* Budget Gauge Ring Graphic */}
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-container-high"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
              />
              <path
                className="text-primary transition-all duration-500 ease-out"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${(familyPlan.budgetCalculated / familyPlan.budgetMax) * 100}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
              />
            </svg>
            <span className="absolute font-label-sm text-[11px] font-bold text-on-surface">
              {Math.round((familyPlan.budgetCalculated / familyPlan.budgetMax) * 100)}%
            </span>
          </div>
        </div>

        <div className="pt-2 bg-surface-container-low rounded-xl p-3 flex items-center justify-between border border-surface-container-high">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">directions_car</span>
            <div className="flex flex-col">
              <span className="font-label-md text-xs text-on-surface font-semibold">
                {familyPlan.drivingMinutesTotal} min de condução total
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                Percurso pedonal entre pontos: máx {familyPlan.walkingMaxMinutes} min
              </span>
            </div>
          </div>
          <span className="bg-surface-container-lowest px-2 py-0.5 rounded text-[10px] text-primary font-bold shadow-2xs">
            Tranquilo
          </span>
        </div>
      </section>

      {/* Action Buttons Stack (WhatsApp, Calendar .ICS, Copy Text) */}
      <section className="mt-5 flex flex-col gap-2.5">
        <button
          onClick={handleShareWhatsapp}
          className="w-full min-h-[48px] bg-secondary-container hover:opacity-95 text-on-secondary py-2 px-4 rounded-xl font-label-lg text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">share</span>
          <span>Partilhar com a Família no WhatsApp</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleCalendarSync}
            className={`w-full min-h-[44px] text-on-primary py-2 px-3 rounded-xl font-headline-sm text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] ${
              calendarSaved ? 'bg-emerald-600' : 'bg-primary hover:bg-primary-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {calendarSaved ? 'check_circle' : 'calendar_month'}
            </span>
            <span>{calendarSaved ? 'Ficheiro .ICS Descarregado!' : 'Guardar no Calendário (.ics)'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className={`w-full min-h-[44px] py-2 px-3 rounded-xl font-label-md text-xs font-bold flex items-center justify-center gap-2 transition-all border border-surface-container-high shadow-2xs ${
              copiedLink
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {copiedLink ? 'done_all' : 'content_copy'}
            </span>
            <span>{copiedLink ? 'Roteiro Copiado!' : 'Copiar Texto do Roteiro'}</span>
          </button>
        </div>

        <button
          onClick={handleRegenerate}
          className="w-full min-h-[42px] bg-surface-container-low hover:bg-surface-container text-primary py-2 px-4 rounded-xl font-label-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-surface-container-high"
        >
          <span
            className={`material-symbols-outlined text-[18px] transition-transform duration-500 ${
              isRotating ? 'rotate-180' : ''
            }`}
          >
            restart_alt
          </span>
          <span>Regenerar com Novas Opções</span>
        </button>
      </section>

      {/* Family Tip Box */}
      <div className="mt-4 p-3 rounded-2xl bg-tertiary-fixed/30 border border-tertiary/20 flex items-center gap-2.5">
        <span className="material-symbols-outlined text-tertiary text-[24px] shrink-0">
          sentiment_very_satisfied
        </span>
        <p className="font-body-sm text-xs text-on-surface">
          <strong className="font-semibold text-tertiary">Dica dos Pais:</strong> {familyPlan.parentTip}
        </p>
      </div>
    </div>
  );
};
