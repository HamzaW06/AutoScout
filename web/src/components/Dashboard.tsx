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
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type SortField =
  | 'deal_score'
  | 'year'
  | 'mileage'
  | 'asking_price'
  | 'market_value'
  | 'risk_score'
  | 'days_on_market'
  | 'distance_miles';
type SortDir = 'asc' | 'desc';

const RATING_ORDER: Record<string, number> = {
  STEAL: 0,
  GREAT: 1,
  GOOD: 2,
  FAIR: 3,
  HIGH: 4,
  'RIP-OFF': 5,
};

const RATING_PILL_COLORS: Record<string, string> = {
  STEAL: 'bg-emerald-500/20 text-emerald-400',
  GREAT: 'bg-green-500/15 text-green-400',
  GOOD: 'bg-blue-500/15 text-blue-400',
  FAIR: 'bg-neutral-500/15 text-neutral-400',
  HIGH: 'bg-orange-500/15 text-orange-400',
  'RIP-OFF': 'bg-red-500/20 text-red-400',
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

const emptyFilters: Filters = {
  make: '',
  model: '',
  yearMin: '',
  yearMax: '',
  priceMax: '',
  mileageMax: '',
  titleStatus: '',
};

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
  const toastIdRef = useRef(0);

  const { on } = useWebSocket();

  // Listen for deal_alert events — show toast notifications
  useEffect(() => {
    const unsubAlert = on('deal_alert', (data) => {
      const d = data as { alertType: string; year: number; make: string; model: string; price: number; deal_score: number };
      const id = ++toastIdRef.current;
      const toast: Toast = {
        id,
        alertType: d.alertType,
        year: d.year,
        make: d.make,
        model: d.model,
        price: d.price,
        deal_score: d.deal_score,
      };
      setToasts((prev) => [...prev, toast]);
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 8000);
    });
    return unsubAlert;
  }, [on]);

  // Listen for new_listing events — increment counter
  useEffect(() => {
    const unsubListing = on('new_listing', () => {
      setNewListingCount((c) => c + 1);
    });
    return unsubListing;
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

      const [listingsRes, statsRes] = await Promise.all([
        fetchListings(params),
        fetchStats(),
      ]);
      setListings(listingsRes.listings);
      setTotal(listingsRes.total);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'asking_price' || field === 'mileage' ? 'asc' : 'desc');
    }
    setPage(0);
  }

  async function handleToggleFavorite(
    e: React.MouseEvent,
    listing: Listing,
  ) {
    e.stopPropagation();
    const next = listing.is_favorite ? false : true;
    try {
      await toggleFavorite(listing.id, next);
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id ? { ...l, is_favorite: next ? 1 : 0 } : l,
        ),
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const sortIndicator = useCallback(
    (field: SortField) => {
      if (sortField !== field) return '';
      return sortDir === 'asc' ? ' ↑' : ' ↓';
    },
    [sortField, sortDir],
  );

  const ratingBreakdown = useMemo(() => {
    if (!stats?.ratingBreakdown) return [];
    return Object.entries(stats.ratingBreakdown).sort(
      ([a], [b]) => (RATING_ORDER[a] ?? 99) - (RATING_ORDER[b] ?? 99),
    );
  }, [stats]);

  return (
    <div className="flex flex-col h-full">
      {/* Toast notifications — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-xs transition-all ${
              toast.alertType === 'steal'
                ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
                : 'bg-blue-900/90 border-blue-500/40 text-blue-100'
            }`}
          >
            <span className="text-base mt-0.5">{toast.alertType === 'steal' ? '🔥' : '⭐'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {toast.alertType === 'steal' ? 'Steal Alert!' : 'Great Deal!'}
              </div>
              <div className="truncate text-xs opacity-90">
                {toast.year} {toast.make} {toast.model} — ${toast.price.toLocaleString()}
              </div>
              <div className="text-xs opacity-75">{toast.deal_score}% below market</div>
            </div>
            <button
              className="opacity-60 hover:opacity-100 transition-opacity text-base leading-none bg-transparent border-none cursor-pointer"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* New listings banner */}
      {newListingCount > 0 && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-[var(--gold)]/10 border-b border-[var(--gold)]/30 text-sm">
          <span className="text-[var(--gold)] font-medium">
            {newListingCount} new listing{newListingCount !== 1 ? 's' : ''} available
          </span>
          <button
            className="px-2.5 py-0.5 rounded text-xs font-medium bg-[var(--gold)]/20 text-[var(--gold)] hover:bg-[var(--gold)]/30 transition-colors cursor-pointer border-none"
            onClick={() => { setNewListingCount(0); loadData(); }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="text-sm text-[var(--text-secondary)]">
          <span className="mono text-[var(--text-primary)] font-semibold">
            {total.toLocaleString()}
          </span>{' '}
          listings
        </div>
        {stats && (
          <>
            <div className="w-px h-4 bg-[var(--border)]" />
            <div className="text-sm text-[var(--text-secondary)]">
              <span className="mono text-[var(--text-primary)]">
                {stats.activeDealers}
              </span>{' '}
              dealers
            </div>
            <div className="w-px h-4 bg-[var(--border)]" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {ratingBreakdown.map(([rating, count]) => (
                <span
                  key={rating}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${RATING_PILL_COLORS[rating] ?? 'bg-neutral-500/15 text-neutral-400'}`}
                >
                  {rating}
                  <span className="mono text-[10px] opacity-75">{count}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setPage(0);
        }}
      />

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
            Loading...
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <div className="text-5xl mb-6">🚗</div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
              Welcome to AutoScout
            </h2>
            <p className="text-[var(--text-secondary)] max-w-md mb-8 leading-relaxed">
              Your personal used car intelligence platform. Add dealer websites and AutoScout will
              automatically scrape their inventory, find the best deals, and alert you in real-time.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-10">
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="text-2xl mb-2">1️⃣</div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Add Dealers</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Go to <strong>Add Dealers</strong> and paste dealer inventory URLs. AutoScout auto-detects the platform.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="text-2xl mb-2">2️⃣</div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Auto Scrape</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Scrapers run automatically on schedule. High priority every 4h, medium every 12h, low daily.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="text-2xl mb-2">3️⃣</div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Find Deals</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Listings appear here ranked by value. Get alerts for steals via Discord or the dashboard.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/dealers/onboard')}
              className="px-6 py-3 rounded-lg font-semibold text-sm bg-[var(--gold)] text-black hover:opacity-90 transition-opacity cursor-pointer border-none"
            >
              ➕ Add Your First Dealer
            </button>

            <div className="mt-6 flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <button
                onClick={() => navigate('/settings')}
                className="hover:text-[var(--text-secondary)] transition-colors cursor-pointer bg-transparent border-none text-xs text-[var(--text-muted)] underline"
              >
                Configure Settings
              </button>
              <span>|</span>
              <button
                onClick={() => navigate('/scraper-health')}
                className="hover:text-[var(--text-secondary)] transition-colors cursor-pointer bg-transparent border-none text-xs text-[var(--text-muted)] underline"
              >
                View Scraper Health
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10">
                <th className="px-3 py-2 w-8"></th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('deal_score')}
                >
                  Deal{sortIndicator('deal_score')}
                </th>
                <th className="px-3 py-2">Vehicle</th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('mileage')}
                >
                  Mileage{sortIndicator('mileage')}
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('asking_price')}
                >
                  Price{sortIndicator('asking_price')}
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('market_value')}
                >
                  Market{sortIndicator('market_value')}
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('risk_score')}
                >
                  Risk{sortIndicator('risk_score')}
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('days_on_market')}
                >
                  Days{sortIndicator('days_on_market')}
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:text-[var(--gold)] transition-colors"
                  onClick={() => handleSort('distance_miles')}
                >
                  Dist{sortIndicator('distance_miles')}
                </th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/vehicle/${l.id}`)}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                >
                  {/* Favorite */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={(e) => handleToggleFavorite(e, l)}
                      className={`text-base cursor-pointer bg-transparent border-none ${
                        l.is_favorite
                          ? 'text-[var(--gold)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--gold-dim)]'
                      } transition-colors`}
                      title={l.is_favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      {l.is_favorite ? '★' : '☆'}
                    </button>
                  </td>

                  {/* Deal badge */}
                  <td className="px-3 py-2">
                    <DealBadge rating={l.value_rating} />
                  </td>

                  {/* Vehicle */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {l.year} {l.make} {l.model}
                      </span>
                      {l.trim && (
                        <span className="text-[var(--text-secondary)] text-xs">
                          {l.trim}
                        </span>
                      )}
                      {isToday(l.first_seen) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-[var(--gold)]/15 text-[var(--gold)]">
                          New
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Mileage */}
                  <td className="px-3 py-2 mono text-[var(--text-secondary)]">
                    {fmtMi(l.mileage)}
                  </td>

                  {/* Price */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="mono font-medium">
                        {fmt$(l.asking_price)}
                      </span>
                      {l.price_dropped > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[var(--red)] text-xs">
                          <span>↓</span>
                          <span className="mono text-[10px]">
                            {l.price_drop_count}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Market value */}
                  <td className="px-3 py-2 mono text-[var(--text-secondary)]">
                    {fmt$(l.market_value)}
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-2">
                    {l.risk_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              l.risk_score < 30
                                ? 'bg-[var(--green)]'
                                : l.risk_score < 60
                                  ? 'bg-yellow-500'
                                  : 'bg-[var(--red)]'
                            }`}
                            style={{ width: `${Math.min(l.risk_score, 100)}%` }}
                          />
                        </div>
                        <span className="mono text-xs text-[var(--text-muted)]">
                          {l.risk_score}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>

                  {/* Days on market */}
                  <td className="px-3 py-2 mono text-[var(--text-secondary)]">
                    {l.days_on_market ?? '—'}
                  </td>

                  {/* Distance */}
                  <td className="px-3 py-2 mono text-[var(--text-secondary)]">
                    {l.distance_miles != null
                      ? `${l.distance_miles.toLocaleString()} mi`
                      : '—'}
                  </td>

                  {/* Source */}
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                    {l.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-surface)] text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer bg-transparent"
          >
            ← Prev
          </button>
          <span className="text-[var(--text-secondary)]">
            Page{' '}
            <span className="mono text-[var(--text-primary)]">{page + 1}</span>{' '}
            of{' '}
            <span className="mono text-[var(--text-primary)]">{totalPages}</span>
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer bg-transparent"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
