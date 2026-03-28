import { useState } from 'react';

interface ScamAlertProps {
  scamScore: number;
  scamFlags: string | null;
}

function parseFlags(raw: string | null): string[] {
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

export function ScamAlert({ scamScore, scamFlags }: ScamAlertProps) {
  const [expanded, setExpanded] = useState(false);
  const flags = parseFlags(scamFlags);

  if (scamScore <= 0 || flags.length === 0) return null;

  const isSevere = scamScore >= 60;
  const heading = isSevere ? 'SCAM ALERT' : 'CAUTION';

  return (
    <div
      className="rounded border cursor-pointer select-none"
      style={{
        background: `linear-gradient(135deg, rgba(232, 84, 84, ${isSevere ? 0.15 : 0.08}), transparent)`,
        borderColor: `rgba(232, 84, 84, ${isSevere ? 0.5 : 0.25})`,
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isSevere ? '\u26a0' : '\u26a0'}</span>
          <span
            className="text-sm font-bold uppercase tracking-wider"
            style={{ color: 'var(--red)' }}
          >
            {heading}
          </span>
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Score: {scamScore}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ({flags.length} flag{flags.length !== 1 ? 's' : ''})
          </span>
        </div>
        <span
          className="text-xs transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <ul className="space-y-1.5 m-0 p-0 list-none">
            {flags.map((flag, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--red)' }}
              >
                <span className="mt-0.5 flex-shrink-0">{'\u{1f6a9}'}</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
