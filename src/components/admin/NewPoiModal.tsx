import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { POI } from '../../types';

interface NewPoiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewPoiModal: React.FC<NewPoiModalProps> = ({ isOpen, onClose }) => {
  const { createPoi } = useRealtime();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Braga');
  const [categoryLabel, setCategoryLabel] = useState('Parques Urbanos & Jardins');
  const [address, setAddress] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [minAge, setMinAge] = useState(2);
  const [maxAge, setMaxAge] = useState(10);
  const [priceChild, setPriceChild] = useState(0);
  const [spaceType, setSpaceType] = useState<'interior' | 'exterior' | 'mixed'>('exterior');
  const [isFree, setIsFree] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newPoi: Partial<POI> = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: 'parques',
      categoryLabel,
      categoryIcon: spaceType === 'interior' ? 'roofing' : 'park',
      shortDescription: shortDesc || 'Novo espaço familiar adicionado pela curadoria.',
      fullDescription: shortDesc || 'Descrição detalhada em elaboração.',
      rating: 5.0,
      reviewCount: 1,
      images: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBXTUstZT-OH61vbtAOD9Zc8swpVkH0aHnexZezlDX6uj2XTlN8vJuuY3CCX6JtcWbAbkDOHiQfZ-qbKFSGYfnndBTrCJfuPpMcXLkHDvET3tnKxFXrnUEwBj5qon1O-2ay27lBYMwlIHtEXmBdKA1ENR_iSBgC1A5sfrEt7S1eZGx8lM8ky2tsVdbZ2se-yjij9zTqcbokOH_bPa6Mi9FqIIDeonzTSMAhcTQNoKa3PnlBOtL6AiWdrQ',
      ],
      coverImage:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBXTUstZT-OH61vbtAOD9Zc8swpVkH0aHnexZezlDX6uj2XTlN8vJuuY3CCX6JtcWbAbkDOHiQfZ-qbKFSGYfnndBTrCJfuPpMcXLkHDvET3tnKxFXrnUEwBj5qon1O-2ay27lBYMwlIHtEXmBdKA1ENR_iSBgC1A5sfrEt7S1eZGx8lM8ky2tsVdbZ2se-yjij9zTqcbokOH_bPa6Mi9FqIIDeonzTSMAhcTQNoKa3PnlBOtL6AiWdrQ',
      distanceMinutes: 10,
      distanceKm: 4.0,
      city,
      address: address || `${city}, Centro`,
      postalCode: '4700-000',
      latitude: 41.55,
      longitude: -8.42,
      minAge,
      maxAge,
      ageRecommendation: `${minAge} aos ${maxAge} anos`,
      isFree,
      priceChild,
      priceAdult: isFree ? 0 : priceChild + 2,
      priceFamily: isFree ? 0 : priceChild * 2 + 3,
      priceNotes: isFree ? 'Acesso gratuito' : 'Bilhete infantil verificado',
      spaceType,
      isOpenNow: true,
      openingHoursToday: '09:00 - 19:00',
      schedule: [{ day: 'Todos os dias', status: 'open', label: '09:00 - 19:00' }],
      amenities: [
        { id: 'a1', label: 'Acessível com carrinho', description: 'Rampas suaves', icon: 'stroller', verified: true },
        { id: 'a2', label: 'Fraldário', description: 'WC adaptado', icon: 'baby_changing_station', verified: true },
      ],
      experienceHighlights: [
        { number: 1, title: 'Espaço Lúdico Adaptado', description: 'Atividades e segurança para crianças.' },
      ],
      verifiedAgoDays: 0,
      verifiedSource: 'Submissão Curatorial Direta',
      verifiedBy: 'Marta Ferreira',
      dataQualityScore: 90,
      status: 'verified',
      bookingPolicy: 'none',
      phone: '+351 253 000 000',
      phoneTested: true,
      lastPhysicalAudit: new Date().toISOString().split('T')[0],
    };

    await createPoi(newPoi);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">add_location_alt</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold leading-tight">
              Registar Novo POI Manual
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
              Adiciona um novo ponto de interesse com validação editorial
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Nome Oficial *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Jardim de Santa Bárbara"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Concelho</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option>Braga</option>
                <option>Porto</option>
                <option>Guimarães</option>
                <option>Barcelos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Categoria</label>
              <select
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option>Parques Urbanos & Jardins</option>
                <option>Ciência & Espaço</option>
                <option>Museus & História</option>
                <option>Quintas Pedagógicas & Animais</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Morada Completa</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua ou Largo..."
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">Descrição Curta</label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Breve resumo para os pais..."
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Ambiente</label>
              <select
                value={spaceType}
                onChange={(e) => setSpaceType(e.target.value as any)}
                className="w-full h-10 px-2 rounded-xl bg-surface-container-low text-xs border border-surface-container-high"
              >
                <option value="exterior">Ar Livre</option>
                <option value="interior">Interior (Chuva)</option>
                <option value="mixed">Misto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Idade Mín</label>
              <input
                type="number"
                value={minAge}
                onChange={(e) => setMinAge(parseInt(e.target.value) || 0)}
                className="w-full h-10 px-2 rounded-xl bg-surface-container-low text-xs border border-surface-container-high"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Idade Máx</label>
              <input
                type="number"
                value={maxAge}
                onChange={(e) => setMaxAge(parseInt(e.target.value) || 12)}
                className="w-full h-10 px-2 rounded-xl bg-surface-container-low text-xs border border-surface-container-high"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="w-4 h-4 rounded text-primary accent-primary"
              />
              <span>Acesso Gratuito</span>
            </label>

            {!isFree && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-on-surface font-semibold">Preço Criança (€):</span>
                <input
                  type="number"
                  step="0.5"
                  value={priceChild}
                  onChange={(e) => setPriceChild(parseFloat(e.target.value) || 0)}
                  className="w-16 h-8 px-2 rounded-lg bg-surface-container-low text-xs border border-surface-container-high"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold transition-all shadow-xs"
            >
              Criar e Indexar POI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
