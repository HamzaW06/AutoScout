import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchListing, toggleFavorite, type Listing } from '../api';
import { DealBadge } from './DealBadge';
import { ScamAlert } from './ScamAlert';
import { ContactButton } from './ContactButton';
import { EnrichmentStatus } from './EnrichmentStatus';

function fmt$(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US');
}

function fmtMi(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US') + ' mi';
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function SpecItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)]">{value || '—'}</span>
    </div>
  );
}

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchListing(id)
      .then(setListing)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleReAnalyze() {
    if (!listing) return;
    try {
      await fetch(`/api/listings/${listing.id}/analyze`, { method: 'POST' });
      const updated = await fetchListing(listing.id);
      setListing(updated);
    } catch (err) {
      console.error('Re-analyze failed:', err);
    }
  }

  async function handleToggleFavorite() {
    if (!listing) return;
    const next = !listing.is_favorite;
    try {
      await toggleFavorite(listing.id, next);
      setListing({ ...listing, is_favorite: next ? 1 : 0 });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        Loading...
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-[var(--red)]">{error ?? 'Listing not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const photos = parseJsonArray(listing.photos);
  const riskFactors = parseJsonArray(listing.risk_factors);
  const scamFlags = parseJsonArray(listing.scam_flags);
  const tactics = parseJsonArray(listing.negotiation_tactics);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] cursor-pointer bg-transparent border-none transition-colors"
      >
        ← Back to listings
      </button>

      {/* Scam alert banner */}
      {listing.scam_score != null && (
        <ScamAlert scamScore={listing.scam_score} scamFlags={listing.scam_flags} />
      )}

      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] m-0">
              {listing.year} {listing.make} {listing.model}
            </h1>
            {listing.trim && (
              <span className="text-lg text-[var(--text-secondary)]">
                {listing.trim}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DealBadge rating={listing.value_rating} />
            {listing.risk_score != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] uppercase">
                  Risk
                </span>
                <div className="w-16 h-2 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      listing.risk_score < 30
                        ? 'bg-[var(--green)]'
                        : listing.risk_score < 60
                          ? 'bg-yellow-500'
                          : 'bg-[var(--red)]'
                    }`}
                    style={{
                      width: `${Math.min(listing.risk_score, 100)}%`,
                    }}
                  />
                </div>
                <span className="mono text-xs text-[var(--text-secondary)]">
                  {listing.risk_score}
                </span>
              </div>
            )}
            <button
              onClick={handleToggleFavorite}
              className={`text-xl cursor-pointer bg-transparent border-none ${
                listing.is_favorite
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--gold-dim)]'
              } transition-colors`}
            >
              {listing.is_favorite ? '★' : '☆'}
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-3xl font-bold text-[var(--text-primary)]">
            {fmt$(listing.asking_price)}
          </div>
          {listing.market_value != null && (
            <div className="text-sm text-[var(--text-secondary)]">
              Market: <span className="mono">{fmt$(listing.market_value)}</span>
            </div>
          )}
          {listing.price_dropped > 0 && (
            <div className="text-xs text-[var(--red)] mt-1">
              ↓ Price dropped {listing.price_drop_count} time
              {listing.price_drop_count !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Offer range */}
      {(listing.offer_low != null || listing.offer_high != null) && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Offer Range
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-[var(--text-secondary)]">
                Open at{' '}
              </span>
              <span className="mono text-lg font-semibold text-[var(--green)]">
                {fmt$(listing.offer_low)}
              </span>
            </div>
            <div className="text-[var(--text-muted)]">→</div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]">
                Max{' '}
              </span>
              <span className="mono text-lg font-semibold text-[var(--gold)]">
                {fmt$(listing.offer_high)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Key specs grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
        <SpecItem label="Mileage" value={<span className="mono">{fmtMi(listing.mileage)}</span>} />
        <SpecItem label="Title Status" value={listing.title_status} />
        <SpecItem label="Engine" value={listing.engine} />
        <SpecItem label="Transmission" value={listing.transmission} />
        <SpecItem label="Drivetrain" value={listing.drivetrain} />
        <SpecItem label="Exterior Color" value={listing.exterior_color} />
        <SpecItem label="Body Style" value={listing.body_style} />
        <SpecItem label="Fuel Type" value={listing.fuel_type} />
        <SpecItem
          label="Price/Mile"
          value={
            listing.price_per_mile != null ? (
              <span className="mono">${listing.price_per_mile.toFixed(2)}</span>
            ) : null
          }
        />
        <SpecItem
          label="Owners"
          value={listing.owner_count != null ? String(listing.owner_count) : null}
        />
        <SpecItem
          label="Accidents"
          value={
            listing.accident_count != null ? (
              <span
                className={listing.accident_count > 0 ? 'text-[var(--red)]' : ''}
              >
                {listing.accident_count}
              </span>
            ) : null
          }
        />
        <SpecItem
          label="Days on Market"
          value={
            listing.days_on_market != null
              ? String(listing.days_on_market)
              : null
          }
        />
      </div>

      {/* Enrichment status */}
      <EnrichmentStatus listing={listing} onReAnalyze={handleReAnalyze} />

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Risk Factors
          </div>
          <ul className="space-y-1 m-0 p-0 list-none">
            {riskFactors.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
              >
                <span className="text-yellow-500 mt-0.5">⚠</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scam flags */}
      {scamFlags.length > 0 && (
        <div className="p-4 rounded border border-[var(--red)]/30 bg-[var(--red)]/5">
          <div className="text-xs uppercase tracking-wider text-[var(--red)] mb-2">
            Scam Alerts
          </div>
          <ul className="space-y-1 m-0 p-0 list-none">
            {scamFlags.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[var(--red)]"
              >
                <span className="mt-0.5">🚩</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negotiation tactics */}
      {tactics.length > 0 && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Negotiation Tactics
          </div>
          <ul className="space-y-1 m-0 p-0 list-none">
            {tactics.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
              >
                <span className="text-[var(--blue)] mt-0.5">→</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Photos
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[4/3] rounded overflow-hidden border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {listing.description && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Description
          </div>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed m-0">
            {listing.description}
          </p>
        </div>
      )}

      {/* Seller info */}
      {(listing.seller_name || listing.seller_location || listing.seller_type) && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Seller
            </div>
            <ContactButton
              listing={{
                year: listing.year,
                make: listing.make,
                model: listing.model,
                asking_price: listing.asking_price,
                seller_phone: listing.seller_phone ?? null,
                seller_name: listing.seller_name,
                source_url: listing.source_url ?? null,
              }}
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            {listing.seller_name && (
              <span className="text-[var(--text-primary)]">
                {listing.seller_name}
              </span>
            )}
            {listing.seller_type && (
              <span className="text-[var(--text-secondary)]">
                ({listing.seller_type})
              </span>
            )}
            {listing.seller_location && (
              <span className="text-[var(--text-secondary)]">
                {listing.seller_location}
              </span>
            )}
            {listing.distance_miles != null && (
              <span className="mono text-[var(--text-muted)]">
                {listing.distance_miles.toLocaleString()} mi away
              </span>
            )}
          </div>
        </div>
      )}

      {/* VIN and source */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pb-8">
        {listing.vin && (
          <span>
            VIN: <span className="mono">{listing.vin}</span>
          </span>
        )}
        <span>Source: {listing.source}</span>
        <span>First seen: {new Date(listing.first_seen).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
