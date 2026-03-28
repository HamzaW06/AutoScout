import { useState, useEffect } from 'react';
import { fetchAuditStats, fetchDealers, type AuditStats, type Dealer } from '../api';

function StatCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div
      className="p-4 rounded border"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="text-xs uppercase tracking-wider mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="mono text-2xl font-bold"
          style={{ color: color ?? 'var(--text-primary)' }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function formatAgo(dateStr: string | null): string {
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

function successRateColor(rate: number | null): string {
  if (rate == null) return 'var(--text-muted)';
  if (rate >= 90) return 'var(--green)';
  if (rate >= 70) return '#f0c040';
  return 'var(--red)';
}

export function AuditDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [auditRes, dealerRes] = await Promise.all([
          fetchAuditStats(),
          fetchDealers(),
        ]);
        setStats(auditRes);
        setDealers(dealerRes);
      } catch (err) {
        console.error('Failed to load audit data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
        Loading audit data...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
        Failed to load audit data.
      </div>
    );
  }

  const activeDealers = dealers.filter((d) => d.is_active);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold m-0" style={{ color: 'var(--text-primary)' }}>
          Data Quality &amp; Audit
        </h1>
        <p className="text-sm mt-1 m-0" style={{ color: 'var(--text-muted)' }}>
          Monitoring data integrity, scraper health, and listing quality.
        </p>
      </div>

      {/* Health overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Active Listings"
          value={stats.activeListings.toLocaleString()}
        />
        <StatCard
          label="Avg Completeness"
          value={stats.avgCompleteness}
          suffix="%"
          color={stats.avgCompleteness >= 80 ? 'var(--green)' : 'var(--gold)'}
        />
        <StatCard
          label="VINs Verified"
          value={stats.vinsVerified}
          suffix="%"
          color={stats.vinsVerified >= 70 ? 'var(--green)' : 'var(--gold)'}
        />
        <StatCard
          label="Multi-Source Verified"
          value={stats.multiSourceVerified}
          suffix="%"
          color={stats.multiSourceVerified >= 50 ? 'var(--green)' : 'var(--gold)'}
        />
      </div>

      {/* Critical issues */}
      <div
        className="p-4 rounded border"
        style={{
          borderColor: stats.criticalIssues > 0 ? 'rgba(232, 84, 84, 0.4)' : 'var(--border)',
          background: stats.criticalIssues > 0 ? 'rgba(232, 84, 84, 0.05)' : 'var(--bg-surface)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--red)' }}>
              Critical Issues
            </span>
            <span
              className="mono text-xs px-1.5 py-0.5 rounded"
              style={{
                background: stats.criticalIssues > 0 ? 'rgba(232, 84, 84, 0.15)' : 'var(--bg-elevated)',
                color: stats.criticalIssues > 0 ? 'var(--red)' : 'var(--text-muted)',
              }}
            >
              {stats.criticalIssues}
            </span>
          </div>
        </div>
        {stats.criticalIssues > 0 ? (
          <ul className="space-y-1.5 m-0 p-0 list-none">
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--red)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              VIN mismatches detected - cross-reference failures between sources
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--red)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Suspected scam listings flagged for manual review
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--red)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Title discrepancies found in recent data
            </li>
          </ul>
        ) : (
          <p className="text-sm m-0" style={{ color: 'var(--text-muted)' }}>
            No critical issues detected.
          </p>
        )}
      </div>

      {/* Warnings */}
      <div
        className="p-4 rounded border"
        style={{
          borderColor: stats.warnings > 0 ? 'rgba(240, 192, 64, 0.3)' : 'var(--border)',
          background: stats.warnings > 0 ? 'rgba(240, 192, 64, 0.03)' : 'var(--bg-surface)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--gold)' }}>
              Warnings
            </span>
            <span
              className="mono text-xs px-1.5 py-0.5 rounded"
              style={{
                background: stats.warnings > 0 ? 'rgba(240, 192, 64, 0.12)' : 'var(--bg-elevated)',
                color: stats.warnings > 0 ? 'var(--gold)' : 'var(--text-muted)',
              }}
            >
              {stats.warnings}
            </span>
          </div>
        </div>
        {stats.warnings > 0 ? (
          <ul className="space-y-1.5 m-0 p-0 list-none">
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gold)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Listings missing VIN numbers
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gold)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Listings with no photos attached
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gold)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Price anomalies detected (deviation from market average)
            </li>
            <li className="flex items-start gap-2 text-sm" style={{ color: 'var(--gold)' }}>
              <span className="mt-0.5 flex-shrink-0">{'\u26a0'}</span>
              Open recalls flagged
            </li>
          </ul>
        ) : (
          <p className="text-sm m-0" style={{ color: 'var(--text-muted)' }}>
            No warnings at this time.
          </p>
        )}
      </div>

      {/* Scraper health table */}
      <div
        className="rounded border"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
            Scraper Health
          </span>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wider border-b"
                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
              >
                <th className="px-4 py-2">Dealer</th>
                <th className="px-4 py-2">Last Scrape</th>
                <th className="px-4 py-2">Success Rate</th>
                <th className="px-4 py-2">Listings</th>
                <th className="px-4 py-2 hide-mobile">Priority</th>
              </tr>
            </thead>
            <tbody>
              {activeDealers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    No active dealers found.
                  </td>
                </tr>
              ) : (
                activeDealers.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>
                      {d.name}
                    </td>
                    <td className="px-4 py-2 mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatAgo(d.last_scraped)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-12 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--border)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(d.scrape_success_rate ?? 0, 100)}%`,
                              background: successRateColor(d.scrape_success_rate),
                            }}
                          />
                        </div>
                        <span
                          className="mono text-xs"
                          style={{ color: successRateColor(d.scrape_success_rate) }}
                        >
                          {d.scrape_success_rate != null
                            ? `${d.scrape_success_rate}%`
                            : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {d.typical_inventory_size ?? '—'}
                    </td>
                    <td className="px-4 py-2 hide-mobile">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            d.scrape_priority === 'high'
                              ? 'rgba(232, 84, 84, 0.15)'
                              : d.scrape_priority === 'medium'
                                ? 'rgba(240, 192, 64, 0.12)'
                                : 'var(--bg-elevated)',
                          color:
                            d.scrape_priority === 'high'
                              ? 'var(--red)'
                              : d.scrape_priority === 'medium'
                                ? 'var(--gold)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {d.scrape_priority ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent audit sweep */}
      <div
        className="p-4 rounded border"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="text-xs uppercase tracking-wider font-semibold mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Recent Audit Sweep
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last Sweep
            </div>
            <div className="mono" style={{ color: 'var(--text-primary)' }}>
              {stats.lastSweep
                ? new Date(stats.lastSweep).toLocaleString()
                : 'Never'}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Listings Checked
            </div>
            <div className="mono" style={{ color: 'var(--text-primary)' }}>
              {stats.activeListings.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Issues Found
            </div>
            <div className="mono" style={{ color: stats.criticalIssues + stats.warnings > 0 ? 'var(--red)' : 'var(--green)' }}>
              {stats.criticalIssues + stats.warnings}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Stale Removed
            </div>
            <div className="mono" style={{ color: 'var(--text-primary)' }}>
              0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
