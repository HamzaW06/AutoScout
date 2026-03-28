import { useState, useEffect, useCallback } from 'react';
import { fetchDealers, createDealer, updateDealer, type Dealer } from '../api';

function fmtDate(d: string | null): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString();
}

function fmtRating(r: number | null): string {
  if (r == null) return '--';
  return r.toFixed(1);
}

function fmtPct(n: number | null): string {
  if (n == null) return '--';
  return `${Math.round(n * 100)}%`;
}

const DEALER_TYPES = [
  'franchise',
  'independent',
  'private',
  'wholesale',
  'auction',
  'other',
];

const inputClass =
  'h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-dim)] transition-colors';

export function DealerManager() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Add dealer form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState('');
  const [detectingPlatform, setDetectingPlatform] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDealers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDealers();
      setDealers(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dealers');
      console.error('Failed to load dealers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  // Simulate platform detection when URL changes
  useEffect(() => {
    if (!formUrl || formUrl.length < 8) {
      setDetectedPlatform(null);
      return;
    }
    setDetectingPlatform(true);
    const timeout = setTimeout(() => {
      const url = formUrl.toLowerCase();
      let platform: string | null = null;
      if (url.includes('cargurus')) platform = 'CarGurus';
      else if (url.includes('autotrader')) platform = 'AutoTrader';
      else if (url.includes('cars.com')) platform = 'Cars.com';
      else if (url.includes('carfax')) platform = 'Carfax';
      else if (url.includes('dealertrack')) platform = 'DealerTrack';
      else if (url.includes('dealer.com')) platform = 'Dealer.com';
      else if (url.includes('dealersocket')) platform = 'DealerSocket';
      else platform = 'Custom Website';
      setDetectedPlatform(platform);
      setDetectingPlatform(false);
    }, 800);
    return () => clearTimeout(timeout);
  }, [formUrl]);

  function resetForm() {
    setFormName('');
    setFormUrl('');
    setFormCity('');
    setFormPhone('');
    setFormType('');
    setDetectedPlatform(null);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const data: Partial<Dealer> = {
        name: formName.trim(),
        website_url: formUrl.trim() || null,
        city: formCity.trim() || null,
        phone: formPhone.trim() || null,
        dealer_type: formType || null,
        platform: detectedPlatform,
      };

      if (editingId != null) {
        await updateDealer(editingId, data);
      } else {
        await createDealer(data);
      }

      resetForm();
      setShowForm(false);
      await loadDealers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save dealer');
      console.error('Failed to save dealer:', err);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(dealer: Dealer) {
    setEditingId(dealer.id);
    setFormName(dealer.name);
    setFormUrl(dealer.website_url ?? '');
    setFormCity(dealer.city ?? '');
    setFormPhone(dealer.phone ?? '');
    setFormType(dealer.dealer_type ?? '');
    setDetectedPlatform(dealer.platform ?? null);
    setShowForm(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] m-0">
            Dealers
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            <span className="mono text-[var(--text-secondary)]">
              {dealers.length}
            </span>{' '}
            total
          </span>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              setShowForm(true);
            }
          }}
          className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--gold-dim)] text-[var(--gold)] hover:bg-[var(--gold)]/10 cursor-pointer bg-transparent transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Dealer'}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="px-4 py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] space-y-3"
        >
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
            {editingId ? 'Edit Dealer' : 'New Dealer'}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Dealer name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className={`${inputClass} w-56`}
              required
            />
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="Website URL"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className={`${inputClass} w-64`}
              />
              {detectingPlatform && (
                <span className="text-xs text-[var(--gold)] animate-pulse">
                  Detecting platform...
                </span>
              )}
              {!detectingPlatform && detectedPlatform && (
                <span className="text-xs text-[var(--green)]">
                  {detectedPlatform}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="City"
              value={formCity}
              onChange={(e) => setFormCity(e.target.value)}
              className={`${inputClass} w-36`}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className={`${inputClass} w-36`}
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className={`${inputClass} w-36`}
            >
              <option value="">Dealer type</option>
              {DEALER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !formName.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded bg-[var(--gold)] text-[#0a0a0c] hover:bg-[var(--gold-dim)] disabled:opacity-40 cursor-pointer border-none transition-colors"
            >
              {submitting
                ? 'Saving...'
                : editingId
                  ? 'Update Dealer'
                  : 'Add Dealer'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
                setFormError(null);
              }}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none transition-colors"
            >
              Cancel
            </button>
          </div>
          {formError && (
            <div className="text-xs text-red-400">{formError}</div>
          )}
        </form>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
            Loading...
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center h-64 text-red-400">
            {loadError}
          </div>
        ) : dealers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
            <p className="text-lg mb-2">No dealers yet.</p>
            <p className="text-sm text-[var(--text-muted)]">
              Add your first dealer to start tracking inventory.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-10">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Inventory</th>
                <th className="px-3 py-2">Google Rating</th>
                <th className="px-3 py-2">Success Rate</th>
                <th className="px-3 py-2">Last Scraped</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => {
                const successRate = d.scrape_success_rate;
                const successColor =
                  successRate == null
                    ? 'text-[var(--text-muted)]'
                    : successRate >= 0.9
                      ? 'text-[var(--green)]'
                      : successRate >= 0.7
                        ? 'text-yellow-500'
                        : 'text-[var(--red)]';

                return (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                      {d.name}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {d.platform ?? '--'}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {d.city ?? '--'}
                      {d.state ? `, ${d.state}` : ''}
                    </td>
                    <td className="px-3 py-2 mono text-[var(--text-secondary)]">
                      {d.typical_inventory_size ?? '--'}
                    </td>
                    <td className="px-3 py-2">
                      {d.google_rating != null ? (
                        <span className="flex items-center gap-1">
                          <span className="mono text-[var(--gold)]">
                            {fmtRating(d.google_rating)}
                          </span>
                          {d.google_review_count != null && (
                            <span className="text-xs text-[var(--text-muted)]">
                              ({d.google_review_count})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 mono ${successColor}`}>
                      {fmtPct(successRate)}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
                      {fmtDate(d.last_scraped)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          d.is_active
                            ? 'bg-[var(--green)]'
                            : 'bg-[var(--red)]'
                        }`}
                        title={d.is_active ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => startEdit(d)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] cursor-pointer bg-transparent border-none transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
