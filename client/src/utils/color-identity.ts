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

export const COLOR_OPTIONS: ColorOption[] = [
  { value: '', label: 'No color identity', colors: null },
  { value: 'C', label: 'Colorless', colors: [] },
  { value: 'W', label: 'Mono White', colors: ['W'] },
  { value: 'U', label: 'Mono Blue', colors: ['U'] },
  { value: 'B', label: 'Mono Black', colors: ['B'] },
  { value: 'R', label: 'Mono Red', colors: ['R'] },
  { value: 'G', label: 'Mono Green', colors: ['G'] },
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

export function getColorIdentityLabel(colors: string[] | null): string {
  if (colors === null) return '—';
  const key = colors.length === 0 ? 'C' : sortColorsForDisplay(colors).join('');
  const match = COLOR_OPTIONS.find((option) => {
    if (!option.colors) return false;
    const optionKey =
      option.colors.length === 0 ? 'C' : sortColorsForDisplay(option.colors).join('');
    return optionKey === key;
  });
  return match?.label ?? 'Color Identity';
}
