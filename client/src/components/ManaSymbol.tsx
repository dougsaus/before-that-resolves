interface ManaSymbolProps {
  symbol: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

export function ManaSymbol({ symbol, size = 'medium' }: ManaSymbolProps) {
  // Map MTG symbols to Mana font classes
  const symbolMap: Record<string, string> = {
    // Basic mana
    '{W}': 'ms-w',
    '{U}': 'ms-u',
    '{B}': 'ms-b',
    '{R}': 'ms-r',
    '{G}': 'ms-g',
    '{C}': 'ms-c',

    // Generic mana
    '{0}': 'ms-0',
    '{1}': 'ms-1',
    '{2}': 'ms-2',
    '{3}': 'ms-3',
    '{4}': 'ms-4',
    '{5}': 'ms-5',
    '{6}': 'ms-6',
    '{7}': 'ms-7',
    '{8}': 'ms-8',
    '{9}': 'ms-9',
    '{10}': 'ms-10',
    '{11}': 'ms-11',
    '{12}': 'ms-12',
    '{13}': 'ms-13',
    '{14}': 'ms-14',
    '{15}': 'ms-15',
    '{16}': 'ms-16',
    '{17}': 'ms-17',
    '{18}': 'ms-18',
    '{19}': 'ms-19',
    '{20}': 'ms-20',

    // Variable/special
    '{X}': 'ms-x',
    '{Y}': 'ms-y',
    '{Z}': 'ms-z',

    // Hybrid mana
    '{W/U}': 'ms-wu',
    '{U/B}': 'ms-ub',
    '{B/R}': 'ms-br',
    '{R/G}': 'ms-rg',
    '{G/W}': 'ms-gw',
    '{W/B}': 'ms-wb',
    '{U/R}': 'ms-ur',
    '{B/G}': 'ms-bg',
    '{R/W}': 'ms-rw',
    '{G/U}': 'ms-gu',

    // Phyrexian mana
    '{W/P}': 'ms-wp',
    '{U/P}': 'ms-up',
    '{B/P}': 'ms-bp',
    '{R/P}': 'ms-rp',
    '{G/P}': 'ms-gp',

    // Hybrid/Phyrexian
    '{W/U/P}': 'ms-wup',
    '{U/B/P}': 'ms-ubp',
    '{B/R/P}': 'ms-brp',
    '{R/G/P}': 'ms-rgp',
    '{G/W/P}': 'ms-gwp',

    // Special symbols
    '{T}': 'ms-tap',
    '{Q}': 'ms-untap',
    '{E}': 'ms-e',
    '{S}': 'ms-s',
    '{CHAOS}': 'ms-chaos',
    '{A}': 'ms-acorn',

    // Planeswalker symbols
    '{PW}': 'ms-planeswalker',
    '{+1}': 'ms-loyalty-up ms-loyalty-1',
    '{-1}': 'ms-loyalty-down ms-loyalty-1',
    '{+2}': 'ms-loyalty-up ms-loyalty-2',
    '{-2}': 'ms-loyalty-down ms-loyalty-2',
    '{-3}': 'ms-loyalty-down ms-loyalty-3',
    '{-4}': 'ms-loyalty-down ms-loyalty-4',
    '{-5}': 'ms-loyalty-down ms-loyalty-5',
    '{-6}': 'ms-loyalty-down ms-loyalty-6',
    '{-7}': 'ms-loyalty-down ms-loyalty-7',
    '{-8}': 'ms-loyalty-down ms-loyalty-8',
    '{-X}': 'ms-loyalty-down ms-loyalty-x',
    '{0L}': 'ms-loyalty-zero ms-loyalty-0',
  };

  const manaClass = symbolMap[symbol.toUpperCase()] || '';

  if (!manaClass) {
    // If symbol not found, return the text as-is
    return <span>{symbol}</span>;
  }

  const sizeClass = {
    small: 'ms-cost',
    medium: '',
    large: 'ms-2x',
    xlarge: 'ms-3x'
  }[size];

  return (
    <i
      className={`ms ${manaClass} ${sizeClass} ms-shadow`}
      title={symbol}
      aria-label={symbol}
    />
  );
}

interface ManaCostProps {
  cost: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

export function ManaCost({ cost, size = 'small' }: ManaCostProps) {
  // Parse mana cost string and render each symbol
  const symbols = cost.match(/\{[^}]+\}/g) || [];

  if (symbols.length === 0) {
    return <span>{cost}</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} size={size} />
      ))}
    </span>
  );
}