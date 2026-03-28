import { useState, useEffect } from 'react';

export interface Filters {
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  priceMax: string;
  mileageMax: string;
  titleStatus: string;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const TITLE_OPTIONS = ['', 'Clean', 'Rebuilt', 'Salvage', 'Lemon', 'Other'];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [local, setLocal] = useState<Filters>(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  function update(field: keyof Filters, value: string) {
    const next = { ...local, [field]: value };
    setLocal(next);
    onChange(next);
  }

  const inputClass =
    'h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-dim)] transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-4 border-b border-[var(--border)]">
      <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mr-1">
        Filters
      </span>

      <input
        type="text"
        placeholder="Make"
        value={local.make}
        onChange={(e) => update('make', e.target.value)}
        className={`${inputClass} w-28`}
      />

      <input
        type="text"
        placeholder="Model"
        value={local.model}
        onChange={(e) => update('model', e.target.value)}
        className={`${inputClass} w-28`}
      />

      <div className="flex items-center gap-1">
        <input
          type="number"
          placeholder="Year min"
          value={local.yearMin}
          onChange={(e) => update('yearMin', e.target.value)}
          className={`${inputClass} w-24`}
        />
        <span className="text-[var(--text-muted)] text-xs">-</span>
        <input
          type="number"
          placeholder="Year max"
          value={local.yearMax}
          onChange={(e) => update('yearMax', e.target.value)}
          className={`${inputClass} w-24`}
        />
      </div>

      <input
        type="number"
        placeholder="Max price"
        value={local.priceMax}
        onChange={(e) => update('priceMax', e.target.value)}
        className={`${inputClass} w-28`}
      />

      <input
        type="number"
        placeholder="Max miles"
        value={local.mileageMax}
        onChange={(e) => update('mileageMax', e.target.value)}
        className={`${inputClass} w-28`}
      />

      <select
        value={local.titleStatus}
        onChange={(e) => update('titleStatus', e.target.value)}
        className={`${inputClass} w-28`}
      >
        <option value="">Title status</option>
        {TITLE_OPTIONS.filter(Boolean).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {Object.values(local).some(Boolean) && (
        <button
          onClick={() => {
            const cleared: Filters = {
              make: '',
              model: '',
              yearMin: '',
              yearMax: '',
              priceMax: '',
              mileageMax: '',
              titleStatus: '',
            };
            setLocal(cleared);
            onChange(cleared);
          }}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors ml-1 cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
