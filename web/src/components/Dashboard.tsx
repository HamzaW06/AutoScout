import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchListings,
  fetchStats,
  toggleFavorite,
  type Listing,
  type Stats,
} from '../api';
import { DealBadge } from './DealBadge';
import { FilterBar, type Filters } from './FilterBar';
import { useWebSocket } from '../hooks/useWebSocket';

function fmt$(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US');
}

function fmtMi(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US') + ' mi';
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

type SortField = 'deal_score' | 'year' | 'mileage' | 'asking_price' | 'market_value' | 'risk_score' | 'days_on_market' | 'distance_miles';
type SortDir = 'asc' | 'desc';

const RATING_ORDER: Record<string, number> = { STEAL: 0, GREAT: 1, GOOD: 2, FAIR: 3, HIGH: 4, 'RIP-OFF': 5 };
const RATING_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  STEAL:    { bg: 'bg-emerald-500/12', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  GREAT:    { bg: 'bg-green-500/10',   text: 'text-green-400',   dot: 'bg-green-400' },
  GOOD:     { bg: 'bg-sky-500/10',     text: 'text-sky-400',     dot: 'bg-sky-400' },
  FAIR:     { bg: 'bg-neutral-500/10', text: 'text-neutral-400', dot: 'bg-neutral-400' },
  HIGH:     { bg: 'bg-orange-500/10',  text: 'text-orange-400',  dot: 'bg-orange-400' },
  'RIP-OFF':{ bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
};

const PAGE_SIZE = 50;

interface Toast {
  id: number;
  alertType: string;
  year: number;
  make: string;
  model: string;
  price: number;
  deal_score: number;
}

const emptyFilters: Filters = { make: '', model: '', yearMin: '', yearMax: '', priceMax: '', mileageMax: '', titleStatus: '' };

/* ─── Welcome Screen ─── */
function WelcomeView({ onAddDealer }: { onAddDealer: () => void }) {
  return (
    <div className="flex items-center justify-center h-full animate-fade-in">
      <div className="max-w-2xl w-full px-8 py-16 text-center">
        {/* Hero */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--amber)]/8 border border-[var(--amber)]/15 mb-8">
          <span className="text-4xl">🚗</span>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--amber)]/20 border border-[var(--amber)]/30 flex items-center justify-center">
            <span className="text-xs">✨</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">
          Welcome to Auto<span className="text-[var(--amber)]">Scout</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-md mx-auto mb-12">
          Your personal used car intelligence platform. Add dealer websites and we'll
          automatically find the best deals for you.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { step: '01', title: 'Add Dealers', desc: 'Paste any dealer inventory URL. We auto-detect the platform and start scraping.' },
            { step: '02', title: 'Auto Scrape', desc: 'Scrapers run on schedule — every 4h for top dealers. No manual work needed.' },
            { step: '03', title: 'Find Deals', desc: 'Listings ranked by value with real-time alerts for steals via Discord.' },
          ].map((s) => (
            <div key={s.step} className="card p-5 text-left group hover:border-[var(--amber)]/20 transition-all">
              <div className="text-[11px] font-bold text-[var(--amber)] tracking-widest mb-3 mono">{s.step}</div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{s.title}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onAddDealer} className="btn-primary text-sm px-8 py-3">
          Add Your First Dealer →
        </button>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
            Free forever
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />
            200+ dealer platforms
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
            Real-time alerts
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
export function Dashboard() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('deal_score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [newListingCount, setNewListingCount] = useState(0);
  const [fetching, setFetching] = useState(false);
  const toastIdRef = useRef(0);

  const { on } = useWebSocket();

  useEffect(() => {
    const unsub = on('deal_alert', (data) => {
      const d = data as Toast;
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { ...d, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
    });
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on('new_listing', () => setNewListingCount((c) => c + 1));
    return unsub;
  }, [on]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        sort: sortField,
        order: sortDir,
      };
      if (filters.make) params.make = filters.make;
      if (filters.model) params.model = filters.model;
      if (filters.yearMin) params.year_min = filters.yearMin;
      if (filters.yearMax) params.year_max = filters.yearMax;
      if (filters.priceMax) params.price_max = filters.priceMax;
      if (filters.mileageMax) params.mileage_max = filters.mileageMax;
      if (filters.titleStatus) params.title_status = filters.titleStatus;

      const [listingsRes, statsRes] = await Promise.all([fetchListings(params), fetchStats()]);
      setListings(listingsRes.listings);
      setTotal(listingsRes.total);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'asking_price' || field === 'mileage' ? 'asc' : 'desc');
    }
    setPage(0);
  }

  async function handleFetchNow() {
    if (fetching) return;
    setFetching(true);
    try {
      await fetch('/api/fetch-listings', { method: 'POST' });
      // Auto-refresh after 12 seconds to show new results
      setTimeout(() => {
        setFetching(false);
        loadData();
      }, 12_000);
    } catch (err) {
      console.error('Fetch listings failed:', err);
      setFetching(false);
    }
  }

  async function handleToggleFavorite(e: React.MouseEvent, listing: Listing) {
    e.stopPropagation();
    const next = !listing.is_favorite;
    try {
      await toggleFavorite(listing.id, next);
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, is_favorite: next ? 1 : 0 } : l)));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const sortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) return <span className="text-[var(--text-muted)] opacity-0 group-hover:opacity-50 transition-opacity ml-1">↕</span>;
      return <span className="text-[var(--amber)] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    },
    [sortField, sortDir],
  );

  const ratingBreakdown = useMemo(() => {
    if (!stats?.ratingBreakdown) return [];
    return Object.entries(stats.ratingBreakdown).sort(([a], [b]) => (RATING_ORDER[a] ?? 99) - (RATING_ORDER[b] ?? 99));
  }, [stats]);

  return (
    <div className="flex flex-col h-full">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-in flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm max-w-xs ${
              toast.alertType === 'steal'
                ? 'bg-emerald-950/95 border border-emerald-500/30 text-emerald-100'
                : 'bg-sky-950/95 border border-sky-500/30 text-sky-100'
            }`}
          >
            <span className="text-base mt-0.5">{toast.alertType === 'steal' ? '🔥' : '⭐'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px]">{toast.alertType === 'steal' ? 'Steal Alert!' : 'Great Deal!'}</div>
              <div className="truncate text-xs opacity-80 mt-0.5">
                {toast.year} {toast.make} {toast.model} — ${toast.price.toLocaleString()}
              </div>
            </div>
            <button
              className="opacity-50 hover:opacity-100 transition-opacity text-sm bg-transparent border-none cursor-pointer text-inherit"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* New listings banner */}
      {newListingCount > 0 && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-[var(--amber)]/6 border-b border-[var(--amber)]/15 text-sm animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
          <span className="text-[var(--amber)] font-medium text-[13px]">
            {newListingCount} new listing{newListingCount !== 1 ? 's' : ''} found
          </span>
          <button
            className="btn-secondary text-xs py-1 px-3"
            onClick={() => { setNewListingCount(0); loadData(); }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-5 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="text-[13px] text-[var(--text-secondary)]">
          <span className="mono text-[var(--text-primary)] font-semibold text-[15px]">
            {total.toLocaleString()}
          </span>
          <span className="ml-1.5">listings</span>
        </div>
        {stats && (
          <>
            <div className="w-px h-5 bg-[var(--border)]" />
            <div className="text-[13px] text-[var(--text-secondary)]">
              <span className="mono text-[var(--text-primary)] font-semibold">
                {stats.activeDealers}
              </span>
              <span className="ml-1.5">dealers</span>
            </div>
            {ratingBreakdown.length > 0 && (
              <>
                <div className="w-px h-5 bg-[var(--border)]" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ratingBreakdown.map(([rating, count]) => {
                    const c = RATING_COLORS[rating] ?? { bg: 'bg-neutral-500/10', text: 'text-neutral-400', dot: 'bg-neutral-400' };
                    return (
                      <span key={rating} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${c.bg} ${c.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {rating}
                        <span className="mono text-[10px] opacity-60">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Fetch Now button — right-aligned */}
        <div className="ml-auto">
          <button
            onClick={handleFetchNow}
            disabled={fetching}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            {fetching ? (
              <>
                <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Fetching...
              </>
            ) : (
              <>↓ Fetch Now</>
            )}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(0); }} />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--amber)]/30 border-t-[var(--amber)] rounded-full animate-spin" />
              <span className="text-sm">Loading listings...</span>
            </div>
          </div>
        ) : listings.length === 0 ? (
          <WelcomeView onAddDealer={() => navigate('/dealers/onboard')} />
        ) : (
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10">
                <th className="px-3 py-2.5 w-8" />
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('deal_score')}>
                  <span className="flex items-center">Deal{sortIcon('deal_score')}</span>
                </th>
                <th className="px-3 py-2.5">Vehicle</th>
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('mileage')}>
                  <span className="flex items-center">Mileage{sortIcon('mileage')}</span>
                </th>
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('asking_price')}>
                  <span className="flex items-center">Price{sortIcon('asking_price')}</span>
                </th>
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('market_value')}>
                  <span className="flex items-center">Market{sortIcon('market_value')}</span>
                </th>
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('risk_score')}>
                  <span className="flex items-center">Risk{sortIcon('risk_score')}</span>
                </th>
                <th className="px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('days_on_market')}>
                  <span className="flex items-center">Days{sortIcon('days_on_market')}</span>
                </th>
                <th className="px-3 py-2.5">Source</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l, i) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/vehicle/${l.id}`)}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={(e) => handleToggleFavorite(e, l)}
                      className={`text-sm cursor-pointer bg-transparent border-none transition-all ${
                        l.is_favorite
                          ? 'text-[var(--amber)] scale-110'
                          : 'text-[var(--text-muted)] hover:text-[var(--amber)] opacity-40 hover:opacity-100'
                      }`}
                    >
                      {l.is_favorite ? '★' : '☆'}
                    </button>
                  </td>

                  <td className="px-3 py-2.5">
                    <DealBadge rating={l.value_rating} />
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {l.year} {l.make} {l.model}
                      </span>
                      {l.trim && <span className="text-[var(--text-muted)] text-xs">{l.trim}</span>}
                      {isToday(l.first_seen) && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[var(--amber)]/12 text-[var(--amber)] tracking-wider">
                          New
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 mono text-[var(--text-secondary)] text-xs">{fmtMi(l.mileage)}</td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="mono font-semibold text-[var(--text-primary)]">{fmt$(l.asking_price)}</span>
                      {l.price_dropped > 0 && (
                        <span className="inline-flex items-center text-[var(--red)] text-[10px] font-semibold">
                          ↓{l.price_drop_count}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 mono text-[var(--text-secondary)] text-xs">{fmt$(l.market_value)}</td>

                  <td className="px-3 py-2.5">
                    {l.risk_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              l.risk_score < 30 ? 'bg-[var(--green)]' : l.risk_score < 60 ? 'bg-[var(--orange)]' : 'bg-[var(--red)]'
                            }`}
                            style={{ width: `${Math.min(l.risk_score, 100)}%` }}
                          />
                        </div>
                        <span className="mono text-[10px] text-[var(--text-muted)]">{l.risk_score}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 mono text-[var(--text-secondary)] text-xs">{l.days_on_market ?? '—'}</td>

                  <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg-surface)] text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="btn-secondary text-xs py-1.5 px-4"
          >
            ← Prev
          </button>
          <span className="text-[var(--text-muted)] text-xs">
            Page <span className="mono text-[var(--text-secondary)] font-medium">{page + 1}</span> of{' '}
            <span className="mono text-[var(--text-secondary)] font-medium">{totalPages}</span>
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary text-xs py-1.5 px-4"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
