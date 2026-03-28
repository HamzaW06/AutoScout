// Texas Title, Tax, and License (TTL) calculator + emissions counties

const EMISSIONS_COUNTIES = [
  'Brazoria', 'Collin', 'Dallas', 'Denton', 'El Paso', 'Ellis',
  'Fort Bend', 'Galveston', 'Harris', 'Johnson', 'Kaufman',
  'Parker', 'Rockwall', 'Tarrant', 'Travis', 'Williamson',
];

export function isEmissionsCounty(county: string): boolean {
  return EMISSIONS_COUNTIES.some(
    (c) => c.toLowerCase() === county.toLowerCase()
  );
}

export interface TTLBreakdown {
  salesTax: number;
  titleFee: number;
  registrationFee: number;
  inspectionFee: number;
  emissionsInspection: number;
  docFee: number;
  totalTTL: number;
  totalOTD: number;
}

export function calculateTexasTTL(
  price: number,
  isPrivate: boolean,
  county: string
): TTLBreakdown {
  const salesTax = price * 0.0625;
  const titleFee = 33;
  const registrationFee = 51.75;
  const inspectionFee = 7.5;
  const emissionsInspection = isEmissionsCounty(county) ? 18.5 : 0;
  const docFee = isPrivate ? 0 : 150;

  const totalTTL =
    salesTax + titleFee + registrationFee + inspectionFee + emissionsInspection + docFee;
  const totalOTD = price + totalTTL;

  return {
    salesTax,
    titleFee,
    registrationFee,
    inspectionFee,
    emissionsInspection,
    docFee,
    totalTTL,
    totalOTD,
  };
}

export function generateBillOfSaleFields(data: {
  buyerName: string;
  sellerName: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  mileage: number;
  price: number;
  date: string;
  county: string;
}): Record<string, string> {
  return {
    buyer_name: data.buyerName,
    seller_name: data.sellerName,
    vin: data.vin,
    year_make_model: `${data.year} ${data.make} ${data.model}`,
    odometer_reading: data.mileage.toLocaleString('en-US'),
    sales_price: data.price.toFixed(2),
    date_of_sale: data.date,
    county: data.county,
  };
}
