/**
 * Calculate a 0-1 data completeness score for a listing.
 *
 * Required fields are weighted at full value; optional fields at half value.
 */
export function calculateDataCompleteness(
  listing: Record<string, unknown>,
): number {
  const required = [
    'year',
    'make',
    'model',
    'mileage',
    'asking_price',
    'title_status',
  ] as const;

  const optional = [
    'vin',
    'seller_phone',
    'photos',
    'engine',
    'transmission',
    'exterior_color',
    'description',
    'seller_name',
    'body_style',
    'drivetrain',
  ] as const;

  const isFilled = (val: unknown): boolean =>
    val != null && val !== '' && val !== 0;

  const requiredFilled = required.filter((f) => isFilled(listing[f])).length;
  const optionalFilled = optional.filter((f) => isFilled(listing[f])).length;

  const maxScore = required.length + optional.length * 0.5;
  const actualScore = requiredFilled + optionalFilled * 0.5;

  return maxScore > 0 ? actualScore / maxScore : 0;
}
