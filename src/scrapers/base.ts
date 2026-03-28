export interface ScrapedListing {
  vin: string | null;
  source: string;
  source_url: string | null;
  source_listing_id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  fuel_type: string | null;
  mileage: number;
  asking_price: number;
  title_status: string;
  seller_type: string;
  seller_name: string | null;
  seller_phone: string | null;
  seller_location: string | null;
  photos: string | null;        // JSON array of URLs
  description: string | null;
  scrape_confidence: number; // 0.0 to 1.0 — how confident the scraper is in the data
  scrape_tier?: string;      // 'platform' | 'structured_data' | 'api_discovery' | 'ai_extraction'
}

export interface ScraperResult {
  success: boolean;
  listings: ScrapedListing[];
  errors: string[];
  duration_ms: number;
}

export abstract class BaseScraper {
  abstract name: string;
  abstract scrape(options?: unknown): Promise<ScraperResult>;
}
