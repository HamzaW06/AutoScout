import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fetchListing, type Listing } from '../api';
import { DealBadge } from './DealBadge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(n: number | null): string {
  if (n == null) return '\u2014';
  return '$' + n.toLocaleString('en-US');
}

function fmtMi(n: number | null): string {
  if (n == null) return '\u2014';
  return n.toLocaleString('en-US') + ' mi';
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

interface ForecastCostSummary {
  year_1: number;
  year_2: number;
  year_3: number;
  total: number;
}

interface ForecastData {
  cost_summary?: ForecastCostSummary;
  parts_affordability_score?: number;
}

function parseForecast(raw: string | null): ForecastData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ForecastData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Radar data builder
// ---------------------------------------------------------------------------

const RADAR_COLORS = ['#f0c040', '#60a5fa', '#4ade80', '#e85454'];

function buildRadarData(vehicles: Listing[]) {
  const maxPrice = Math.max(...vehicles.map((v) => v.asking_price || 1));
  const maxDays = Math.max(...vehicles.map((v) => v.days_on_market || 1), 1);

  const axes = ['Value', 'Reliability', 'Affordability', 'Freshness', 'Parts Cost'];

  return axes.map((axis) => {
    const row: Record<string, string | number> = { axis };
    vehicles.forEach((v, i) => {
      const key = `v${i}`;
      const forecast = parseForecast(v.repair_forecast);
      switch (axis) {
        case 'Value':
          row[key] = Math.min(v.deal_score ?? 50, 100);
          break;
        case 'Reliability':
          row[key] = Math.max(0, 100 - (v.risk_score ?? 50));
          break;
        case 'Affordability':
          row[key] = maxPrice > 0
            ? Math.round((1 - (v.asking_price || 0) / maxPrice) * 100)
            : 50;
          break;
        case 'Freshness':
          row[key] = maxDays > 0
            ? Math.round((1 - (v.days_on_market ?? maxDays) / maxDays) * 80) + 20
            : 50;
          break;
        case 'Parts Cost':
          row[key] = forecast?.parts_affordability_score ?? 50;
          break;
      }
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// Comparison row highlight logic
// ---------------------------------------------------------------------------

type RowDef = {
  label: string;
  getValue: (l: Listing) => string | number | null;
  /** 'low' = lower is better, 'high' = higher is better, null = no highlight */
  best: 'low' | 'high' | null;
  numeric?: boolean;
};

const COMP_ROWS: RowDef[] = [
  {
    label: 'Price',
    getValue: (l) => l.asking_price,
    best: 'low',
    numeric: true,
  },
  {
    label: 'Market Value',
    getValue: (l) => l.market_value,
    best: 'high',
    numeric: true,
  },
  {
    label: 'Mileage',
    getValue: (l) => l.mileage,
    best: 'low',
    numeric: true,
  },
  {
    label: 'Risk Score',
    getValue: (l) => l.risk_score,
    best: 'low',
    numeric: true,
  },
  {
    label: 'Deal Score',
    getValue: (l) => l.deal_score,
    best: 'high',
    numeric: true,
  },
  {
    label: 'Days Listed',
    getValue: (l) => l.days_on_market,
    best: 'low',
    numeric: true,
  },
  { label: 'Title Status', getValue: (l) => l.title_status, best: null },
  { label: 'Engine', getValue: (l) => l.engine, best: null },
  { label: 'Transmission', getValue: (l) => l.transmission, best: null },
  { label: 'Seller Type', getValue: (l) => l.seller_type, best: null },
];

function formatCell(val: string | number | null, numeric?: boolean): string {
  if (val == null) return '\u2014';
  if (typeof val === 'number') {
    return numeric ? val.toLocaleString('en-US') : String(val);
  }
  return val;
}

function findWinnerIdx(
  vehicles: Listing[],
  row: RowDef,
): number | null {
  if (!row.best) return null;
  let bestIdx: number | null = null;
  let bestVal: number | null = null;
  vehicles.forEach((v, i) => {
    const raw = row.getValue(v);
    if (raw == null || typeof raw !== 'number') return;
    if (
      bestVal === null ||
      (row.best === 'low' && raw < bestVal) ||
      (row.best === 'high' && raw > bestVal)
    ) {
      bestVal = raw;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompareView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState('');

  const ids = useMemo(() => {
    const raw = searchParams.get('ids') || '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    if (ids.length === 0) {
      setVehicles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => fetchListing(id).catch(() => null)))
      .then((results) => {
        setVehicles(results.filter((r): r is Listing => r !== null));
      })
      .finally(() => setLoading(false));
  }, [ids]);

  function addVehicle() {
    const id = addInput.trim();
    if (!id || ids.includes(id) || ids.length >= 4) return;
    const next = [...ids, id];
    setSearchParams({ ids: next.join(',') });
    setAddInput('');
  }

  function removeVehicle(id: string) {
    const next = ids.filter((x) => x !== id);
    setSearchParams(next.length > 0 ? { ids: next.join(',') } : {});
  }

  const radarData = useMemo(
    () => (vehicles.length >= 2 ? buildRadarData(vehicles) : null),
    [vehicles],
  );

  const forecasts = useMemo(
    () => vehicles.map((v) => parseForecast(v.repair_forecast)),
    [vehicles],
  );

  const hasTco = forecasts.some((f) => f?.cost_summary != null);

  const inputClass =
    'h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-dim)] transition-colors';

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer bg-transparent border-none"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Compare Vehicles
          </h1>
        </div>

        {/* Add vehicle input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Listing ID"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addVehicle()}
            className={`${inputClass} w-40`}
          />
          <button
            onClick={addVehicle}
            disabled={!addInput.trim() || ids.length >= 4}
            className="h-8 px-3 text-sm rounded bg-[var(--gold)]/15 text-[var(--gold)] hover:bg-[var(--gold)]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer border-none font-medium"
          >
            + Add
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-[var(--text-secondary)]">
          Loading vehicles...
        </div>
      )}

      {!loading && vehicles.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
          <p className="text-lg mb-2">No vehicles to compare.</p>
          <p className="text-sm text-[var(--text-muted)]">
            Add listing IDs above or navigate from the Dashboard with ?ids=id1,id2
          </p>
        </div>
      )}

      {!loading && vehicles.length > 0 && (
        <>
          {/* Vehicle cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vehicles.map((v, i) => {
              const photos = parseJsonArray(v.photos);
              const photo = photos.length > 0 ? photos[0] : null;
              return (
                <div
                  key={v.id}
                  className="rounded border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
                >
                  {/* Photo */}
                  <div className="h-40 bg-[var(--bg-elevated)] flex items-center justify-center relative">
                    {photo ? (
                      <img
                        src={photo}
                        alt={`${v.year} ${v.make} ${v.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[var(--text-muted)] text-sm">
                        No photo
                      </span>
                    )}
                    {/* Color indicator */}
                    <div
                      className="absolute top-2 left-2 w-3 h-3 rounded-full border-2 border-white"
                      style={{ background: RADAR_COLORS[i] }}
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => removeVehicle(v.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--bg-base)]/80 text-[var(--text-muted)] hover:text-[var(--red)] flex items-center justify-center text-xs cursor-pointer border-none transition-colors"
                      title="Remove from comparison"
                    >
                      &times;
                    </button>
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <div className="font-medium text-sm text-[var(--text-primary)]">
                      {v.year} {v.make} {v.model}
                    </div>
                    <div className="flex items-center gap-2">
                      <DealBadge rating={v.value_rating} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="mono text-sm font-semibold text-[var(--text-primary)]">
                        {fmt$(v.asking_price)}
                      </span>
                      <span className="mono text-xs text-[var(--text-muted)]">
                        {fmtMi(v.mileage)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Radar chart */}
          {radarData && (
            <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-4">
                Performance Radar
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#1e1e24" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: '#888', fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: '#555', fontSize: 10 }}
                    axisLine={false}
                  />
                  {vehicles.map((v, i) => (
                    <Radar
                      key={v.id}
                      name={`${v.year} ${v.make} ${v.model}`}
                      dataKey={`v${i}`}
                      stroke={RADAR_COLORS[i]}
                      fill={RADAR_COLORS[i]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: '12px', color: '#888' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison table */}
          <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Spec Comparison
              </span>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <th className="px-4 py-2 w-36">Attribute</th>
                  {vehicles.map((v, i) => (
                    <th key={v.id} className="px-4 py-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5"
                        style={{ background: RADAR_COLORS[i] }}
                      />
                      {v.year} {v.make} {v.model}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMP_ROWS.map((row) => {
                  const winnerIdx = findWinnerIdx(vehicles, row);
                  return (
                    <tr
                      key={row.label}
                      className="border-b border-[var(--border)] last:border-b-0"
                    >
                      <td className="px-4 py-2 text-[var(--text-secondary)]">
                        {row.label}
                      </td>
                      {vehicles.map((v, i) => {
                        const val = row.getValue(v);
                        const isWinner = winnerIdx === i && vehicles.length > 1;
                        const displayVal =
                          row.label === 'Price' || row.label === 'Market Value'
                            ? fmt$(val as number | null)
                            : row.label === 'Mileage'
                              ? fmtMi(val as number | null)
                              : formatCell(val, row.numeric);
                        return (
                          <td
                            key={v.id}
                            className={`px-4 py-2 ${row.numeric ? 'mono' : ''} ${
                              isWinner
                                ? 'text-[var(--green)] font-semibold'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 3-Year TCO comparison */}
          {hasTco && (
            <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  3-Year Total Cost of Ownership
                </span>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                    <th className="px-4 py-2 w-36">Period</th>
                    {vehicles.map((v, i) => (
                      <th key={v.id} className="px-4 py-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{ background: RADAR_COLORS[i] }}
                        />
                        {v.year} {v.make} {v.model}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['Purchase Price', 'Year 1 Repairs', 'Year 2 Repairs', 'Year 3 Repairs', 'Total TCO'] as const).map(
                    (period) => {
                      const values = vehicles.map((v, i) => {
                        const f = forecasts[i];
                        switch (period) {
                          case 'Purchase Price':
                            return v.asking_price;
                          case 'Year 1 Repairs':
                            return f?.cost_summary?.year_1 ?? null;
                          case 'Year 2 Repairs':
                            return f?.cost_summary?.year_2 ?? null;
                          case 'Year 3 Repairs':
                            return f?.cost_summary?.year_3 ?? null;
                          case 'Total TCO':
                            if (!f?.cost_summary) return null;
                            return (v.asking_price || 0) + f.cost_summary.total;
                        }
                      });
                      const numericVals = values.filter(
                        (v): v is number => v != null,
                      );
                      const bestVal =
                        numericVals.length > 0
                          ? Math.min(...numericVals)
                          : null;
                      return (
                        <tr
                          key={period}
                          className={`border-b border-[var(--border)] last:border-b-0 ${
                            period === 'Total TCO' ? 'font-semibold' : ''
                          }`}
                        >
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {period}
                          </td>
                          {values.map((val, i) => (
                            <td
                              key={vehicles[i].id}
                              className={`px-4 py-2 mono ${
                                val != null &&
                                bestVal != null &&
                                val === bestVal &&
                                vehicles.length > 1
                                  ? 'text-[var(--green)]'
                                  : period === 'Total TCO'
                                    ? 'text-[var(--gold)]'
                                    : 'text-[var(--text-primary)]'
                              }`}
                            >
                              {fmt$(val)}
                            </td>
                          ))}
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
