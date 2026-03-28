interface ConfidenceBadgeProps {
  confidence: number;
  tier?: string;
}

export default function ConfidenceBadge({ confidence, tier }: ConfidenceBadgeProps) {
  if (confidence >= 0.8) return null;

  const bgColor = confidence >= 0.6 ? '#f59e0b' : '#ef4444';
  const label = confidence >= 0.6 ? 'Unverified' : 'Low Confidence';
  const tierLabel =
    tier === 'ai_extraction'
      ? 'AI-extracted'
      : tier === 'structured_data'
        ? 'Structured data'
        : '';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: `${bgColor}22`,
        color: bgColor,
        border: `1px solid ${bgColor}44`,
      }}
      title={`Scrape confidence: ${Math.round(confidence * 100)}%. ${tierLabel ? `Source: ${tierLabel}.` : ''} Price and mileage may need verification.`}
    >
      {label}
    </span>
  );
}
