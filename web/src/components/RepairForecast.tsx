interface RepairForecastProps {
  forecast: string | null; // JSON string from listings.repair_forecast
}

interface ImmediateRepair {
  item: string;
  estimated_cost: number;
  urgency: string;
}

interface MaintenanceItem {
  month: number;
  item: string;
  estimated_cost: number;
}

interface CostSummary {
  year_1: number;
  year_2: number;
  year_3: number;
  total: number;
}

interface ForecastData {
  immediate_repairs?: ImmediateRepair[];
  maintenance_timeline?: MaintenanceItem[];
  cost_summary?: CostSummary;
  parts_affordability_score?: number; // 0-100
  timing_system?: {
    type: string; // "chain" | "belt" | "gear"
    status: string; // "good" | "due_soon" | "overdue" | "unknown"
    next_service_miles?: number;
  };
}

function fmt$(n: number | null | undefined): string {
  if (n == null) return '--';
  return '$' + n.toLocaleString('en-US');
}

function parseForecast(raw: string | null): ForecastData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ForecastData;
  } catch {
    return null;
  }
}

const TIMING_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  good: { bg: 'bg-[var(--green)]/15', text: 'text-[var(--green)]', label: 'Good' },
  due_soon: { bg: 'bg-yellow-500/15', text: 'text-yellow-500', label: 'Due Soon' },
  overdue: { bg: 'bg-[var(--red)]/15', text: 'text-[var(--red)]', label: 'Overdue' },
  unknown: { bg: 'bg-neutral-500/15', text: 'text-neutral-400', label: 'Unknown' },
};

export function RepairForecast({ forecast }: RepairForecastProps) {
  const data = parseForecast(forecast);

  if (!data) {
    return (
      <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">
          Repair Forecast
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          No repair forecast data available for this vehicle.
        </p>
      </div>
    );
  }

  const hasImmediateRepairs =
    data.immediate_repairs && data.immediate_repairs.length > 0;

  return (
    <div className="space-y-4">
      {/* Immediate repairs */}
      {hasImmediateRepairs && (
        <div className="p-4 rounded border border-[var(--red)]/30 bg-[var(--red)]/5">
          <div className="text-xs uppercase tracking-wider text-[var(--red)] mb-3">
            Immediate Repairs Needed
          </div>
          <div className="space-y-2">
            {data.immediate_repairs!.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border)]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[var(--red)]">!</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {r.item}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] uppercase font-semibold rounded ${
                      r.urgency === 'critical'
                        ? 'bg-[var(--red)]/20 text-[var(--red)]'
                        : r.urgency === 'high'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-yellow-500/20 text-yellow-500'
                    }`}
                  >
                    {r.urgency}
                  </span>
                </div>
                <span className="mono text-sm font-medium text-[var(--red)]">
                  {fmt$(r.estimated_cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance timeline */}
      {data.maintenance_timeline && data.maintenance_timeline.length > 0 && (
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Next 12 Months Maintenance
          </div>
          <div className="space-y-1.5">
            {data.maintenance_timeline.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm"
              >
                <span className="mono text-xs text-[var(--text-muted)] w-16 flex-shrink-0">
                  Month {m.month}
                </span>
                <div className="w-2 h-2 rounded-full bg-[var(--blue)] flex-shrink-0" />
                <span className="text-[var(--text-secondary)] flex-1">
                  {m.item}
                </span>
                <span className="mono text-xs text-[var(--text-secondary)]">
                  {fmt$(m.estimated_cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost summary + Parts affordability + Timing system row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 3-year cost summary */}
        {data.cost_summary && (
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
              3-Year Cost Summary
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Year 1</span>
                <span className="mono text-[var(--text-primary)]">
                  {fmt$(data.cost_summary.year_1)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Year 2</span>
                <span className="mono text-[var(--text-primary)]">
                  {fmt$(data.cost_summary.year_2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Year 3</span>
                <span className="mono text-[var(--text-primary)]">
                  {fmt$(data.cost_summary.year_3)}
                </span>
              </div>
              <div className="h-px bg-[var(--border)] my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-[var(--text-primary)]">Total</span>
                <span className="mono text-[var(--gold)]">
                  {fmt$(data.cost_summary.total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Parts affordability score */}
        {data.parts_affordability_score != null && (
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Parts Affordability
            </div>
            <div className="flex flex-col items-center gap-2">
              <span
                className={`mono text-3xl font-bold ${
                  data.parts_affordability_score >= 70
                    ? 'text-[var(--green)]'
                    : data.parts_affordability_score >= 40
                      ? 'text-yellow-500'
                      : 'text-[var(--red)]'
                }`}
              >
                {data.parts_affordability_score}
              </span>
              <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.parts_affordability_score >= 70
                      ? 'bg-[var(--green)]'
                      : data.parts_affordability_score >= 40
                        ? 'bg-yellow-500'
                        : 'bg-[var(--red)]'
                  }`}
                  style={{
                    width: `${Math.min(data.parts_affordability_score, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {data.parts_affordability_score >= 70
                  ? 'Parts are affordable'
                  : data.parts_affordability_score >= 40
                    ? 'Moderate parts cost'
                    : 'Expensive parts'}
              </span>
            </div>
          </div>
        )}

        {/* Timing system */}
        {data.timing_system && (
          <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Timing System
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  Type:
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
                  {data.timing_system.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  Status:
                </span>
                {(() => {
                  const style =
                    TIMING_STATUS_COLORS[data.timing_system!.status] ??
                    TIMING_STATUS_COLORS.unknown;
                  return (
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                  );
                })()}
              </div>
              {data.timing_system.next_service_miles != null && (
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Next service:{' '}
                  <span className="mono">
                    {data.timing_system.next_service_miles.toLocaleString()} mi
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
