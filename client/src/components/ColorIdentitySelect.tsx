import { useEffect, useMemo, useRef, useState } from 'react';
import { ManaSymbol } from './ManaSymbol';
import { COLOR_OPTIONS, sortColorsForDisplay } from '../utils/color-identity';

export function ColorIdentityIcons({ colors }: { colors: string[] }) {
  const displayColors = sortColorsForDisplay(colors);
  return (
    <span className="inline-flex items-center gap-1">
      {displayColors.map((color) => (
        <ManaSymbol key={color} symbol={`{${color}}`} size="small" />
      ))}
    </span>
  );
}

type ColorIdentitySelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
};

export function ColorIdentitySelect({ label, value, onChange, onFocus }: ColorIdentitySelectProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => COLOR_OPTIONS, []);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm text-gray-300">{label}</span>}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          onFocus={onFocus}
          className="flex w-full items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left text-sm text-gray-200 hover:border-gray-600"
        >
          <span className="flex items-center gap-2">
            {selected.colors && <ColorIdentityIcons colors={selected.colors} />}
            <span className="text-gray-300">{selected.label}</span>
          </span>
          <span className="text-xs text-gray-400">{open ? 'Close' : 'Select'}</span>
        </button>
        {open && (
          <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-950/95 p-2 shadow-lg">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-800 ${
                  option.value === selected.value ? 'bg-gray-800 text-white' : 'text-gray-200'
                }`}
              >
                {option.colors && <ColorIdentityIcons colors={option.colors} />}
                <span className="text-gray-300">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
