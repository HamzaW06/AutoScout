import type { Listing } from '../api';

// Extended listing fields for enrichment (may not be present on all listings)
interface EnrichedListing extends Listing {
  vin_decoded?: number | null;
  recall_count?: number | null;
  complaint_count?: number | null;
  safety_rating_overall?: number | null;
}

type StatusState = 'done' | 'partial' | 'missing';

interface StatusItem {
  label: string;
  state: StatusState;
  detail?: string;
}

function getStatusItems(listing: EnrichedListing): StatusItem[] {
  const items: StatusItem[] = [];

  if (listing.vin_decoded) {
    items.push({ label: 'VIN Decoded', state: 'done' });
  } else if (listing.vin) {
    items.push({ label: 'VIN Decoded', state: 'partial' });
  } else {
    items.push({ label: 'VIN Decoded', state: 'missing' });
  }

  if (listing.market_value != null && listing.market_value > 0) {
    items.push({ label: 'Market Value', state: 'done', detail: '$' + listing.market_value.toLocaleString('en-US') });
  } else {
    items.push({ label: 'Market Value', state: 'missing' });
  }

  if (listing.recall_count != null) {
    items.push({
      label: 'Recalls Checked',
      state: 'done',
      detail: `${listing.recall_count} open recall${listing.recall_count !== 1 ? 's' : ''}`,
    });
  } else {
    items.push({ label: 'Recalls Checked', state: 'missing' });
  }

  if (listing.complaint_count != null) {
    items.push({
      label: 'Complaints Checked',
      state: 'done',
      detail: `${listing.complaint_count} complaint${listing.complaint_count !== 1 ? 's' : ''}`,
    });
  } else {
    items.push({ label: 'Complaints Checked', state: 'missing' });
  }

  if (listing.safety_rating_overall != null) {
    items.push({ label: 'Safety Rating', state: 'done', detail: `${listing.safety_rating_overall}/5 stars` });
  } else {
    items.push({ label: 'Safety Rating', state: 'missing' });
  }

  if (listing.risk_score != null) {
    items.push({ label: 'Risk Assessment', state: 'done', detail: `Score: ${listing.risk_score}/100` });
  } else {
    items.push({ label: 'Risk Assessment', state: 'missing' });
  }

  if (listing.repair_forecast) {
    items.push({ label: 'Repair Forecast', state: 'done' });
  } else {
    items.push({ label: 'Repair Forecast', state: 'missing' });
  }

  return items;
}

function StatusIcon({ state }: { state: StatusState }) {
  if (state === 'done') {
    return <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '14px' }}>✓</span>;
  }
  if (state === 'partial') {
    return <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '14px' }}>~</span>;
  }
  return <span style={{ color: '#6b7280', fontWeight: 'bold', fontSize: '14px' }}>✕</span>;
}

export function EnrichmentStatus({ listing, onReAnalyze }: { listing: Listing; onReAnalyze?: () => void }) {
  const items = getStatusItems(listing as EnrichedListing);

  return (
    <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Enrichment Status
        </div>
        {onReAnalyze && (
          <button
            onClick={onReAnalyze}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--gold, #f59e0b)';
              e.currentTarget.style.borderColor = 'var(--gold, #f59e0b)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = '#374151';
            }}
          >
            Re-analyze
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusIcon state={item.state} />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.label}</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.detail ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EnrichmentStatus;
