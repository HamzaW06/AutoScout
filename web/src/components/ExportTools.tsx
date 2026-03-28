import { useState } from 'react';
import { exportListings } from '../api';

export function ExportTools() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await exportListings(format);
      if (format === 'csv') {
        setSuccess('CSV download started.');
      } else {
        setSuccess('JSON export complete.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '40px auto',
        padding: '24px',
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: '16px',
        }}
      >
        Export Listings
      </div>

      {/* Format toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['csv', 'json'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              padding: '6px 18px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: format === f ? '600' : '400',
              background: format === f ? 'var(--gold, #f59e0b)' : 'transparent',
              color: format === f ? '#111' : 'var(--text-secondary)',
              border: format === f ? '1px solid var(--gold, #f59e0b)' : '1px solid #374151',
              transition: 'all 0.15s',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#374151' : '#2563eb',
          color: loading ? 'var(--text-muted)' : '#fff',
          border: 'none',
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'Exporting…' : `Export as ${format.toUpperCase()}`}
      </button>

      {/* Status messages */}
      {error && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--red, #ef4444)',
            padding: '8px',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: '#22c55e',
            padding: '8px',
            background: 'rgba(34,197,94,0.08)',
            borderRadius: '4px',
          }}
        >
          {success}
        </div>
      )}
    </div>
  );
}
