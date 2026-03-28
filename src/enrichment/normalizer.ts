// ── Normalizer ─────────────────────────────────────────────────────
// Pure‑logic helpers that normalise make / model / trim / transmission
// / body‑style / title‑status strings coming from scraped listings.
// -------------------------------------------------------------------

// ── Make aliases (80+ entries) ──────────────────────────────────────
const MAKE_ALIASES: Record<string, string> = {
  // A
  'acura': 'Acura',
  'alfa': 'Alfa Romeo', 'alfa romeo': 'Alfa Romeo', 'alfaromeo': 'Alfa Romeo',
  'am general': 'AM General', 'amgeneral': 'AM General',
  'aston': 'Aston Martin', 'aston martin': 'Aston Martin', 'astonmartin': 'Aston Martin',
  'audi': 'Audi',
  // B
  'bentley': 'Bentley',
  'bmw': 'BMW',
  'bugatti': 'Bugatti',
  'buick': 'Buick',
  // C
  'cadillac': 'Cadillac', 'caddy': 'Cadillac',
  'chevy': 'Chevrolet', 'chevrolet': 'Chevrolet', 'chev': 'Chevrolet',
  'chrysler': 'Chrysler',
  // D
  'daewoo': 'Daewoo',
  'datsun': 'Datsun',
  'dodge': 'Dodge',
  // F
  'ferrari': 'Ferrari',
  'fiat': 'FIAT',
  'fisker': 'Fisker',
  'ford': 'Ford',
  'freightliner': 'Freightliner',
  // G
  'genesis': 'Genesis',
  'geo': 'Geo',
  'gmc': 'GMC',
  // H
  'honda': 'Honda',
  'hummer': 'Hummer',
  'hyundai': 'Hyundai',
  // I
  'infiniti': 'Infiniti', 'infinity': 'Infiniti',
  'international': 'International',
  'isuzu': 'Isuzu',
  // J
  'jaguar': 'Jaguar', 'jag': 'Jaguar',
  'jeep': 'Jeep',
  // K
  'karma': 'Karma',
  'kia': 'Kia',
  // L
  'lamborghini': 'Lamborghini', 'lambo': 'Lamborghini',
  'land rover': 'Land Rover', 'landrover': 'Land Rover', 'lr': 'Land Rover',
  'lexus': 'Lexus',
  'lincoln': 'Lincoln',
  'lotus': 'Lotus',
  'lucid': 'Lucid',
  // M
  'maserati': 'Maserati',
  'maybach': 'Maybach',
  'mazda': 'Mazda',
  'mclaren': 'McLaren', 'mc laren': 'McLaren',
  'merc': 'Mercedes-Benz', 'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz',
  'mercedesbenz': 'Mercedes-Benz', 'mb': 'Mercedes-Benz', 'benz': 'Mercedes-Benz',
  'mercury': 'Mercury',
  'mini': 'MINI', 'mini cooper': 'MINI',
  'mitsubishi': 'Mitsubishi', 'mitsu': 'Mitsubishi',
  // N
  'nissan': 'Nissan',
  // O
  'oldsmobile': 'Oldsmobile', 'olds': 'Oldsmobile',
  // P
  'peugeot': 'Peugeot',
  'plymouth': 'Plymouth',
  'polestar': 'Polestar',
  'pontiac': 'Pontiac', 'ponti': 'Pontiac',
  'porsche': 'Porsche',
  // R
  'ram': 'Ram',
  'rivian': 'Rivian',
  'rolls-royce': 'Rolls-Royce', 'rolls royce': 'Rolls-Royce', 'rollsroyce': 'Rolls-Royce', 'rr': 'Rolls-Royce',
  // S
  'saab': 'Saab',
  'saturn': 'Saturn',
  'scion': 'Scion',
  'smart': 'Smart',
  'subaru': 'Subaru', 'subie': 'Subaru', 'subi': 'Subaru',
  'suzuki': 'Suzuki',
  // T
  'tesla': 'Tesla',
  'toyota': 'Toyota', 'toyo': 'Toyota',
  // V
  'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
  'volvo': 'Volvo',
  // Extra spelling / abbreviation variants
  'chry': 'Chrysler',
  'hond': 'Honda',
  'linc': 'Lincoln',
  'lex': 'Lexus',
  'inf': 'Infiniti',
  'cad': 'Cadillac',
  'pont': 'Pontiac',
};

// ── Known trim keywords (used by extractTrim) ──────────────────────
const TRIM_KEYWORDS = new Set([
  // Generic trim levels
  'Base', 'S', 'SE', 'SEL', 'SV', 'SR', 'SL', 'SLE', 'SLT',
  'LE', 'XLE', 'XSE', 'L', 'EX', 'EX-L', 'LX', 'DX', 'HX',
  'LT', 'LS', 'RS', 'SS', 'ZL1', 'Z71', 'Z06',
  'Limited', 'Platinum', 'Titanium', 'Premium', 'Prestige',
  'Sport', 'Touring', 'Grand Touring', 'GT', 'GTS', 'GTI',
  'R/T', 'RT', 'SRT', 'Hellcat', 'Scat Pack', 'Demon',
  'TRD', 'TRD Pro', 'Trail Boss', 'AT4', 'Denali',
  'Laredo', 'Overland', 'Trailhawk', 'Rubicon', 'Sahara', 'Willys', 'Mojave',
  'Lariat', 'King Ranch', 'XLT', 'STX', 'Raptor', 'Tremor',
  // Luxury / German
  'Luxury', 'Technology', 'Advance', 'A-Spec', 'Type S', 'Type R',
  'F Sport', 'F-Sport', 'FSport',
  'Premium Plus', 'Progressiv', 'Komfort', 'Technik',
  'M Sport', 'M-Sport', 'xDrive', 'sDrive',
  'AMG', '4MATIC', '4Matic', 'Avantgarde', 'Designo',
  'R-Design', 'Inscription', 'Momentum', 'Polestar',
  // EV / Hybrid
  'Hybrid', 'PHEV', 'EV', 'Prime', 'Plug-In',
  'Long Range', 'Standard Range', 'Performance',
  // Packages often treated as trims
  'AWD', 'FWD', 'RWD', '4WD', '4x4', '2WD',
  'Crew Cab', 'Double Cab', 'Regular Cab', 'Quad Cab',
  'SuperCrew', 'SuperCab',
]);

// Build a Set of lowercase trim keywords for fast lookup
const TRIM_KEYWORDS_LOWER = new Set([...TRIM_KEYWORDS].map(t => t.toLowerCase()));

// ── Multi‑word trim phrases (checked first, longest match wins) ────
const MULTI_WORD_TRIMS = [
  'Grand Touring', 'Scat Pack', 'TRD Pro', 'Trail Boss',
  'King Ranch', 'Type S', 'Type R', 'F Sport', 'F-Sport',
  'Premium Plus', 'M Sport', 'M-Sport', 'R-Design',
  'Long Range', 'Standard Range', 'Plug-In',
  'Crew Cab', 'Double Cab', 'Regular Cab', 'Quad Cab',
  'Super Crew', 'SuperCrew', 'SuperCab',
  'EX-L', 'A-Spec',
].sort((a, b) => b.length - a.length);   // longest first

// ── Public API ──────────────────────────────────────────────────────

/**
 * Normalize a car make string to its canonical form.
 * Handles empty strings, whitespace, casing, and common aliases.
 */
export function normalizeMake(make: string): string {
  if (!make || typeof make !== 'string') return '';
  const key = make.trim().toLowerCase().replace(/\s+/g, ' ');
  if (key === '') return '';
  return MAKE_ALIASES[key] ?? titleCase(make.trim());
}

/**
 * Normalize a model string – title‑case, common fixes.
 */
export function normalizeModel(model: string): string {
  if (!model || typeof model !== 'string') return '';
  let m = model.trim();
  if (m === '') return '';

  // Common model name fixes
  const fixes: Record<string, string> = {
    'crv': 'CR-V', 'cr-v': 'CR-V', 'cr v': 'CR-V',
    'hrv': 'HR-V', 'hr-v': 'HR-V', 'hr v': 'HR-V',
    'brv': 'BR-V', 'br-v': 'BR-V',
    'rav4': 'RAV4', 'rav 4': 'RAV4',
    'cx5': 'CX-5', 'cx-5': 'CX-5', 'cx 5': 'CX-5',
    'cx9': 'CX-9', 'cx-9': 'CX-9', 'cx 9': 'CX-9',
    'cx30': 'CX-30', 'cx-30': 'CX-30', 'cx 30': 'CX-30',
    'cx50': 'CX-50', 'cx-50': 'CX-50', 'cx 50': 'CX-50',
    'rx350': 'RX 350', 'rx 350': 'RX 350',
    'es350': 'ES 350', 'es 350': 'ES 350',
    'is350': 'IS 350', 'is 350': 'IS 350',
    'nx300': 'NX 300', 'nx 300': 'NX 300',
    'q50': 'Q50', 'q60': 'Q60', 'q70': 'Q70',
    'qx50': 'QX50', 'qx60': 'QX60', 'qx80': 'QX80',
    'wrx': 'WRX', 'sti': 'STI', 'brz': 'BRZ',
    'gt86': 'GT86', 'gr86': 'GR86',
    'gti': 'GTI', 'gli': 'GLI',
    'tdi': 'TDI',
    'c-class': 'C-Class', 'e-class': 'E-Class', 's-class': 'S-Class',
    'a-class': 'A-Class', 'g-class': 'G-Class',
    'glc': 'GLC', 'gle': 'GLE', 'gls': 'GLS', 'glb': 'GLB', 'gla': 'GLA',
    'x1': 'X1', 'x2': 'X2', 'x3': 'X3', 'x4': 'X4', 'x5': 'X5', 'x6': 'X6', 'x7': 'X7',
    'model 3': 'Model 3', 'model3': 'Model 3',
    'model y': 'Model Y', 'modely': 'Model Y',
    'model s': 'Model S', 'models': 'Model S',
    'model x': 'Model X', 'modelx': 'Model X',
    'f-150': 'F-150', 'f150': 'F-150', 'f 150': 'F-150',
    'f-250': 'F-250', 'f250': 'F-250', 'f 250': 'F-250',
    'f-350': 'F-350', 'f350': 'F-350', 'f 350': 'F-350',
    'ram 1500': 'Ram 1500', '1500': '1500',
    'ram 2500': 'Ram 2500', '2500': '2500',
    'wrangler': 'Wrangler', 'grand cherokee': 'Grand Cherokee',
    '4runner': '4Runner',
  };

  const key = m.toLowerCase().replace(/\s+/g, ' ');
  if (fixes[key]) return fixes[key];

  return titleCase(m);
}

/**
 * Split a full model string (e.g. "Camry LE") into
 * { model: "Camry", trim: "LE" }.
 */
export function extractTrim(fullModelString: string): { model: string; trim: string } {
  if (!fullModelString || typeof fullModelString !== 'string') {
    return { model: '', trim: '' };
  }
  const s = fullModelString.trim().replace(/\s+/g, ' ');
  if (s === '') return { model: '', trim: '' };

  // 1. Try multi‑word trim phrases first (longest match wins)
  for (const phrase of MULTI_WORD_TRIMS) {
    const idx = s.toLowerCase().indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      const modelPart = s.slice(0, idx).trim();
      const trimPart = s.slice(idx).trim();
      return {
        model: modelPart || s,
        trim: modelPart ? trimPart : '',
      };
    }
  }

  // 2. Walk tokens from the end; collect consecutive trim keywords
  const tokens = s.split(/\s+/);
  let splitIdx = tokens.length;
  for (let i = tokens.length - 1; i >= 1; i--) {
    if (TRIM_KEYWORDS_LOWER.has(tokens[i].toLowerCase())) {
      splitIdx = i;
    } else {
      break;
    }
  }

  if (splitIdx < tokens.length) {
    return {
      model: tokens.slice(0, splitIdx).join(' '),
      trim: tokens.slice(splitIdx).join(' '),
    };
  }

  return { model: s, trim: '' };
}

/**
 * Normalize a transmission string to one of: 'auto', 'manual', 'cvt', 'dct', 'unknown'.
 */
export function normalizeTransmission(trans: string): string {
  if (!trans || typeof trans !== 'string') return 'unknown';
  const t = trans.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  if (t === '') return 'unknown';

  if (/\bcvt\b/.test(t) || /continuously variable/.test(t)) return 'cvt';
  if (/\bdct\b|\bdual[ -]?clutch\b|\bpdk\b|\bdsg\b/.test(t)) return 'dct';
  if (/\bmanual\b|\bstick\b|\b(5|6|7)[ -]?speed manual\b|\bmt\b|\bstandard\b|\bstd\b/.test(t)) return 'manual';
  if (/\bauto\b|\bautomatic\b|\bat\b|\btiptronic\b|\bsteptronic\b|\b(4|5|6|7|8|9|10)[ -]?speed\b/.test(t)) return 'auto';

  return 'unknown';
}

/**
 * Normalize a body style to a canonical short label.
 */
export function normalizeBodyStyle(body: string): string {
  if (!body || typeof body !== 'string') return 'unknown';
  const b = body.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  if (b === '') return 'unknown';

  if (/\btruck\b|\bpick ?up\b|\bcrew cab\b|\bdouble cab\b|\bregular cab\b|\bquad cab\b/.test(b)) return 'truck';
  if (/\bsuv\b|\bsport utility\b/.test(b)) return 'suv';
  if (/\bcrossover\b|\bcuv\b/.test(b)) return 'crossover';
  if (/\bsedan\b|\b4[ -]?door\b|\b4dr\b/.test(b)) return 'sedan';
  if (/\bcoupe\b|\bcoupé\b|\b2[ -]?door\b|\b2dr\b/.test(b)) return 'coupe';
  if (/\bconvertible\b|\bcabriolet\b|\broadster\b|\bspyder\b|\bspider\b/.test(b)) return 'convertible';
  if (/\bwagon\b|\bestate\b|\bsport ?wagon\b|\ballroad\b/.test(b)) return 'wagon';
  if (/\bhatchback\b|\bhatch\b|\b5[ -]?door\b|\b5dr\b/.test(b)) return 'hatchback';
  if (/\bminivan\b|\bvan\b|\bmpv\b/.test(b)) return 'van';

  return 'unknown';
}

/**
 * Normalize title / history status.
 */
export function normalizeTitleStatus(status: string): string {
  if (!status || typeof status !== 'string') return 'unknown';
  const s = status.trim().toLowerCase().replace(/[\s\-_]+/g, ' ');
  if (s === '') return 'unknown';

  if (/\bclean\b/.test(s)) return 'clean';
  if (/\bsalvage\b/.test(s)) return 'salvage';
  if (/\brebuilt\b|\breconstructed\b|\brevived\b/.test(s)) return 'rebuilt';
  if (/\bflood\b|\bwater\b/.test(s)) return 'flood';
  if (/\blemon\b|\bbuyback\b|\bbuy back\b|\bmanufacturer buyback\b/.test(s)) return 'lemon';

  return 'unknown';
}

// ── Helpers ─────────────────────────────────────────────────────────

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/(\s+|-)/g)
    .map(word => {
      if (word.match(/^\s+$/) || word === '-') return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}
