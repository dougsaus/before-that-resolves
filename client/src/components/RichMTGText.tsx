import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ManaSymbol } from './ManaSymbol';

interface RichMTGTextProps {
  text: string;
}

function renderManaSymbols(value: string): React.ReactNode[] {
  const parts = value.split(/(\{[^}]+\})/g);
  return parts.map((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      return <ManaSymbol key={`mana-${index}`} symbol={part} size="small" />;
    }
    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
}

function renderInline(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') {
    return renderManaSymbols(node);
  }
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={`inline-${index}`}>{renderInline(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return React.cloneElement(element, {
      children: renderInline(element.props.children)
    });
  }
  return node;
}

function getTextContent(node: React.ReactNode): string {
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getTextContent(element.props.children);
  }
  return '';
}

function getScryfallImageUrl(cardName: string) {
  const encoded = encodeURIComponent(cardName.trim());
  return `https://api.scryfall.com/cards/named?exact=${encoded}&format=image&version=normal`;
}

export function RichMTGText({ text }: RichMTGTextProps) {
  const [hoverCard, setHoverCard] = useState<{
    label: string;
    href?: string;
    rect: DOMRect;
  } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  const imageUrl = useMemo(() => {
    if (!hoverCard?.label) return null;
    return getScryfallImageUrl(hoverCard.label);
  }, [hoverCard?.label]);

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const hoverPosition = useMemo(() => {
    if (!hoverCard) return null;
    const margin = 12;
    const popupWidth = 272;
    const popupHeight = 360;

    let left = hoverCard.rect.left + hoverCard.rect.width / 2 - popupWidth / 2;
    left = Math.max(margin, Math.min(left, viewport.width - popupWidth - margin));

    let top = hoverCard.rect.top - popupHeight - margin;
    if (top < margin) {
      top = hoverCard.rect.bottom + margin;
    }

    return { left, top };
  }, [hoverCard, viewport.height, viewport.width]);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHoverCard(null);
    }, 250);
  };

  useEffect(() => {
    if (!hoverCard) return;

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const overAnchor = anchorRef.current?.contains(target || null);
      const overPopup = popupRef.current?.contains(target || null);
      if (!overAnchor && !overPopup) {
        scheduleHide();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [hoverCard]);

  return (
    <div className="text-gray-100 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3">{renderInline(children)}</p>,
          li: ({ children }) => <li className="mb-1">{renderInline(children)}</li>,
          strong: ({ children }) => <strong>{renderInline(children)}</strong>,
          em: ({ children }) => <em>{renderInline(children)}</em>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-3">{renderInline(children)}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{renderInline(children)}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{renderInline(children)}</h3>,
          a: ({ href, children }) => {
            const label = getTextContent(children);
            return (
              <span className="inline-flex items-center">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-200 hover:text-cyan-100 underline underline-offset-2"
                  onMouseEnter={(event) => {
                    if (!label) return;
                    clearHideTimer();
                    anchorRef.current = event.currentTarget;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setHoverCard({ label, href, rect });
                  }}
                  onMouseLeave={scheduleHide}
                >
                  {label || children}
                </a>
              </span>
            );
          },
          code: (props) => {
            const { inline, children } = props as {
              inline?: boolean;
              children?: React.ReactNode;
            };
            return inline ? (
              <code className="px-1 py-0.5 rounded bg-gray-800 text-gray-100">{children}</code>
            ) : (
              <pre className="rounded bg-gray-800 p-3 overflow-x-auto">
                <code className="text-gray-100">{children}</code>
              </pre>
            );
          }
        }}
      >
        {text}
      </ReactMarkdown>
      {hoverCard && imageUrl && hoverPosition && createPortal(
        <div
          className="fixed z-50"
          style={{ left: hoverPosition.left, top: hoverPosition.top }}
          onMouseEnter={() => clearHideTimer()}
          onMouseLeave={scheduleHide}
          ref={popupRef}
        >
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-2xl">
            <img
              src={imageUrl}
              alt={hoverCard.label}
              className="h-auto w-auto max-h-80 max-w-64 rounded object-contain"
              loading="lazy"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
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
