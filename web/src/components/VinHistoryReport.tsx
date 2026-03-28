import { useState } from 'react';
import { fetchVinHistory } from '../api';

interface VinHistoryReportProps {
  listingId: string;
  vin: string;
  hasExistingReport?: boolean;
}

interface HistoryReport {
  vin: string;
  fetchedAt: string;
  source: string;
  titleRecords: Array<{
    date: string; state: string; title_type: string; odometer: number; odometer_status: string;
  }>;
  accidentCount: number;
  damageRecords: Array<{ date: string; description: string; severity: string; source: string }>;
  ownerCount: number;
  ownershipRecords: Array<{ startDate: string; endDate: string; state: string; type: string }>;
  odometerRecords: Array<{ date: string; reading: number; status: string }>;
  rollbackSuspected: boolean;
  salvageRecord: boolean;
  junkRecord: boolean;
  totalLoss: boolean;
  theftReported: boolean;
  floodDamage: boolean;
  lemonLaw: boolean;
}

export default function VinHistoryReport({ listingId, vin, hasExistingReport }: VinHistoryReportProps) {
  const [report, setReport] = useState<HistoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);

  const loadReport = async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchVinHistory(listingId, forceRefresh);
      setReport(result.report);
      setCached(result.cached);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <div style={{ padding: '16px', borderRadius: '8px', background: '#1f2937', border: '1px solid #374151', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>VIN History Report</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              {vin ? `VIN: ${vin}` : 'No VIN available'}
            </p>
          </div>
          <button
            onClick={() => loadReport(false)}
            disabled={loading || !vin || vin.length !== 17}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: !vin || vin.length !== 17 ? '#374151' : '#7c3aed',
              color: '#fff', fontWeight: 600, cursor: vin && vin.length === 17 ? 'pointer' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            {loading ? 'Fetching...' : hasExistingReport ? 'View Report' : 'Get Full History (~$0.25)'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '8px', padding: '8px', borderRadius: '4px', background: '#7f1d1d22', color: '#fca5a5', fontSize: '12px' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Determine overall health
  const redFlags = [
    report.salvageRecord && 'Salvage Title',
    report.totalLoss && 'Total Loss',
    report.theftReported && 'Theft Reported',
    report.floodDamage && 'Flood Damage',
    report.lemonLaw && 'Lemon Law Buyback',
    report.junkRecord && 'Junk Record',
    report.rollbackSuspected && 'Odometer Rollback Suspected',
    report.accidentCount > 0 && `${report.accidentCount} Accident(s)`,
  ].filter(Boolean) as string[];

  const isClean = redFlags.length === 0;

  return (
    <div style={{ borderRadius: '8px', background: '#1f2937', border: '1px solid #374151', marginBottom: '16px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        background: isClean ? '#065f4622' : '#7f1d1d22',
        borderBottom: `2px solid ${isClean ? '#10b981' : '#ef4444'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: isClean ? '#10b981' : '#ef4444' }}>
              {isClean ? 'Clean History' : `${redFlags.length} Issue(s) Found`}
            </h3>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              VIN: {report.vin} | Source: {report.source} | {cached ? 'Cached' : 'Fresh'} | {new Date(report.fetchedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => loadReport(true)}
            disabled={loading}
            style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid #374151',
              background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '11px',
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Red Flags Banner */}
        {redFlags.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px',
          }}>
            {redFlags.map((flag, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                background: '#ef444422', color: '#fca5a5', border: '1px solid #ef444444',
              }}>
                {flag}
              </span>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#111827', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{report.ownerCount}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Owner(s)</div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#111827', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: report.accidentCount > 0 ? '#f59e0b' : '#10b981' }}>{report.accidentCount}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Accident(s)</div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#111827', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{report.titleRecords.length}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Title Records</div>
          </div>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#111827', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{report.odometerRecords.length}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Odometer Readings</div>
          </div>
        </div>

        {/* Title History */}
        {report.titleRecords.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title History</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151' }}>
                  <th style={{ textAlign: 'left', padding: '6px', color: '#6b7280' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px', color: '#6b7280' }}>State</th>
                  <th style={{ textAlign: 'left', padding: '6px', color: '#6b7280' }}>Title Type</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#6b7280' }}>Odometer</th>
                </tr>
              </thead>
              <tbody>
                {report.titleRecords.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '6px', color: '#d1d5db' }}>{t.date || '—'}</td>
                    <td style={{ padding: '6px', color: '#d1d5db' }}>{t.state || '—'}</td>
                    <td style={{ padding: '6px' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: t.title_type === 'clean' ? '#065f4622' : '#7f1d1d22',
                        color: t.title_type === 'clean' ? '#10b981' : '#ef4444',
                      }}>
                        {t.title_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#d1d5db' }}>
                      {t.odometer > 0 ? t.odometer.toLocaleString() + ' mi' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Odometer History */}
        {report.odometerRecords.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Odometer History
              {report.rollbackSuspected && (
                <span style={{ marginLeft: '8px', color: '#ef4444', fontSize: '11px' }}>ROLLBACK SUSPECTED</span>
              )}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {report.odometerRecords.map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #111827', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>{o.date || '—'}</span>
                  <span style={{
                    color: o.status === 'actual' ? '#d1d5db' : '#ef4444',
                    fontWeight: o.status !== 'actual' ? 600 : 400,
                  }}>
                    {o.reading.toLocaleString()} mi {o.status !== 'actual' ? `(${o.status})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Damage/Accident Records */}
        {report.damageRecords.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accident/Damage Records</h4>
            {report.damageRecords.map((d, i) => (
              <div key={i} style={{ padding: '8px', borderRadius: '6px', background: '#111827', marginBottom: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{d.severity || 'Unknown severity'}</span>
                  <span style={{ color: '#6b7280' }}>{d.date || '—'}</span>
                </div>
                <p style={{ color: '#d1d5db', margin: 0 }}>{d.description || 'No details available'}</p>
                {d.source && <p style={{ color: '#6b7280', fontSize: '11px', margin: '4px 0 0' }}>Source: {d.source}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Ownership History */}
        {report.ownershipRecords.length > 0 && (
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ownership History</h4>
            {report.ownershipRecords.map((o, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #111827', fontSize: '13px' }}>
                <span style={{ color: '#d1d5db' }}>Owner {i + 1} ({o.type})</span>
                <span style={{ color: '#9ca3af' }}>
                  {o.state && `${o.state} | `}
                  {o.startDate || '?'} — {o.endDate || 'Present'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
