import { describe, test, expect } from 'vitest';
import { extractStructuredData } from '../../src/scrapers/tiers/structured-data.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function wrapJsonLd(data: unknown): string {
  return `<html><head>
    <script type="application/ld+json">${JSON.stringify(data)}</script>
  </head><body></body></html>`;
}

const BASE_URL = 'https://example-dealer.com';

// ── Single Vehicle extraction ──────────────────────────────────────────────────

describe('extractStructuredData — single vehicle', () => {
  const singleVehicle = {
    '@type': 'Vehicle',
    vehicleIdentificationNumber: '1HGCM82633A004352',
    name: '2021 Toyota Camry SE',
    brand: { name: 'Toyota' },
    model: 'Camry',
    vehicleModelDate: '2021',
    mileageFromOdometer: { value: 35000, unitCode: 'SMI' },
    offers: { price: 24995, priceCurrency: 'USD' },
    color: 'Midnight Black',
    vehicleInteriorColor: 'Beige',
    bodyType: 'Sedan',
    vehicleEngine: { name: '2.5L I4' },
    vehicleTransmission: 'Automatic',
    driveWheelConfiguration: 'FWD',
    fuelType: 'Gasoline',
    image: ['https://example-dealer.com/photos/camry1.jpg', 'https://example-dealer.com/photos/camry2.jpg'],
    url: '/inventory/camry-se',
    description: 'One owner, clean title.',
  };

  test('returns success=true when a vehicle is found', () => {
    const result = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(result.success).toBe(true);
    expect(result.listings).toHaveLength(1);
  });

  test('maps VIN correctly', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].vin).toBe('1HGCM82633A004352');
  });

  test('maps year correctly', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].year).toBe(2021);
  });

  test('maps make correctly', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].make).toBe('Toyota');
  });

  test('maps model correctly', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].model).toBe('Camry');
  });

  test('maps price from offers object', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].asking_price).toBe(24995);
  });

  test('maps mileage from mileageFromOdometer object', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].mileage).toBe(35000);
  });

  test('maps exterior color', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].exterior_color).toBe('Midnight Black');
  });

  test('maps interior color', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].interior_color).toBe('Beige');
  });

  test('maps body style', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].body_style).toBe('Sedan');
  });

  test('maps engine', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].engine).toBe('2.5L I4');
  });

  test('maps transmission', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].transmission).toBe('Automatic');
  });

  test('maps drivetrain', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].drivetrain).toBe('FWD');
  });

  test('maps fuel type', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].fuel_type).toBe('Gasoline');
  });

  test('maps photos as JSON array', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    const photos = JSON.parse(listings[0].photos ?? '[]');
    expect(photos).toHaveLength(2);
    expect(photos[0]).toBe('https://example-dealer.com/photos/camry1.jpg');
  });

  test('resolves relative listing URL', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].source_url).toBe('https://example-dealer.com/inventory/camry-se');
  });

  test('sets scrape_tier to structured_data', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].scrape_tier).toBe('structured_data');
  });

  test('confidence is 0.9 when all key fields present', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBe(0.9);
  });

  test('extracts trim from name string', () => {
    const { listings } = extractStructuredData(wrapJsonLd(singleVehicle), BASE_URL);
    // "2021 Toyota Camry SE" → trim should contain "SE"
    expect(listings[0].trim).toContain('SE');
  });
});

// ── Brand as string ────────────────────────────────────────────────────────────

describe('extractStructuredData — brand as plain string', () => {
  test('maps brand string to make', () => {
    const vehicle = {
      '@type': 'Car',
      brand: 'Honda',
      model: 'Civic',
      vehicleModelDate: '2020',
      vehicleIdentificationNumber: '2HGFC2F50LH123456',
      mileageFromOdometer: 22000,
      offers: { price: 19500 },
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].make).toBe('Honda');
  });
});

// ── Mileage variants ───────────────────────────────────────────────────────────

describe('extractStructuredData — mileage variants', () => {
  test('handles mileageFromOdometer as plain number', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Ford' },
      model: 'F-150',
      vehicleModelDate: '2019',
      mileageFromOdometer: 55000,
      offers: { price: 31000 },
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].mileage).toBe(55000);
  });

  test('handles mileageFromOdometer as string', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Ford' },
      model: 'F-150',
      vehicleModelDate: '2019',
      mileageFromOdometer: '55,000',
      offers: { price: 31000 },
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].mileage).toBe(55000);
  });
});

// ── Price variants ─────────────────────────────────────────────────────────────

describe('extractStructuredData — price variants', () => {
  test('handles price as string with dollar sign', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Chevrolet' },
      model: 'Silverado',
      vehicleModelDate: '2022',
      mileageFromOdometer: { value: 10000 },
      offers: { price: '$42,500' },
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].asking_price).toBe(42500);
  });

  test('handles offers as array', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'BMW' },
      model: '3 Series',
      vehicleModelDate: '2023',
      mileageFromOdometer: { value: 5000 },
      offers: [{ price: 38000 }, { price: 39000 }],
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].asking_price).toBe(38000);
  });
});

// ── Year extraction from name ──────────────────────────────────────────────────

describe('extractStructuredData — year from name fallback', () => {
  test('extracts year from name when vehicleModelDate missing', () => {
    const vehicle = {
      '@type': 'Vehicle',
      name: '2018 Jeep Wrangler Sport',
      brand: { name: 'Jeep' },
      model: 'Wrangler',
      mileageFromOdometer: { value: 45000 },
      offers: { price: 28000 },
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].year).toBe(2018);
  });
});

// ── Confidence scoring ─────────────────────────────────────────────────────────

describe('extractStructuredData — confidence scoring', () => {
  test('subtracts 0.05 for missing VIN', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Nissan' },
      model: 'Altima',
      vehicleModelDate: '2020',
      mileageFromOdometer: { value: 30000 },
      offers: { price: 20000 },
      // no VIN
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBeCloseTo(0.85, 5);
  });

  test('subtracts 0.1 for missing price', () => {
    const vehicle = {
      '@type': 'Vehicle',
      vehicleIdentificationNumber: '1N4AL3AP6JC123456',
      brand: { name: 'Nissan' },
      model: 'Altima',
      vehicleModelDate: '2020',
      mileageFromOdometer: { value: 30000 },
      // no offers
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBeCloseTo(0.8, 5);
  });

  test('subtracts 0.05 for missing mileage', () => {
    const vehicle = {
      '@type': 'Vehicle',
      vehicleIdentificationNumber: '1N4AL3AP6JC123456',
      brand: { name: 'Nissan' },
      model: 'Altima',
      vehicleModelDate: '2020',
      offers: { price: 20000 },
      // no mileage
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBeCloseTo(0.85, 5);
  });

  test('subtracts 0.1 for missing year', () => {
    const vehicle = {
      '@type': 'Vehicle',
      vehicleIdentificationNumber: '1N4AL3AP6JC123456',
      brand: { name: 'Nissan' },
      model: 'Altima',
      mileageFromOdometer: { value: 30000 },
      offers: { price: 20000 },
      // no vehicleModelDate or name with year
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBeCloseTo(0.8, 5);
  });

  test('floors confidence at 0.5 when many fields are missing', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Unknown' },
      model: 'Unknown',
      // no VIN, no price, no mileage, no year
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    expect(listings[0].scrape_confidence).toBeGreaterThanOrEqual(0.5);
  });
});

// ── Multiple vehicles from JSON-LD array ────────────────────────────────────────

describe('extractStructuredData — multiple vehicles', () => {
  const multiVehicles = [
    {
      '@type': 'Vehicle',
      vehicleIdentificationNumber: 'VIN001',
      brand: { name: 'Toyota' },
      model: 'Corolla',
      vehicleModelDate: '2020',
      mileageFromOdometer: { value: 40000 },
      offers: { price: 18000 },
    },
    {
      '@type': 'Car',
      vehicleIdentificationNumber: 'VIN002',
      brand: { name: 'Honda' },
      model: 'Accord',
      vehicleModelDate: '2021',
      mileageFromOdometer: { value: 25000 },
      offers: { price: 22000 },
    },
    {
      '@type': 'Automobile',
      vehicleIdentificationNumber: 'VIN003',
      brand: { name: 'Ford' },
      model: 'Explorer',
      vehicleModelDate: '2019',
      mileageFromOdometer: { value: 60000 },
      offers: { price: 28000 },
    },
  ];

  test('extracts all vehicles from a JSON-LD array', () => {
    const { listings } = extractStructuredData(wrapJsonLd(multiVehicles), BASE_URL);
    expect(listings).toHaveLength(3);
  });

  test('all listings have success=true', () => {
    const result = extractStructuredData(wrapJsonLd(multiVehicles), BASE_URL);
    expect(result.success).toBe(true);
  });

  test('each listing has correct VIN', () => {
    const { listings } = extractStructuredData(wrapJsonLd(multiVehicles), BASE_URL);
    expect(listings[0].vin).toBe('VIN001');
    expect(listings[1].vin).toBe('VIN002');
    expect(listings[2].vin).toBe('VIN003');
  });

  test('each listing has correct make', () => {
    const { listings } = extractStructuredData(wrapJsonLd(multiVehicles), BASE_URL);
    expect(listings[0].make).toBe('Toyota');
    expect(listings[1].make).toBe('Honda');
    expect(listings[2].make).toBe('Ford');
  });

  test('accepts Car and Automobile @type values', () => {
    const { listings } = extractStructuredData(wrapJsonLd(multiVehicles), BASE_URL);
    const types = listings.map((l) => l.scrape_tier);
    expect(types).toEqual(['structured_data', 'structured_data', 'structured_data']);
  });
});

// ── @graph container ────────────────────────────────────────────────────────────

describe('extractStructuredData — @graph container', () => {
  test('unwraps @graph and extracts vehicles', () => {
    const graphData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'AutoDealer',
          name: 'Best Cars Dealership',
        },
        {
          '@type': 'Vehicle',
          vehicleIdentificationNumber: 'GRAPH123',
          brand: { name: 'Subaru' },
          model: 'Outback',
          vehicleModelDate: '2022',
          mileageFromOdometer: { value: 15000 },
          offers: { price: 30000 },
        },
      ],
    };
    const { listings } = extractStructuredData(wrapJsonLd(graphData), BASE_URL);
    expect(listings).toHaveLength(1);
    expect(listings[0].vin).toBe('GRAPH123');
    expect(listings[0].make).toBe('Subaru');
  });
});

// ── Multiple JSON-LD blocks ──────────────────────────────────────────────────────

describe('extractStructuredData — multiple script blocks', () => {
  test('aggregates vehicles from separate JSON-LD blocks', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Vehicle',
        vehicleIdentificationNumber: 'BLOCK1',
        brand: { name: 'Mazda' },
        model: 'CX-5',
        vehicleModelDate: '2021',
        mileageFromOdometer: { value: 20000 },
        offers: { price: 27000 },
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Vehicle',
        vehicleIdentificationNumber: 'BLOCK2',
        brand: { name: 'Mazda' },
        model: 'CX-9',
        vehicleModelDate: '2022',
        mileageFromOdometer: { value: 10000 },
        offers: { price: 38000 },
      })}</script>
    </head><body></body></html>`;
    const { listings } = extractStructuredData(html, BASE_URL);
    expect(listings).toHaveLength(2);
  });
});

// ── No structured data ─────────────────────────────────────────────────────────

describe('extractStructuredData — no structured data', () => {
  test('returns success=false for empty HTML', () => {
    const result = extractStructuredData('<html><body><p>No cars here.</p></body></html>', BASE_URL);
    expect(result.success).toBe(false);
    expect(result.listings).toHaveLength(0);
  });

  test('returns empty listings for JSON-LD with no vehicle types', () => {
    const nonVehicle = {
      '@type': 'Organization',
      name: 'Best Cars Inc.',
      url: 'https://bestcars.com',
    };
    const result = extractStructuredData(wrapJsonLd(nonVehicle), BASE_URL);
    expect(result.success).toBe(false);
    expect(result.listings).toHaveLength(0);
  });

  test('returns empty listings for malformed JSON-LD', () => {
    const html = `<html><head>
      <script type="application/ld+json">{ this is not valid json }</script>
    </head><body></body></html>`;
    const result = extractStructuredData(html, BASE_URL);
    expect(result.success).toBe(false);
    expect(result.listings).toHaveLength(0);
  });

  test('returns errors=[] for empty HTML (no thrown errors)', () => {
    const result = extractStructuredData('<html><body></body></html>', BASE_URL);
    expect(result.errors).toHaveLength(0);
  });

  test('always includes duration_ms', () => {
    const result = extractStructuredData('<html></html>', BASE_URL);
    expect(typeof result.duration_ms).toBe('number');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ── Relative photo URL resolution ──────────────────────────────────────────────

describe('extractStructuredData — relative URL resolution', () => {
  test('resolves relative photo URLs', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Kia' },
      model: 'Sorento',
      vehicleModelDate: '2021',
      mileageFromOdometer: { value: 18000 },
      offers: { price: 29000 },
      image: ['/photos/sorento1.jpg', '/photos/sorento2.jpg'],
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), 'https://kia-dealer.com');
    const photos = JSON.parse(listings[0].photos ?? '[]');
    expect(photos[0]).toBe('https://kia-dealer.com/photos/sorento1.jpg');
    expect(photos[1]).toBe('https://kia-dealer.com/photos/sorento2.jpg');
  });

  test('keeps absolute photo URLs unchanged', () => {
    const vehicle = {
      '@type': 'Vehicle',
      brand: { name: 'Kia' },
      model: 'Sorento',
      vehicleModelDate: '2021',
      mileageFromOdometer: { value: 18000 },
      offers: { price: 29000 },
      image: 'https://cdn.photos.com/sorento.jpg',
    };
    const { listings } = extractStructuredData(wrapJsonLd(vehicle), BASE_URL);
    const photos = JSON.parse(listings[0].photos ?? '[]');
    expect(photos[0]).toBe('https://cdn.photos.com/sorento.jpg');
  });
});
