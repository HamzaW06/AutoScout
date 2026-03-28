import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fetchStats, fetchListings, type Listing, type Stats } from '../api';

function fmt$(n: number | null): string {
  if (n == null) return '--';
  return '$' + n.toLocaleString('en-US');
}

function fmtMi(n: number | null): string {
  if (n == null) return '--';
  return n.toLocaleString('en-US') + ' mi';
}

const RATING_COLORS: Record<string, string> = {
  STEAL: '#10b981',
  GREAT: '#4ade80',
  GOOD: '#60a5fa',
  FAIR: '#a3a3a3',
  HIGH: '#f59e0b',
  'RIP-OFF': '#e85454',
};

const RATING_ORDER = ['STEAL', 'GREAT', 'GOOD', 'FAIR', 'HIGH', 'RIP-OFF'];

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </div>
      <div className="mono text-2xl font-bold text-[var(--text-primary)]">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>
      )}
    </div>
  );
}

export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listingsRes] = await Promise.all([
        fetchStats(),
        fetchListings({ limit: '200', sort: 'deal_score', order: 'asc' }),
      ]);
      setStats(statsRes);
      setListings(listingsRes.listings);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        Loading...
      </div>
    );
  }

  // Calculate aggregate stats
  const stealsThisWeek = listings.filter((l) => {
    if (l.value_rating !== 'STEAL') return false;
    const seen = new Date(l.first_seen);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return seen >= weekAgo;
  }).length;

  const pricesWithValues = listings
    .map((l) => l.asking_price)
    .filter((p): p is number => p != null && p > 0);
  const avgPrice =
    pricesWithValues.length > 0
      ? Math.round(
          pricesWithValues.reduce((a, b) => a + b, 0) / pricesWithValues.length,
        )
      : null;

  const mileagesWithValues = listings
    .map((l) => l.mileage)
    .filter((m): m is number => m != null && m > 0);
  const avgMileage =
    mileagesWithValues.length > 0
      ? Math.round(
          mileagesWithValues.reduce((a, b) => a + b, 0) /
            mileagesWithValues.length,
        )
      : null;

  // Rating distribution chart data
  const ratingData = RATING_ORDER.filter(
    (r) => stats?.ratingBreakdown[r] != null,
  ).map((r) => ({
    name: r,
    count: stats?.ratingBreakdown[r] ?? 0,
    color: RATING_COLORS[r] ?? '#888',
  }));

  // Price by make chart data (top 10 makes)
  const makeMap = new Map<string, { total: number; count: number }>();
  for (const l of listings) {
    if (!l.make || l.asking_price == null) continue;
    const entry = makeMap.get(l.make) ?? { total: 0, count: 0 };
    entry.total += l.asking_price;
    entry.count += 1;
    makeMap.set(l.make, entry);
  }
  const priceByMake = Array.from(makeMap.entries())
    .map(([make, { total, count }]) => ({
      name: make,
      avgPrice: Math.round(total / count),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Best deals: top 5 by deal_score (lowest = best)
  const bestDeals = listings
    .filter((l) => l.deal_score != null)
    .sort((a, b) => (a.deal_score ?? 999) - (b.deal_score ?? 999))
    .slice(0, 5);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Active"
            value={stats?.activeListings.toLocaleString() ?? '0'}
            sub={`${stats?.activeDealers ?? 0} dealers`}
          />
          <StatCard
            label="STEALs This Week"
            value={String(stealsThisWeek)}
            sub="value_rating = STEAL"
          />
          <StatCard
            label="Avg Price"
            value={fmt$(avgPrice)}
            sub="across active listings"
          />
          <StatCard
            label="Avg Mileage"
            value={fmtMi(avgMileage)}
            sub="across active listings"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deal rating distribution */}
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Deal Rating Distribution
            </div>
            {ratingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ratingData}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={{ stroke: '#1e1e24' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={{ stroke: '#1e1e24' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111114',
                      border: '1px solid #1e1e24',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#f0f0f0',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {ratingData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-[var(--text-muted)] text-sm">
                No rating data available
              </div>
            )}
          </div>

          {/* Price by make */}
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Avg Price by Make (Top 10)
            </div>
            {priceByMake.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priceByMake} layout="vertical">
                  <XAxis
                    type="number"
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={{ stroke: '#1e1e24' }}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      `$${(v / 1000).toFixed(0)}k`
                    }
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: '#888', fontSize: 11 }}
                    axisLine={{ stroke: '#1e1e24' }}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111114',
                      border: '1px solid #1e1e24',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#f0f0f0',
                    }}
                    formatter={(value: unknown) => [
                      `$${Number(value).toLocaleString()}`,
                      'Avg Price',
                    ]}
                  />
                  <Bar
                    dataKey="avgPrice"
                    fill="#f0c040"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-[var(--text-muted)] text-sm">
                No make data available
              </div>
            )}
          </div>
        </div>

        {/* Best deals */}
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Best Deals
          </div>
          {bestDeals.length > 0 ? (
            <div className="space-y-2">
              {bestDeals.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center gap-4 px-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]"
                >
                  <span className="mono text-xs text-[var(--text-muted)] w-5">
                    #{i + 1}
                  </span>
                  <span className="font-medium text-[var(--text-primary)] flex-1">
                    {l.year} {l.make} {l.model}
                    {l.trim ? ` ${l.trim}` : ''}
                  </span>
                  <span className="mono text-sm font-semibold text-[var(--text-primary)]">
                    {fmt$(l.asking_price)}
                  </span>
                  {l.market_value != null && (
                    <span className="text-xs text-[var(--text-muted)]">
                      Mkt: <span className="mono">{fmt$(l.market_value)}</span>
                    </span>
                  )}
                  {l.value_rating && (
                    <span
                      className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase rounded"
                      style={{
                        background:
                          (RATING_COLORS[l.value_rating] ?? '#888') + '22',
                        color: RATING_COLORS[l.value_rating] ?? '#888',
                      }}
                    >
                      {l.value_rating}
                    </span>
                  )}
                  <span className="mono text-xs text-[var(--text-muted)]">
                    Score: {l.deal_score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[var(--text-muted)]">
              No scored listings available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
