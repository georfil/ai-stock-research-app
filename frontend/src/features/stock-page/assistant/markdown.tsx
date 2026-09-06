import { createElement } from 'react';
import type { ReactNode } from 'react';

const HEADING_FONT_SIZE: Record<number, string> = {
  1: '1.35em',
  2: '1.2em',
  3: '1.1em',
  4: '1em',
  5: '1em',
  6: '1em',
};

/**
 * Renders the Markdown subset the assistant is prompted to use — **bold**
 * spans, "- " bullet lists, and (though the prompt asks it not to) "#"
 * headings as real h1-h6 elements, kept as a fallback so a stray heading
 * renders properly instead of leaking literal "#" characters. Links, code,
 * and tables aren't recognized and render as plain text, since the model is
 * never asked to produce them. Safe to call on a still-streaming, partial
 * string: an unclosed "**" just renders as a literal pair of asterisks
 * until the closing one arrives.
 */
export function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={blocks.length} style={{ margin: blocks.length === 0 ? 0 : '1em 0 0' }}>
        {renderInline(paragraph.join('\n'))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={blocks.length} style={{ margin: blocks.length === 0 ? 0 : '1em 0 0', paddingLeft: '1.3em' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ marginTop: i === 0 ? 0 : '0.35em' }}>
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    const bulletMatch = /^[-*]\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(
        createElement(
          `h${level}`,
          {
            key: blocks.length,
            style: {
              margin: blocks.length === 0 ? 0 : '1em 0 0',
              fontSize: HEADING_FONT_SIZE[level],
              fontWeight: 600,
              lineHeight: 1.3,
            },
          },
          renderInline(headingMatch[2]),
        ),
      );
    } else if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = boldPattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <strong key={key++} style={{ color: 'var(--color-accent-400)' }}>
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}
