import { useState, useEffect, useCallback } from 'react';
import { fetchScraperHealth, triggerDealerScrape } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';

interface DealerHealthEntry {
  id: number;
  name: string;
  website?: string | null;
  tier?: string | null;
  status: 'healthy' | 'degraded' | 'failing' | 'dead';
  success_rate: number | null;
  listing_count: number | null;
  last_success: string | null;
  scrape_priority?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  failing: '#f97316',
  dead: '#ef4444',
};

function statusDot(status: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: STATUS_COLORS[status] ?? '#9ca3af',
        flexShrink: 0,
      }}
    />
  );
}

function successRateColor(rate: number | null): string {
  if (rate == null) return '#9ca3af';
  if (rate > 80) return '#10b981';
  if (rate > 50) return '#f59e0b';
  return '#ef4444';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function ScraperHealth() {
  const [dealers, setDealers] = useState<DealerHealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [retesting, setRetesting] = useState<Set<number>>(new Set());

  const { connected, on } = useWebSocket();

  const load = useCallback(async () => {
    try {
      const data = await fetchScraperHealth();
      setDealers(Array.isArray(data) ? data : data.dealers ?? []);
    } catch (err) {
      console.error('Failed to load scraper health:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const offHealthChange = on('dealer_health_change', () => load());
    const offScrapeComplete = on('scrape_complete', () => load());
    return () => {
      offHealthChange();
      offScrapeComplete();
    };
  }, [on, load]);

  async function handleRetest(dealerId: number) {
    setRetesting((prev) => new Set(prev).add(dealerId));
    try {
      await triggerDealerScrape(dealerId);
    } catch (err) {
      console.error('Failed to trigger scrape:', err);
    } finally {
      setRetesting((prev) => {
        const next = new Set(prev);
        next.delete(dealerId);
        return next;
      });
    }
  }

  const counts = {
    healthy: dealers.filter((d) => d.status === 'healthy').length,
    degraded: dealers.filter((d) => d.status === 'degraded').length,
    failing: dealers.filter((d) => d.status === 'failing').length,
    dead: dealers.filter((d) => d.status === 'dead').length,
  };

  const deadCount = counts.dead;

  const summaryCards: { label: string; key: keyof typeof counts; color: string }[] = [
    { label: 'Healthy', key: 'healthy', color: '#10b981' },
    { label: 'Degraded', key: 'degraded', color: '#f59e0b' },
    { label: 'Failing', key: 'failing', color: '#f97316' },
    { label: 'Dead', key: 'dead', color: '#ef4444' },
  ];

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Scraper Health
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: '#9ca3af',
            }}
          >
            Real-time status of dealer scrapers.
          </p>
        </div>
        {connected && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '12px',
              color: '#10b981',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            Live
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        {summaryCards.map(({ label, key, color }) => (
          <div
            key={key}
            style={{
              background: '#1f2937',
              border: '1px solid #374151',
              borderLeft: `4px solid ${color}`,
              borderRadius: '6px',
              padding: '16px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#d1d5db',
                marginBottom: '6px',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color,
              }}
            >
              {counts[key]}
            </div>
          </div>
        ))}
      </div>

      {/* Dead alert banner */}
      {deadCount > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{'\u26a0'}</span>
          <span>
            {deadCount} dealer{deadCount !== 1 ? 's' : ''} have been failing for 48+ hours and need attention
          </span>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #374151',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            color: '#9ca3af',
          }}
        >
          Dealer Scrapers
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #374151',
                  textAlign: 'left',
                }}
              >
                {['Status', 'Dealer', 'Tier', 'Success Rate', 'Listings', 'Last Success', 'Priority', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 16px',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#9ca3af',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: '#9ca3af',
                    }}
                  >
                    Loading scraper health...
                  </td>
                </tr>
              ) : dealers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: '#9ca3af',
                    }}
                  >
                    No dealer health data available.
                  </td>
                </tr>
              ) : (
                dealers.map((dealer) => {
                  const rate = dealer.success_rate;
                  const rateColor = successRateColor(rate);
                  const isRetesting = retesting.has(dealer.id);
                  return (
                    <tr
                      key={dealer.id}
                      style={{
                        borderBottom: '1px solid #374151',
                        background: '#1f2937',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background = '#263244')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background = '#1f2937')
                      }
                    >
                      {/* Status dot */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {statusDot(dealer.status)}
                        </div>
                      </td>

                      {/* Dealer */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ color: '#fff', fontWeight: 500 }}>
                          {dealer.name}
                        </div>
                        {dealer.website && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 2 }}>
                            {dealer.website}
                          </div>
                        )}
                      </td>

                      {/* Tier */}
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#d1d5db',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {dealer.tier ?? '—'}
                      </td>

                      {/* Success Rate */}
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            color: rateColor,
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 500,
                          }}
                        >
                          {rate != null ? `${rate}%` : '—'}
                        </span>
                      </td>

                      {/* Listings */}
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#d1d5db',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {dealer.listing_count ?? '—'}
                      </td>

                      {/* Last Success */}
                      <td
                        style={{
                          padding: '10px 16px',
                          color: '#9ca3af',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(dealer.last_success)}
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '10px 16px' }}>
                        {dealer.scrape_priority ? (
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background:
                                dealer.scrape_priority === 'high'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : dealer.scrape_priority === 'medium'
                                    ? 'rgba(245, 158, 11, 0.12)'
                                    : 'rgba(156, 163, 175, 0.1)',
                              color:
                                dealer.scrape_priority === 'high'
                                  ? '#ef4444'
                                  : dealer.scrape_priority === 'medium'
                                    ? '#f59e0b'
                                    : '#9ca3af',
                            }}
                          >
                            {dealer.scrape_priority}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 16px' }}>
                        <button
                          disabled={isRetesting}
                          onClick={() => handleRetest(dealer.id)}
                          style={{
                            fontSize: '11px',
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: '1px solid #374151',
                            background: isRetesting ? 'rgba(55, 65, 81, 0.4)' : '#374151',
                            color: isRetesting ? '#9ca3af' : '#d1d5db',
                            cursor: isRetesting ? 'not-allowed' : 'pointer',
                            transition: 'background 0.15s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (!isRetesting)
                              (e.currentTarget as HTMLButtonElement).style.background = '#4b5563';
                          }}
                          onMouseLeave={(e) => {
                            if (!isRetesting)
                              (e.currentTarget as HTMLButtonElement).style.background = '#374151';
                          }}
                        >
                          {isRetesting ? 'Testing...' : 'Re-test'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
