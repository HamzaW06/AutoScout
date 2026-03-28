import { useState } from 'react';
import { importDealers } from '../api';

interface ImportResult {
  name: string;
  url: string;
  status: 'OK' | 'FAILED';
  platform?: string;
  listings_found?: number;
  priority?: string;
  tier_used?: string;
  error?: string;
}

interface RawImportResult {
  name?: string;
  dealerName?: string;
  url?: string;
  websiteUrl?: string;
  status?: string;
  success?: boolean;
  platform?: string | null;
  listings_found?: number;
  listingsFound?: number;
  priority?: string;
  suggestedPriority?: string;
  tier_used?: string;
  tierUsed?: string;
  error?: string;
  errors?: string[];
  persistError?: string | null;
}

function normalizeImportResult(raw: RawImportResult): ImportResult {
  const statusValue = typeof raw.status === 'string' ? raw.status.toUpperCase() : undefined;
  const statusFromSuccess = raw.success != null ? (raw.success ? 'OK' : 'FAILED') : undefined;
  const status: 'OK' | 'FAILED' =
    statusValue === 'OK' || statusValue === 'FAILED'
      ? statusValue
      : (statusFromSuccess ?? 'FAILED');

  const errors = [
    raw.error,
    ...(Array.isArray(raw.errors) ? raw.errors : []),
    raw.persistError ?? undefined,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  return {
    name: raw.name ?? raw.dealerName ?? 'Unknown dealer',
    url: raw.url ?? raw.websiteUrl ?? 'Unknown URL',
    status,
    platform: raw.platform ?? undefined,
    listings_found: raw.listings_found ?? raw.listingsFound,
    priority: raw.priority ?? raw.suggestedPriority,
    tier_used: raw.tier_used ?? raw.tierUsed,
    error: errors.length > 0 ? errors.join(' | ') : undefined,
  };
}

function normalizeImportResponse(data: unknown): ImportResult[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const maybeResults = (data as { results?: unknown }).results;
  const rows = Array.isArray(maybeResults) ? maybeResults : [data];
  return rows
    .filter((row): row is RawImportResult => !!row && typeof row === 'object')
    .map(normalizeImportResult);
}

const S = {
  container: {
    padding: '24px',
    color: '#fff',
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,
  heading: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '4px',
    color: '#fff',
  } as React.CSSProperties,
  subheading: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '24px',
  } as React.CSSProperties,
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #374151',
    paddingBottom: '0',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : '#9ca3af',
    marginBottom: '-1px',
  }),
  card: {
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#d1d5db',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#fff',
    outline: 'none',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'monospace',
    minHeight: '140px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
  } as React.CSSProperties,
  btn: (variant: 'primary' | 'secondary'): React.CSSProperties => ({
    padding: '9px 20px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: variant === 'primary' ? '#3b82f6' : '#374151',
    color: '#fff',
  }),
  errorBox: {
    background: '#ef444422',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#ef4444',
    marginBottom: '16px',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #374151',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #1f2937',
    color: '#d1d5db',
    verticalAlign: 'middle' as const,
  },
  badge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 600,
    background: ok ? '#10b98122' : '#ef444422',
    color: ok ? '#10b981' : '#ef4444',
    border: `1px solid ${ok ? '#10b98144' : '#ef444444'}`,
  }),
};

export function DealerOnboarding() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single mode fields
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');

  // Bulk mode
  const [bulkText, setBulkText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  async function handleSingle() {
    if (!url.trim() || !name.trim()) {
      setError('URL and Name are required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await importDealers([{ url: url.trim(), name: name.trim(), city: city.trim() || undefined }]);
      setResults(normalizeImportResponse(data));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulk() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      setError('Enter at least one dealer line.');
      return;
    }
    const dealers = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { url: parts[0] || '', name: parts[1] || parts[0] || '', city: parts[2] || undefined };
    });
    setError(null);
    setLoading(true);
    try {
      const data = await importDealers(dealers);
      setResults(normalizeImportResponse(data));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.container}>
      <h1 style={S.heading}>Dealer Onboarding</h1>
      <p style={S.subheading}>Add individual dealers or bulk-import a list to start scraping inventory.</p>

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={S.tab(mode === 'single')} onClick={() => setMode('single')}>Single Dealer</button>
        <button style={S.tab(mode === 'bulk')} onClick={() => setMode('bulk')}>Bulk Import</button>
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {mode === 'single' ? (
        <div style={S.card}>
          <div style={S.row}>
            <div>
              <label style={S.label}>Dealer URL *</label>
              <input
                style={S.input}
                placeholder="https://dealer.com/inventory"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>Dealer Name *</label>
              <input
                style={S.input}
                placeholder="ABC Motors"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>City</label>
              <input
                style={S.input}
                placeholder="Boston"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
          </div>
          <button
            style={S.btn('primary')}
            onClick={handleSingle}
            disabled={loading}
          >
            {loading ? 'Adding…' : 'Add & Test Scrape'}
          </button>
        </div>
      ) : (
        <div style={S.card}>
          <label style={S.label}>Dealers (one per line — URL, Name, City)</label>
          <textarea
            style={{ ...S.textarea, marginBottom: '16px' }}
            placeholder={'https://dealer1.com/inventory, Dealer One, Boston\nhttps://dealer2.com/cars, Dealer Two, Cambridge'}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />
          <button
            style={S.btn('primary')}
            onClick={handleBulk}
            disabled={loading}
          >
            {loading ? 'Importing…' : 'Import All'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ ...S.card, padding: '0' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Dealer</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Platform</th>
                <th style={S.th}>Listings Found</th>
                <th style={S.th}>Priority</th>
                <th style={S.th}>Tier Used</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{r.url}</div>
                  </td>
                  <td style={S.td}>
                    <span style={S.badge(r.status === 'OK')}>{r.status}</span>
                    {r.error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{r.error}</div>}
                  </td>
                  <td style={S.td}>{r.platform ?? '—'}</td>
                  <td style={S.td}>{r.listings_found != null ? r.listings_found : '—'}</td>
                  <td style={S.td}>{r.priority ?? '—'}</td>
                  <td style={S.td}>{r.tier_used ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DealerOnboarding;
