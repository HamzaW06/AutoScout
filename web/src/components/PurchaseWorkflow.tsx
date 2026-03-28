import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface CheckItem {
  id: string;
  label: string;
}

interface Stage {
  id: string;
  title: string;
  icon: string;
  description: string;
  checks: CheckItem[];
}

const STAGES: Stage[] = [
  {
    id: 'found',
    title: 'Found It',
    icon: '1',
    description: 'Review the listing and verify key details.',
    checks: [
      { id: 'f1', label: 'Review listing photos carefully' },
      { id: 'f2', label: 'Check VIN against title and listing' },
      { id: 'f3', label: 'Verify mileage matches CarFax / records' },
      { id: 'f4', label: 'Review deal score and risk assessment' },
      { id: 'f5', label: 'Compare asking price to market value' },
      { id: 'f6', label: 'Check for price drop history' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact Seller',
    icon: '2',
    description: 'Reach out and gather more information.',
    checks: [
      { id: 'c1', label: 'Send initial inquiry message' },
      { id: 'c2', label: 'Ask about maintenance records' },
      { id: 'c3', label: 'Confirm vehicle availability' },
      { id: 'c4', label: 'Request additional photos if needed' },
      { id: 'c5', label: 'Ask about any known issues' },
    ],
  },
  {
    id: 'inspect',
    title: 'Inspect',
    icon: '3',
    description: 'Thorough inspection before committing.',
    checks: [
      { id: 'i1', label: 'Schedule test drive' },
      { id: 'i2', label: 'Check body panels for paint mismatch' },
      { id: 'i3', label: 'Inspect tires, brakes, suspension' },
      { id: 'i4', label: 'Listen for engine/transmission noises' },
      { id: 'i5', label: 'Check all electronics and A/C' },
      { id: 'i6', label: 'Get pre-purchase inspection (PPI)' },
      { id: 'i7', label: 'Pull OBD-II codes' },
    ],
  },
  {
    id: 'negotiate',
    title: 'Negotiate',
    icon: '4',
    description: 'Use data-driven tactics to get the best price.',
    checks: [
      { id: 'n1', label: 'Review negotiation tactics from AutoScout' },
      { id: 'n2', label: 'Start with low offer (offer_low)' },
      { id: 'n3', label: 'Mention specific issues found in inspection' },
      { id: 'n4', label: 'Reference comparable listings and market data' },
      { id: 'n5', label: 'Set walk-away price (offer_high max)' },
      { id: 'n6', label: 'Agree on final price in writing' },
    ],
  },
  {
    id: 'close',
    title: 'Close the Deal',
    icon: '5',
    description: 'Finalize paperwork and take delivery.',
    checks: [
      { id: 'd1', label: 'Verify clean title in hand' },
      { id: 'd2', label: 'Check for any liens on the vehicle' },
      { id: 'd3', label: 'Complete bill of sale' },
      { id: 'd4', label: 'Transfer title / registration' },
      { id: 'd5', label: 'Arrange insurance before driving' },
      { id: 'd6', label: 'Get copies of all signed documents' },
      { id: 'd7', label: 'Take delivery and final walk-around' },
    ],
  },
];

export function PurchaseWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState(0);
  const [expandedStage, setExpandedStage] = useState<number | null>(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggleCheck(checkId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }

  function stageProgress(stage: Stage): number {
    if (stage.checks.length === 0) return 0;
    const done = stage.checks.filter((c) => checked.has(c.id)).length;
    return Math.round((done / stage.checks.length) * 100);
  }

  function isStageComplete(stage: Stage): boolean {
    return stage.checks.every((c) => checked.has(c.id));
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Back to vehicle */}
        <button
          onClick={() => navigate(id ? `/vehicle/${id}` : '/')}
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] cursor-pointer bg-transparent border-none transition-colors"
        >
          {id ? '<- Back to vehicle' : '<- Back to dashboard'}
        </button>

        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] m-0 mb-1">
            Purchase Workflow
          </h2>
          <p className="text-sm text-[var(--text-secondary)] m-0">
            Follow these steps to evaluate and purchase this vehicle.
          </p>
        </div>

        {/* Step indicator - horizontal */}
        <div className="flex items-center gap-1">
          {STAGES.map((stage, i) => {
            const complete = isStageComplete(stage);
            const isCurrent = i === activeStage;
            return (
              <div key={stage.id} className="flex items-center flex-1">
                <button
                  onClick={() => {
                    setActiveStage(i);
                    setExpandedStage(i);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded w-full text-left cursor-pointer border transition-colors ${
                    isCurrent
                      ? 'border-[var(--gold-dim)] bg-[var(--gold)]/10'
                      : complete
                        ? 'border-[var(--green)]/30 bg-[var(--green)]/5'
                        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCurrent
                        ? 'bg-[var(--gold)] text-[#0a0a0c]'
                        : complete
                          ? 'bg-[var(--green)] text-[#0a0a0c]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]'
                    }`}
                  >
                    {complete ? '\u2713' : stage.icon}
                  </span>
                  <span
                    className={`text-xs font-medium truncate ${
                      isCurrent
                        ? 'text-[var(--gold)]'
                        : complete
                          ? 'text-[var(--green)]'
                          : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {stage.title}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <div
                    className={`w-4 h-px flex-shrink-0 ${
                      complete
                        ? 'bg-[var(--green)]/50'
                        : 'bg-[var(--border)]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Stage detail panels */}
        <div className="space-y-3">
          {STAGES.map((stage, i) => {
            const isExpanded = expandedStage === i;
            const progress = stageProgress(stage);
            const complete = isStageComplete(stage);

            return (
              <div
                key={stage.id}
                className={`rounded border transition-colors ${
                  complete
                    ? 'border-[var(--green)]/20'
                    : i === activeStage
                      ? 'border-[var(--gold-dim)]/40'
                      : 'border-[var(--border)]'
                } bg-[var(--bg-surface)]`}
              >
                {/* Stage header */}
                <button
                  onClick={() =>
                    setExpandedStage(isExpanded ? null : i)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer bg-transparent border-none text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        complete
                          ? 'bg-[var(--green)]/20 text-[var(--green)]'
                          : i === activeStage
                            ? 'bg-[var(--gold)]/15 text-[var(--gold)]'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                      }`}
                    >
                      {complete ? '\u2713' : stage.icon}
                    </span>
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          complete
                            ? 'text-[var(--green)]'
                            : i === activeStage
                              ? 'text-[var(--gold)]'
                              : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {stage.title}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] ml-2">
                        {stage.description}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {progress > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              complete
                                ? 'bg-[var(--green)]'
                                : 'bg-[var(--gold)]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="mono text-[10px] text-[var(--text-muted)]">
                          {progress}%
                        </span>
                      </div>
                    )}
                    <span
                      className={`text-xs text-[var(--text-muted)] transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      v
                    </span>
                  </div>
                </button>

                {/* Checklist (collapsible) */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]">
                    <div className="space-y-1.5 mt-2">
                      {stage.checks.map((check) => {
                        const isDone = checked.has(check.id);
                        return (
                          <label
                            key={check.id}
                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggleCheck(check.id)}
                              className="accent-[var(--gold)] w-4 h-4 cursor-pointer"
                            />
                            <span
                              className={`text-sm transition-colors ${
                                isDone
                                  ? 'text-[var(--text-muted)] line-through'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {check.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {complete && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            if (i < STAGES.length - 1) {
                              setActiveStage(i + 1);
                              setExpandedStage(i + 1);
                            }
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer border-none transition-colors ${
                            i < STAGES.length - 1
                              ? 'bg-[var(--gold)] text-[#0a0a0c] hover:bg-[var(--gold-dim)]'
                              : 'bg-[var(--green)] text-[#0a0a0c]'
                          }`}
                        >
                          {i < STAGES.length - 1
                            ? 'Continue to next step'
                            : 'Workflow Complete!'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall progress */}
        <div className="p-4 rounded border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Overall Progress
            </span>
            <span className="mono text-xs text-[var(--text-secondary)]">
              {checked.size} / {STAGES.reduce((a, s) => a + s.checks.length, 0)}{' '}
              tasks
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-all"
              style={{
                width: `${
                  (checked.size /
                    STAGES.reduce((a, s) => a + s.checks.length, 0)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
