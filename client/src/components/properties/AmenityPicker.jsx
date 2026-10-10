import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import clsx from 'clsx';
import { COMMON_AMENITIES } from '../../config/propertyStructures.js';

// Pick facilities with one tap, or type your own. `value` is a list of names.
export function AmenityPicker({ label = 'Facilities', hint, value, onChange, options: suggested = COMMON_AMENITIES, placeholder = 'Add another facility…' }) {
  const [custom, setCustom] = useState('');
  const chosen = new Set(value);
  const options = [...suggested, ...value.filter((v) => !suggested.includes(v))];

  const toggle = (name) => {
    const next = new Set(chosen);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange([...next]);
  };
  const addCustom = () => {
    const name = custom.trim().slice(0, 60);
    if (name && !chosen.has(name)) onChange([...value, name]);
    setCustom('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((name) => {
          const on = chosen.has(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(name)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                on
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              )}
            >
              {on && <Check size={12} aria-hidden="true" />}
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder={placeholder}
          maxLength={60}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button type="button" onClick={addCustom} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <Plus size={14} aria-hidden="true" />Add
        </button>
      </div>
    </div>
  );
}
