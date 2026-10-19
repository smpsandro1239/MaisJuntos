import { parseCoordsFromLink } from '../src/utils/geoLink';

const cases: Array<{ name: string; input: string; expect: { lat: number; lng: number } | null }> = [
  {
    name: 'Google Maps @lat,lng',
    input: 'https://maps.google.com/@41.55,-8.42,15z',
    expect: { lat: 41.55, lng: -8.42 },
  },
  {
    name: 'Google Maps ?q=',
    input: 'https://www.google.com/maps?q=41.5518,-8.4229',
    expect: { lat: 41.5518, lng: -8.4229 },
  },
  {
    name: 'Google Maps !3d!4d',
    input: 'https://www.google.com/maps/place/x/data=!3d41.55!4d-8.42',
    expect: { lat: 41.55, lng: -8.42 },
  },
  {
    name: 'OpenStreetMap #map=z/lat/lng',
    input: 'https://www.openstreetmap.org/#map=15/41.5518/-8.4229',
    expect: { lat: 41.5518, lng: -8.4229 },
  },
  {
    name: 'OpenStreetMap inteiros',
    input: 'https://www.openstreetmap.org/#map=15/41/-8',
    expect: { lat: 41, lng: -8 },
  },
  {
    name: 'Par simples lat,lng',
    input: '41.55, -8.42',
    expect: { lat: 41.55, lng: -8.42 },
  },
  {
    name: 'Texto sem coordenadas',
    input: 'texto qualquer sem numeros',
    expect: null,
  },
  {
    name: 'Coordenadas fora de intervalo',
    input: '99.9, 200.1',
    expect: null,
  },
];

let failures = 0;
console.log('==========================================================');
console.log('🧭 TESTES DE parseCoordsFromLink — +JUNTOS');
console.log('==========================================================\n');

for (const c of cases) {
  const got = parseCoordsFromLink(c.input);
  const ok = JSON.stringify(got) === JSON.stringify(c.expect);
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${JSON.stringify(got)}`);
}

console.log('\n==========================================================');
console.log(`📊 RESUMO: ${cases.length - failures}/${cases.length} aprovados`);
console.log('==========================================================');
if (failures) process.exit(1);
