import { useState, useEffect } from 'react';
import { createTransaction, fetchTransactions } from '../api';

const TRANSACTION_TYPES = ['viewed', 'contacted', 'visited', 'offered', 'bought', 'walked'] as const;
type TransactionType = typeof TRANSACTION_TYPES[number];

interface Transaction {
  id?: number;
  type: string;
  listing_id?: string | null;
  offered_price?: number | null;
  notes: string;
  created_at?: string;
}

const TYPE_COLORS: Record<TransactionType, string> = {
  viewed: '#6b7280',
  contacted: '#3b82f6',
  visited: '#8b5cf6',
  offered: '#f59e0b',
  bought: '#22c55e',
  walked: '#ef4444',
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type as TransactionType] ?? '#6b7280';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'capitalize',
        background: color + '22',
        color: color,
        border: `1px solid ${color}44`,
      }}
    >
      {type}
    </span>
  );
}

function FunnelBar({ transactions }: { transactions: Transaction[] }) {
  const counts = TRANSACTION_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = transactions.filter((tx) => tx.type === t).length;
    return acc;
  }, {});

  const labels: Record<TransactionType, string> = {
    viewed: 'Viewed',
    contacted: 'Contacted',
    visited: 'Visited',
    offered: 'Offered',
    bought: 'Bought',
    walked: 'Walked',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        marginBottom: '24px',
      }}
    >
      {TRANSACTION_TYPES.map((t) => {
        const color = TYPE_COLORS[t];
        return (
          <div
            key={t}
            style={{
              background: '#1f2937',
              border: `1px solid ${color}33`,
              borderRadius: '6px',
              padding: '12px 8px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: color,
                fontFamily: 'monospace',
              }}
            >
              {counts[t]}
            </div>
            <div
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginTop: '4px',
              }}
            >
              {labels[t]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LogFormState {
  type: TransactionType;
  listing_id: string;
  offered_price: string;
  notes: string;
}

const DEFAULT_FORM: LogFormState = {
  type: 'viewed',
  listing_id: '',
  offered_price: '',
  notes: '',
};

export function TransactionTracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LogFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions()
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : data.transactions ?? []);
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.type) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Parameters<typeof createTransaction>[0] = {
        type: form.type,
        notes: form.notes,
        ...(form.listing_id ? { listing_id: form.listing_id } : {}),
        ...(form.offered_price ? { offered_price: parseFloat(form.offered_price) } : {}),
      };
      const saved = await createTransaction(payload);
      setTransactions((prev) => [saved, ...prev]);
      setForm(DEFAULT_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function fmtDate(dateStr?: string) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '24px',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          Transaction Tracker
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: '500',
            borderRadius: '4px',
            cursor: 'pointer',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
          }}
        >
          {showForm ? 'Cancel' : '+ Log Activity'}
        </button>
      </div>

      {/* Funnel bar */}
      <FunnelBar transactions={transactions} />

      {/* Log form */}
      {showForm && (
        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '14px',
            }}
          >
            Log Activity
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            {/* Type */}
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}
              >
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Listing ID */}
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}
              >
                Listing ID (optional)
              </label>
              <input
                type="text"
                value={form.listing_id}
                onChange={(e) => setForm({ ...form, listing_id: e.target.value })}
                placeholder="e.g. abc123"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Offered price */}
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}
              >
                Offered Price (optional)
              </label>
              <input
                type="number"
                value={form.offered_price}
                onChange={(e) => setForm({ ...form, offered_price: e.target.value })}
                placeholder="e.g. 12500"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}
            >
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Add any notes…"
              style={{
                width: '100%',
                padding: '7px 10px',
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--red, #ef4444)',
                marginBottom: '10px',
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: '500',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#374151' : '#2563eb',
              color: saving ? 'var(--text-muted)' : '#fff',
              border: 'none',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
          Loading transactions…
        </div>
      ) : transactions.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
          No transactions logged yet. Click "Log Activity" to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {transactions.map((tx, i) => (
            <div
              key={tx.id ?? i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
              }}
            >
              <TypeBadge type={tx.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {tx.notes && (
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {tx.notes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {tx.offered_price != null && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      Offered: ${Number(tx.offered_price).toLocaleString('en-US')}
                    </span>
                  )}
                  {tx.listing_id && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Listing: {tx.listing_id}
                    </span>
                  )}
                </div>
              </div>
              {tx.created_at && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmtDate(tx.created_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
