// Turf facilities (icon tiles) + a turf-pitch placeholder picture used when no photo has been added yet.
const I = (d) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const FACILITIES = {
  parking: I('<circle cx="12" cy="12" r="8.5"/><path d="M10 16V8h3a2.2 2.2 0 0 1 0 4.4h-3"/>'),
  floodlights: I('<path d="M9 17h6M10 20h4M8 13a4 4 0 1 1 8 0c0 1.5-1 2.2-1 4H9c0-1.8-1-2.5-1-4z"/><path d="M12 3v2M4.5 6l1.4 1.4M19.5 6l-1.4 1.4"/>'),
  grass: I('<path d="M4 20c1-6 1-9 0-14M9 20c1-5 2-8 1-12M14 20c0-5 1-7 3-11M19 20c-1-4-1-6 0-9"/>'),
  net: I('<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>'),
  washroom: I('<circle cx="8" cy="5" r="1.6"/><circle cx="16" cy="5" r="1.6"/><path d="M5.5 21v-8l-1.5-3h8l-1.5 3v8M14 21v-5h-1.5l1.5-6h4l1.5 6H18v5"/>'),
  water: I('<path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>'),
  changing: I('<path d="M5 20V7l7-4 7 4v13M9 20v-6h6v6"/>'),
  seating: I('<path d="M5 12V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v6M3 12h18v4H3zM6 16v4M18 16v4"/>'),
  cafe: I('<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 5h-2M8 3v2M12 3v2"/>'),
  firstaid: I('<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M12 9.5v6M9 12.5h6M9 6V4.5h6V6"/>'),
  cctv: I('<path d="M3 8l13-3 2 5-13 3zM16 8l4 1M9 14l-1 5M6 19h6"/>'),
  scoreboard: I('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 9v4M12 9v4M16 9v4M8 21h8M12 17v4"/>'),
  equipment: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 8l3.6 2.6-1.4 4.2H9.8L8.4 10.6zM12 3.5V8M20.2 9.6l-4.6 1M3.8 9.6l4.6 1M17.3 19l-3-4.2M6.7 19l3-4.2"/>'),
  wifi: I('<path d="M3 9a14 14 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1"/>'),
  coaching: I('<circle cx="12" cy="7" r="3.2"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>')
};
export const FKEYS = Object.keys(FACILITIES);
export const SPORT_ICON = I('<circle cx="12" cy="12" r="8.5"/><path d="M12 8l3.6 2.6-1.4 4.2H9.8L8.4 10.6z"/>');
// Illustrated pitch (no photo yet). seed varies the shade a little so cards do not look identical.
export function pitchSvg(seed = 0) {
  const h = [92, 78, 104, 86][seed % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},48%,38%)"/><stop offset="1" stop-color="hsl(${h + 14},52%,26%)"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><g opacity=".13" fill="#fff">${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 80}" y="0" width="40" height="400"/>`).join('')}</g><g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="3"><rect x="50" y="45" width="540" height="310" rx="8"/><path d="M320 45v310"/><circle cx="320" cy="200" r="52"/><rect x="50" y="130" width="78" height="140"/><rect x="512" y="130" width="78" height="140"/></g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
// Resize a picked photo to a small JPEG so it is cheap to keep on the phone.
export async function shrinkPhoto(file, max = 900) {
  const img = await createImageBitmap(file), k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.78);
}
