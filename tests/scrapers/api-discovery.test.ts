import { describe, it, expect } from 'vitest';
import { parseApiResponse } from '../../src/scrapers/tiers/api-discovery.js';

const BASE_URL = 'https://www.example-dealer.com';

// Helper: build a minimal vehicle object with the required fields
function makeVehicle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vin: '1HGCM82633A123456',
    year: 2020,
    make: 'Honda',
    model: 'Accord',
    price: 22500,
    mileage: 35000,
    ...overrides,
  };
}

describe('parseApiResponse', () => {
  describe('flat array of vehicle objects', () => {
    it('parses a direct array of vehicle objects', () => {
      const data = [makeVehicle(), makeVehicle({ vin: '2T1BURHE0JC034187', make: 'Toyota', model: 'Corolla' })];
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(2);
      expect(result[0].vin).toBe('1HGCM82633A123456');
      expect(result[0].make).toBe('Honda');
      expect(result[0].model).toBe('Accord');
      expect(result[0].year).toBe(2020);
      expect(result[0].asking_price).toBe(22500);
      expect(result[0].mileage).toBe(35000);
      expect(result[0].scrape_tier).toBe('api_discovery');
    });

    it('sets scrape_confidence to 0.92 when vin and price are present', () => {
      const data = [makeVehicle()];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].scrape_confidence).toBe(0.92);
    });

    it('reduces confidence by 0.05 when vin is missing', () => {
      const vehicle = makeVehicle();
      delete vehicle['vin'];
      // Still needs 2+ indicator fields — mileage, year, make, model, price are present
      const data = [vehicle];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].vin).toBeNull();
      expect(result[0].scrape_confidence).toBeCloseTo(0.87);
    });

    it('reduces confidence by 0.05 when price is missing', () => {
      const vehicle = makeVehicle();
      delete vehicle['price'];
      const data = [vehicle];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].asking_price).toBe(0);
      expect(result[0].scrape_confidence).toBeCloseTo(0.87);
    });

    it('reduces confidence by 0.10 when both vin and price are missing', () => {
      const vehicle = makeVehicle();
      delete vehicle['vin'];
      delete vehicle['price'];
      const data = [vehicle];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].scrape_confidence).toBeCloseTo(0.82);
    });

    it('supports alias field names for price (internetPrice)', () => {
      const data = [makeVehicle({ internetPrice: 19999, price: undefined })];
      delete (data[0] as Record<string, unknown>)['price'];
      data[0]['internetPrice'] = 19999;
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].asking_price).toBe(19999);
    });

    it('supports alias field names for mileage (odometer)', () => {
      const data = [{ vin: '1HGCM82633A123456', year: 2019, make: 'Ford', model: 'F-150', price: 30000, odometer: 48000 }];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].mileage).toBe(48000);
    });
  });

  describe('nested {inventory: [...]} response', () => {
    it('parses inventory wrapped in an inventory key', () => {
      const data = {
        inventory: [makeVehicle(), makeVehicle({ vin: '3VWFE21C04M000001', make: 'Volkswagen', model: 'Jetta' })],
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(2);
      expect(result[0].make).toBe('Honda');
      expect(result[1].make).toBe('Volkswagen');
    });

    it('parses inventory wrapped in a vehicles key', () => {
      const data = {
        vehicles: [makeVehicle()],
        total: 1,
        page: 1,
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(1);
    });

    it('parses inventory wrapped in a listings key', () => {
      const data = {
        listings: [makeVehicle(), makeVehicle({ make: 'Chevrolet', model: 'Malibu' })],
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(2);
    });
  });

  describe('nested {data: {vehicles: [...]}} response', () => {
    it('parses double-nested data.vehicles structure', () => {
      const data = {
        status: 'ok',
        data: {
          vehicles: [makeVehicle(), makeVehicle({ make: 'BMW', model: '3 Series' })],
        },
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(2);
      expect(result[1].make).toBe('BMW');
    });

    it('parses data.inventory structure', () => {
      const data = {
        data: {
          inventory: [makeVehicle()],
          meta: { total: 1 },
        },
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(1);
    });

    it('parses deeply nested pageProps.vehicles (Next.js pattern)', () => {
      const data = {
        pageProps: {
          vehicles: [makeVehicle(), makeVehicle({ make: 'Nissan', model: 'Altima' })],
        },
        __N_SSP: true,
      };
      const result = parseApiResponse(data, BASE_URL);
      expect(result).toHaveLength(2);
      expect(result[1].make).toBe('Nissan');
    });
  });

  describe('returns empty for non-vehicle data', () => {
    it('returns empty array for null input', () => {
      expect(parseApiResponse(null, BASE_URL)).toEqual([]);
    });

    it('returns empty array for empty object', () => {
      expect(parseApiResponse({}, BASE_URL)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(parseApiResponse([], BASE_URL)).toEqual([]);
    });

    it('returns empty array for a plain string', () => {
      expect(parseApiResponse('hello world', BASE_URL)).toEqual([]);
    });

    it('returns empty array when array has non-vehicle objects', () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', city: 'Austin' },
      ];
      expect(parseApiResponse(data, BASE_URL)).toEqual([]);
    });

    it('returns empty array for deeply nested non-vehicle data', () => {
      const data = {
        results: [
          { post_id: 1, title: 'Hello World', content: 'lorem ipsum' },
        ],
      };
      expect(parseApiResponse(data, BASE_URL)).toEqual([]);
    });
  });

  describe('photo URL resolution', () => {
    it('resolves relative photo URLs against baseUrl', () => {
      const data = [
        makeVehicle({
          photos: ['/images/car1.jpg', '/images/car2.jpg'],
        }),
      ];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].photos).toBe(
        JSON.stringify([
          'https://www.example-dealer.com/images/car1.jpg',
          'https://www.example-dealer.com/images/car2.jpg',
        ]),
      );
    });

    it('keeps absolute photo URLs unchanged', () => {
      const data = [
        makeVehicle({
          images: ['https://cdn.dealer.com/photo1.jpg'],
        }),
      ];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].photos).toBe(JSON.stringify(['https://cdn.dealer.com/photo1.jpg']));
    });

    it('sets photos to null when no photo fields exist', () => {
      const data = [makeVehicle()];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].photos).toBeNull();
    });
  });

  describe('field mapping', () => {
    it('maps VIN alias vehicleIdentificationNumber', () => {
      const data = [{ vehicleIdentificationNumber: 'WAUKEAFM8CA012345', year: 2012, make: 'Audi', model: 'A4', price: 18000, mileage: 60000 }];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].vin).toBe('WAUKEAFM8CA012345');
    });

    it('maps year alias modelYear', () => {
      const data = [{ vin: 'TEST12345', modelYear: 2021, make: 'Toyota', model: 'Camry', price: 25000, miles: 12000 }];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].year).toBe(2021);
    });

    it('maps make alias brand', () => {
      const data = [{ vin: 'TEST12345', year: 2020, brand: 'Hyundai', model: 'Elantra', price: 16000, mileage: 22000 }];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].make).toBe('Hyundai');
    });

    it('maps price alias salePrice', () => {
      const data = [{ vin: 'TEST12345', year: 2019, make: 'Kia', model: 'Optima', salePrice: 14999, mileage: 45000 }];
      const result = parseApiResponse(data, BASE_URL);
      expect(result[0].asking_price).toBe(14999);
    });
  });
});
