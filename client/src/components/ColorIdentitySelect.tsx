import { useEffect, useMemo, useRef, useState } from 'react';
import { ManaSymbol } from './ManaSymbol';

export type ColorOption = {
  value: string;
  label: string;
  colors: string[] | null;
};

type WubrgColor = 'W' | 'U' | 'B' | 'R' | 'G';
const WUBRG_INDEX: Record<WubrgColor, number> = {
  W: 0,
  U: 1,
  B: 2,
  R: 3,
  G: 4
};

const COLOR_OPTIONS: ColorOption[] = [
  { value: '', label: 'No color identity', colors: null },
  { value: 'C', label: 'Colorless', colors: [] },
  { value: 'W', label: 'White', colors: ['W'] },
  { value: 'U', label: 'Blue', colors: ['U'] },
  { value: 'B', label: 'Black', colors: ['B'] },
  { value: 'R', label: 'Red', colors: ['R'] },
  { value: 'G', label: 'Green', colors: ['G'] },
  { value: 'WU', label: 'Azorius', colors: ['W', 'U'] },
  { value: 'UB', label: 'Dimir', colors: ['U', 'B'] },
  { value: 'BR', label: 'Rakdos', colors: ['B', 'R'] },
  { value: 'RG', label: 'Gruul', colors: ['R', 'G'] },
  { value: 'GW', label: 'Selesnya', colors: ['G', 'W'] },
  { value: 'WB', label: 'Orzhov', colors: ['W', 'B'] },
  { value: 'UR', label: 'Izzet', colors: ['U', 'R'] },
  { value: 'BG', label: 'Golgari', colors: ['B', 'G'] },
  { value: 'RW', label: 'Boros', colors: ['R', 'W'] },
  { value: 'GU', label: 'Simic', colors: ['G', 'U'] },
  { value: 'WUB', label: 'Esper', colors: ['W', 'U', 'B'] },
  { value: 'UBR', label: 'Grixis', colors: ['U', 'B', 'R'] },
  { value: 'BRG', label: 'Jund', colors: ['B', 'R', 'G'] },
  { value: 'RGW', label: 'Naya', colors: ['R', 'G', 'W'] },
  { value: 'GWU', label: 'Bant', colors: ['G', 'W', 'U'] },
  { value: 'WBG', label: 'Abzan', colors: ['W', 'B', 'G'] },
  { value: 'URW', label: 'Jeskai', colors: ['U', 'R', 'W'] },
  { value: 'BGU', label: 'Sultai', colors: ['B', 'G', 'U'] },
  { value: 'RWB', label: 'Mardu', colors: ['R', 'W', 'B'] },
  { value: 'GRU', label: 'Temur', colors: ['G', 'R', 'U'] },
  { value: 'UBRG', label: 'Glint-Eye', colors: ['U', 'B', 'R', 'G'] },
  { value: 'BRGW', label: 'Dune-Brood', colors: ['B', 'R', 'G', 'W'] },
  { value: 'RGWU', label: 'Ink-Treader', colors: ['R', 'G', 'W', 'U'] },
  { value: 'GWUB', label: 'Witch-Maw', colors: ['G', 'W', 'U', 'B'] },
  { value: 'WUBR', label: 'Yore-Tiller', colors: ['W', 'U', 'B', 'R'] },
  { value: 'WUBRG', label: 'Maelstrom', colors: ['W', 'U', 'B', 'R', 'G'] }
];

const COLOR_IDENTITY_DISPLAY_MAP: Record<string, string[]> = COLOR_OPTIONS.reduce((map, option) => {
  if (!option.colors) {
    return map;
  }
  const key =
    option.colors.length === 0
      ? 'C'
      : [...option.colors]
          .sort((a, b) => WUBRG_INDEX[a as WubrgColor] - WUBRG_INDEX[b as WubrgColor])
          .join('');
  map[key] = option.colors;
  return map;
}, {} as Record<string, string[]>);

export function sortColorsForDisplay(colors: string[]): string[] {
  if (colors.length === 0) return ['C'];
  const key = [...colors]
    .filter((color) => color !== 'C')
    .sort((a, b) => WUBRG_INDEX[a as WubrgColor] - WUBRG_INDEX[b as WubrgColor])
    .join('');
  return COLOR_IDENTITY_DISPLAY_MAP[key] ?? colors;
}

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
};

export function ColorIdentitySelect({ label, value, onChange }: ColorIdentitySelectProps) {
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
