'use client';

import type { CSSProperties } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('ruby', ruby);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('swift', swift);
SyntaxHighlighter.registerLanguage('kotlin', kotlin);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sql', sql);

const REGISTERED_LANGUAGES = new Set([
  'jsx', 'tsx', 'javascript', 'typescript', 'python', 'go', 'rust', 'java',
  'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'html', 'css',
  'json', 'yaml', 'markdown', 'bash', 'sql',
]);

// Built from the app's own --c-* design tokens (see globals.css) instead of
// a stock Prism theme, so highlighted code stays inside the site's existing
// dark-glass / violet-teal-mint palette in both light and dark mode - values
// are literal `var(--c-*)` strings, which resolve live through React's
// inline-style pipeline exactly like any other CSS custom property.
const codeTheme: Record<string, CSSProperties> = {
  'pre[class*="language-"]': {
    background: 'transparent',
    color: 'var(--c-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    lineHeight: 1.6,
    margin: 0,
    textShadow: 'none',
  },
  'code[class*="language-"]': {
    background: 'transparent',
    color: 'var(--c-text)',
    fontFamily: 'var(--font-mono)',
    textShadow: 'none',
  },
  comment: { color: 'var(--c-dim)', fontStyle: 'italic' },
  prolog: { color: 'var(--c-dim)' },
  doctype: { color: 'var(--c-dim)' },
  cdata: { color: 'var(--c-dim)' },
  punctuation: { color: 'var(--c-sub)' },
  property: { color: '#b9a6ff' },
  tag: { color: '#b9a6ff' },
  boolean: { color: 'var(--c-accent-mint)' },
  number: { color: 'var(--c-accent-mint)' },
  constant: { color: 'var(--c-accent-mint)' },
  symbol: { color: 'var(--c-accent-mint)' },
  selector: { color: 'var(--c-accent-mint)' },
  'attr-name': { color: '#b9a6ff' },
  string: { color: 'var(--c-accent-mint)' },
  char: { color: 'var(--c-accent-mint)' },
  builtin: { color: '#b9a6ff' },
  inserted: { color: 'var(--c-accent-mint)' },
  operator: { color: 'var(--c-sub)' },
  entity: { color: 'var(--c-sub)' },
  url: { color: 'var(--c-sub)' },
  variable: { color: 'var(--c-text)' },
  atrule: { color: '#b9a6ff' },
  'attr-value': { color: 'var(--c-accent-mint)' },
  keyword: { color: '#b9a6ff' },
  function: { color: '#ffcb8a' },
  'class-name': { color: '#ffcb8a' },
  regex: { color: 'var(--c-accent-error)' },
  important: { color: 'var(--c-accent-error)', fontWeight: 'bold' },
  deleted: { color: 'var(--c-accent-error)' },
};

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export default function CodeBlock({ code, language, showLineNumbers }: CodeBlockProps) {
  const lang = language && REGISTERED_LANGUAGES.has(language) ? language : null;

  if (!lang) {
    return (
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          fontFamily: 'var(--font-mono)',
          color: 'var(--c-text)',
        }}
      >
        {code}
      </pre>
    );
  }

  return (
    <SyntaxHighlighter
      language={lang}
      style={codeTheme}
      showLineNumbers={showLineNumbers}
      wrapLongLines
      customStyle={{
        background: 'transparent',
        margin: 0,
        padding: 0,
      }}
      lineNumberStyle={{ color: 'var(--c-dim)', opacity: 0.5, minWidth: '2.4em' }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
