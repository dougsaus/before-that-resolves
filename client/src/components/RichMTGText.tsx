import React from 'react';
import { ManaSymbol, ManaCost } from './ManaSymbol';

interface RichMTGTextProps {
  text: string;
}

export function RichMTGText({ text }: RichMTGTextProps) {
  // Process the text to handle various formatting
  const processText = (input: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let key = 0;

    // Split by lines first to preserve line breaks
    const lines = input.split('\n');

    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        elements.push(<br key={`br-${key++}`} />);
      }

      // Process each line for formatting
      let processedLine = line;
      const lineElements: React.ReactNode[] = [];

      // Pattern to match various elements we want to format
      // This regex matches: headers, mana symbols, bold text, italic text, or regular text
      const pattern = /(^#{1,6}\s+.+$)|(\{[^}]+\})|(\*\*[^*]+\*\*)|(\*[^*]+\*)|([^{*#]+)/gm;
      let match;

      while ((match = pattern.exec(processedLine)) !== null) {
        const [fullMatch, header, manaSymbol, boldText, italicText] = match;

        if (header) {
          // It's a markdown header
          const level = header.match(/^(#{1,6})/)?.[0].length || 3;
          const text = header.replace(/^#{1,6}\s+/, '');

          if (level === 3) {
            lineElements.push(<h3 key={`header-${key++}`} className="font-bold text-lg mb-2">{text}</h3>);
          } else if (level === 2) {
            lineElements.push(<h2 key={`header-${key++}`} className="font-bold text-xl mb-2">{text}</h2>);
          } else {
            lineElements.push(<h4 key={`header-${key++}`} className="font-bold mb-1">{text}</h4>);
          }
        } else if (manaSymbol) {
          // It's a mana symbol - replace with icon
          lineElements.push(
            <ManaSymbol key={`mana-${key++}`} symbol={manaSymbol} size="small" />
          );
        } else if (boldText) {
          // Bold text (strip the ** markers)
          const text = boldText.slice(2, -2);
          lineElements.push(<strong key={`bold-${key++}`}>{text}</strong>);
        } else if (italicText) {
          // Italic text (strip the * markers)
          const text = italicText.slice(1, -1);
          lineElements.push(<em key={`italic-${key++}`}>{text}</em>);
        } else {
          // Regular text - keep as is
          lineElements.push(<span key={`text-${key++}`}>{fullMatch}</span>);
        }

      }

      elements.push(...lineElements);
    });

    return elements;
  };

  // Parse specific sections if they exist
  const renderSection = () => {
    // Check if this looks like a mana cost line
    if (text.includes('Mana Cost:')) {
      const parts = text.split('Mana Cost:');
      const beforeCost = parts[0];
      const afterCostParts = parts[1]?.split('\n') || [];
      const manaCostLine = afterCostParts[0];
      const restOfText = afterCostParts.slice(1).join('\n');

      return (
        <>
          {beforeCost && processText(beforeCost)}
          {manaCostLine && (
            <>
              <span className="font-semibold">Mana Cost: </span>
              <ManaCost cost={manaCostLine.trim()} />
              {restOfText && (
                <>
                  <br />
                  {processText(restOfText)}
                </>
              )}
            </>
          )}
        </>
      );
    }

    // Otherwise, process the entire text
    return processText(text);
  };

  return <div className="text-gray-100 leading-relaxed">{renderSection()}</div>;
}

// Additional component for rendering card names with appropriate styling
interface CardNameProps {
  name: string;
  legendary?: boolean;
}

export function CardName({ name, legendary = false }: CardNameProps) {
  const className = legendary
    ? 'font-bold text-yellow-400 text-lg'
    : 'font-bold text-white text-lg';

  return <h3 className={className}>{name}</h3>;
}

// Component for rendering card types
interface CardTypeProps {
  type: string;
}

export function CardType({ type }: CardTypeProps) {
  const isCreature = type.includes('Creature');
  const isPlaneswalker = type.includes('Planeswalker');
  const isLegendary = type.includes('Legendary');

  let className = 'font-medium ';
  if (isLegendary) className += 'text-yellow-300';
  else if (isPlaneswalker) className += 'text-purple-300';
  else if (isCreature) className += 'text-green-300';
  else className += 'text-gray-300';

  return <p className={className}>{type}</p>;
}

// Component for rendering power/toughness
interface PowerToughnessProps {
  power: string;
  toughness: string;
}

export function PowerToughness({ power, toughness }: PowerToughnessProps) {
  return (
    <span className="font-bold text-gray-200">
      {power}/{toughness}
    </span>
  );
}
