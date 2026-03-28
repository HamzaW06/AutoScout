interface DealBadgeProps {
  rating: string | null;
  className?: string;
}

const RATING_STYLES: Record<string, { bg: string; text: string }> = {
  STEAL: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  GREAT: { bg: 'bg-green-500/15', text: 'text-green-400' },
  GOOD: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  FAIR: { bg: 'bg-neutral-500/15', text: 'text-neutral-400' },
  HIGH: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'RIP-OFF': { bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function DealBadge({ rating, className = '' }: DealBadgeProps) {
  if (!rating) return null;

  const style = RATING_STYLES[rating] ?? {
    bg: 'bg-neutral-500/15',
    text: 'text-neutral-400',
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold tracking-wide uppercase rounded ${style.bg} ${style.text} ${className}`}
    >
      {rating}
    </span>
  );
}
