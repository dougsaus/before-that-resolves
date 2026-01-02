import { scryfallService } from './scryfall';
import { marked } from 'marked';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

type ChatMessage = {
  role: 'user' | 'agent' | 'error';
  content: string;
};

type PdfInput = {
  title?: string;
  subtitle?: string;
  deckUrl?: string;
  messages: ChatMessage[];
};

type CardImage = {
  name: string;
  dataUrl: string;
};

const MAX_FOOTNOTE_CARDS = 150;
const SCRYFALL_COLLECTION_LIMIT = 75;

const manaSymbolMap: Record<string, string> = {
  '{W}': 'ms-w',
  '{U}': 'ms-u',
  '{B}': 'ms-b',
  '{R}': 'ms-r',
  '{G}': 'ms-g',
  '{C}': 'ms-c',
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
  '{X}': 'ms-x',
  '{Y}': 'ms-y',
  '{Z}': 'ms-z',
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
  '{W/P}': 'ms-wp',
  '{U/P}': 'ms-up',
  '{B/P}': 'ms-bp',
  '{R/P}': 'ms-rp',
  '{G/P}': 'ms-gp',
  '{W/U/P}': 'ms-wup',
  '{U/B/P}': 'ms-ubp',
  '{B/R/P}': 'ms-brp',
  '{R/G/P}': 'ms-rgp',
  '{G/W/P}': 'ms-gwp',
  '{T}': 'ms-tap',
  '{Q}': 'ms-untap',
  '{E}': 'ms-e',
  '{S}': 'ms-s',
  '{CHAOS}': 'ms-chaos',
  '{A}': 'ms-acorn',
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
  '{0L}': 'ms-loyalty-zero ms-loyalty-0'
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCardName(name: string) {
  return name.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeMarkdownLinks(value: string) {
  const cleaned = value.replace(/\\n/g, ' ');
  return cleaned.replace(/\[([\s\S]*?)\]\(([\s\S]*?)\)/g, (_match, label, url) => {
    const normalizedLabel = String(label).replace(/\s+/g, ' ').trim();
    const urlWithSpaces = String(url).replace(/\s+/g, ' ').trim();
    const normalizedUrl = urlWithSpaces.replace(/ /g, '%20');
    return `[${normalizedLabel}](${normalizedUrl})`;
  });
}

function replaceManaSymbols(html: string) {
  const normalized = html.replace(/&#123;/g, '{').replace(/&#125;/g, '}');
  return normalized.replace(/\{[^}]+\}/g, (token) => {
    const className = manaSymbolMap[token.toUpperCase()];
    if (!className) return token;
    return `<span class="ms ${className} ms-cost ms-shadow" aria-label="${escapeHtml(
      token
    )}"></span>`;
  });
}

async function loadManaFontCss() {
  try {
    const require = createRequire(__filename);
    const cssPath = require.resolve('mana-font/css/mana.css');
    const rawCss = await fs.readFile(cssPath, 'utf8');
    const fontsDir = path.resolve(path.dirname(cssPath), '../fonts');
    const fontMimeTypes: Record<string, string> = {
      eot: 'application/vnd.ms-fontobject',
      woff: 'font/woff',
      ttf: 'font/ttf',
      svg: 'image/svg+xml'
    };

    const fontCache = new Map<string, string>();
    const fontRegex = /url\((\"|')?\.\.\/fonts\/([^\"')]+)(\?[^\"')]+)?(\"|')?\)/g;
    const matches = Array.from(rawCss.matchAll(fontRegex));

    for (const match of matches) {
      const fileName = String(match[2]);
      const cleanName = fileName.split('?')[0];
      if (fontCache.has(cleanName)) {
        continue;
      }
      const filePath = path.join(fontsDir, cleanName);
      try {
        const fileBuffer = await fs.readFile(filePath);
        const extension = cleanName.split('.').pop()?.toLowerCase() || '';
        const mimeType = fontMimeTypes[extension] || 'application/octet-stream';
        const base64 = fileBuffer.toString('base64');
        fontCache.set(cleanName, `data:${mimeType};base64,${base64}`);
      } catch (error) {
        const fallbackUrl = pathToFileURL(filePath).toString();
        fontCache.set(cleanName, fallbackUrl);
      }
    }

    return rawCss.replace(fontRegex, (_match, _q1, fileName) => {
      const cleanName = String(fileName).split('?')[0];
      const dataUrl = fontCache.get(cleanName);
      return dataUrl ? `url("${dataUrl}")` : _match;
    });
  } catch (error) {
    console.warn('⚠️ Mana font CSS not found, mana symbols may not render.');
    return '';
  }
}

function renderMarkdownSafe(text: string) {
  const normalized = normalizeMarkdownLinks(text || '');
  const escaped = normalized.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = marked.parse(escaped, { breaks: true }) as string;
  return replaceManaSymbols(html);
}

export function extractScryfallCardNames(messages: ChatMessage[]) {
  const names = new Set<string>();
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/scryfall\.com\/[^)]+)\)/gi;

  for (const message of messages) {
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(message.content)) !== null) {
      const rawName = match[1];
      const normalized = normalizeCardName(rawName);
      if (normalized) {
        names.add(normalized);
      }
    }
  }

  return Array.from(names);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchImageData(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function resolveCardImages(cardNames: string[]): Promise<CardImage[]> {
  if (cardNames.length === 0) return [];

  const limitedNames = cardNames.slice(0, MAX_FOOTNOTE_CARDS);
  const chunks = chunkArray(limitedNames, SCRYFALL_COLLECTION_LIMIT);
  const images: CardImage[] = [];

  for (const chunk of chunks) {
    const { cards } = await scryfallService.getCardCollection(chunk);
    for (const card of cards) {
      const imageUrl =
        card.image_uris?.large ||
        card.image_uris?.normal ||
        card.image_uris?.small ||
        card.image_uris?.art_crop;
      if (!imageUrl) continue;
      try {
        const dataUrl = await fetchImageData(imageUrl);
        images.push({ name: card.name, dataUrl });
      } catch (error) {
        console.warn(`⚠️ Failed to fetch image for ${card.name}`);
      }
    }
  }

  return images;
}

async function buildChatHtml(input: PdfInput, cardImages: CardImage[]) {
  const title = escapeHtml(input.title || 'Before That Resolves');
  const subtitle = escapeHtml(input.subtitle || 'Commander Deck Analyzer & Strategy Assistant');
  const deckUrl = input.deckUrl?.trim();
  const manaCss = await loadManaFontCss();

  const messageHtml = input.messages
    .map((message) => {
      const roleClass = message.role === 'user' ? 'user' : message.role === 'error' ? 'error' : 'agent';
      const alignment = message.role === 'user' ? 'end' : 'start';
      const content =
        message.role === 'agent'
          ? renderMarkdownSafe(message.content)
          : `<p>${escapeHtml(message.content)}</p>`;
      return `
        <div class="message-row ${alignment}">
          <div class="bubble ${roleClass}">
            ${content}
          </div>
        </div>
      `;
    })
    .join('');

  const footnoteHtml =
    cardImages.length > 0
      ? `
        <section class="footnotes">
          <h2>Referenced Cards</h2>
          <div class="card-grid">
            ${cardImages
              .map(
                (card) => `
              <figure class="card-tile">
                <img src="${card.dataUrl}" alt="${escapeHtml(card.name)}" />
                <figcaption>${escapeHtml(card.name)}</figcaption>
              </figure>
            `
              )
              .join('')}
          </div>
        </section>
      `
      : '';

  const deckHtml = deckUrl
    ? `
      <div class="deck-line">
        Deck: <a href="${deckUrl}" target="_blank" rel="noreferrer">${escapeHtml(deckUrl)}</a>
      </div>
    `
    : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          ${manaCss}
          * { box-sizing: border-box; }
          body {
            font-family: "Helvetica Neue", Arial, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            margin: 0;
            padding: 32px;
          }
          h1 { font-size: 28px; margin: 0 0 8px; }
          h2 { font-size: 20px; margin: 24px 0 16px; color: #f1f5f9; }
          .subtitle { color: #94a3b8; margin-bottom: 24px; }
          .deck-line {
            font-size: 13px;
            color: #cbd5f5;
            margin-bottom: 20px;
          }
          .deck-line a { color: #7dd3fc; word-break: break-all; }
          .chat {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .message-row {
            display: flex;
          }
          .message-row.start { justify-content: flex-start; }
          .message-row.end { justify-content: flex-end; }
          .bubble {
            max-width: 90%;
            padding: 12px 16px;
            border-radius: 18px;
            line-height: 1.5;
            font-size: 14px;
            word-break: break-word;
          }
          .bubble.user { background: #2563eb; color: #fff; }
          .bubble.agent { background: rgba(148, 163, 184, 0.2); color: #e2e8f0; }
          .bubble.error { background: rgba(127, 29, 29, 0.7); color: #fecaca; border: 1px solid #b91c1c; }
          a { color: #7dd3fc; text-decoration: underline; }
          pre { background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 12px; overflow-x: auto; }
          .footnotes { margin-top: 32px; page-break-before: always; }
          .card-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          .card-tile {
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 12px;
            padding: 8px;
          }
          .card-tile img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            display: block;
          }
          .card-tile figcaption {
            font-size: 12px;
            color: #cbd5f5;
            margin-top: 6px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <header>
          <h1>${title}</h1>
          <div class="subtitle">${subtitle}</div>
          ${deckHtml}
        </header>
        <section class="chat">
          ${messageHtml}
        </section>
        ${footnoteHtml}
      </body>
    </html>
  `;
}

export async function generateChatPdf(input: PdfInput) {
  const { chromium } = await import('playwright');
  const cardNames = extractScryfallCardNames(input.messages);
  const cardImages = await resolveCardImages(cardNames);
  const html = await buildChatHtml(input, cardImages);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' }
    });
    return buffer;
  } finally {
    await browser.close();
  }
}
