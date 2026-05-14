/**
 * Minimal HTML → react-pdf renderer.
 *
 * Factory pattern: takes the lazily-loaded @react-pdf/renderer namespace and
 * returns a `renderRichText(html, styles)` function. See react-pdf-loader.ts
 * for why we don't `import` the package statically.
 */

import { createElement, Fragment, type ReactNode } from 'react';
import type { ReactPdfNamespace, ReactPdfStyle } from './react-pdf-loader';

interface RichTextStyles {
  paragraph?: ReactPdfStyle;
  list?: ReactPdfStyle;
  listItem?: ReactPdfStyle;
  link?: ReactPdfStyle;
  strong?: ReactPdfStyle;
  em?: ReactPdfStyle;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'meta', 'link']);

interface Node {
  type: 'text' | 'element';
  tag?: string;
  attrs?: Record<string, string>;
  children?: Node[];
  text?: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

function parseHtml(html: string): Node[] {
  const tokens: Node[] = [];
  const stack: Node[] = [];
  let current: Node[] = tokens;

  const re = /<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[3] !== undefined) {
      const text = decodeEntities(m[3]);
      if (text) current.push({ type: 'text', text });
      continue;
    }
    const fullTag = m[0];
    const tag = m[1].toLowerCase();
    const isClose = fullTag.startsWith('</');
    const isSelfClose = fullTag.endsWith('/>') || VOID_TAGS.has(tag);

    if (isClose) {
      while (stack.length > 0) {
        const top = stack.pop()!;
        if (top.tag === tag) {
          current = stack.length > 0 ? stack[stack.length - 1].children! : tokens;
          break;
        }
      }
      continue;
    }

    const node: Node = {
      type: 'element',
      tag,
      attrs: parseAttrs(m[2] || ''),
      children: [],
    };
    current.push(node);
    if (!isSelfClose) {
      stack.push(node);
      current = node.children!;
    }
  }
  return tokens;
}

export function createRichTextRenderer(rp: ReactPdfNamespace) {
  const { Text, View, Link } = rp;

  function renderInline(nodes: Node[], styles: RichTextStyles, keyPrefix: string): ReactNode[] {
    const out: ReactNode[] = [];
    nodes.forEach((node, i) => {
      const key = `${keyPrefix}-${i}`;
      if (node.type === 'text') {
        out.push(node.text);
        return;
      }
      switch (node.tag) {
        case 'strong':
        case 'b':
          out.push(
            createElement(
              Text,
              { key, style: styles.strong ?? { fontFamily: 'Helvetica-Bold' } },
              renderInline(node.children ?? [], styles, key),
            ),
          );
          break;
        case 'em':
        case 'i':
          out.push(
            createElement(
              Text,
              { key, style: styles.em ?? { fontStyle: 'italic' } },
              renderInline(node.children ?? [], styles, key),
            ),
          );
          break;
        case 'br':
          out.push(createElement(Text, { key }, '\n'));
          break;
        case 'a': {
          const href = node.attrs?.href;
          if (href) {
            out.push(
              createElement(
                Link,
                { key, src: href, style: styles.link },
                renderInline(node.children ?? [], styles, key),
              ),
            );
          } else {
            out.push(...renderInline(node.children ?? [], styles, key));
          }
          break;
        }
        default:
          out.push(...renderInline(node.children ?? [], styles, key));
      }
    });
    return out;
  }

  function renderBlock(nodes: Node[], styles: RichTextStyles, keyPrefix: string): ReactNode[] {
    const out: ReactNode[] = [];
    let inlineBuffer: Node[] = [];
    let inlineKey = 0;

    const flushInline = () => {
      if (inlineBuffer.length === 0) return;
      const key = `${keyPrefix}-inline-${inlineKey++}`;
      out.push(
        createElement(
          Text,
          { key, style: styles.paragraph },
          renderInline(inlineBuffer, styles, key),
        ),
      );
      inlineBuffer = [];
    };

    nodes.forEach((node, i) => {
      const key = `${keyPrefix}-${i}`;
      if (node.type === 'text') {
        if (node.text && node.text.trim()) inlineBuffer.push(node);
        return;
      }
      switch (node.tag) {
        case 'p':
        case 'div':
          flushInline();
          out.push(
            createElement(
              Text,
              { key, style: styles.paragraph },
              renderInline(node.children ?? [], styles, key),
            ),
          );
          break;
        case 'ul':
        case 'ol':
          flushInline();
          out.push(
            createElement(
              View,
              { key, style: styles.list },
              (node.children ?? [])
                .filter((c) => c.type === 'element' && c.tag === 'li')
                .map((li, idx) =>
                  createElement(
                    View,
                    { key: `${key}-li-${idx}`, style: { flexDirection: 'row' } },
                    createElement(Text, { style: { width: 10 } }, '•'),
                    createElement(
                      Text,
                      { style: styles.listItem },
                      renderInline(li.children ?? [], styles, `${key}-li-${idx}`),
                    ),
                  ),
                ),
            ),
          );
          break;
        case 'br':
          inlineBuffer.push(node);
          break;
        default:
          inlineBuffer.push(node);
      }
    });

    flushInline();
    return out;
  }

  return function renderRichText(
    html: string | undefined,
    styles: RichTextStyles = {},
  ): ReactNode {
    if (!html) return null;
    const trimmed = html.trim();
    if (!trimmed) return null;
    if (!trimmed.includes('<')) {
      return createElement(Text, { style: styles.paragraph }, decodeEntities(trimmed));
    }
    const tree = parseHtml(trimmed);
    return createElement(Fragment, null, ...renderBlock(tree, styles, 'rt'));
  };
}

export type RichTextRenderer = ReturnType<typeof createRichTextRenderer>;
