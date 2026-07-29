'use client';

import { useEffect, useMemo, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-ruby';
// prism-php depends on markup-templating (its before/after-tokenize hooks
// call into Prism.languages['markup-templating'] unconditionally for every
// highlight() call, not just PHP ones) - importing php without it throws
// "Cannot read properties of undefined (reading 'tokenizePlaceholders')" for
// every language, not just PHP.
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';

// Maps our shared language ids (app/lib/lang-map.ts) to Prism's grammar names.
const LANGUAGE_GRAMMAR: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  html: 'markup',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
  bash: 'bash',
  sql: 'sql',
};

// Auto-closing pairs, VS Code style: typing an opener inserts the matching
// closer with the cursor left in between; typing a closer that's already
// sitting right after the cursor just steps over it instead of duplicating;
// backspacing right inside an empty pair deletes both sides together.
const AUTO_CLOSE_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};
const AUTO_CLOSERS = new Set(Object.values(AUTO_CLOSE_PAIRS));

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface SnippetEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: string;
  placeholder?: string;
  disabled?: boolean;
  /** CSS height for the editor's scroll area - accepts px, %, etc. */
  height?: string;
}

export default function SnippetEditor({ code, onChange, language, placeholder, disabled, height = '200px' }: SnippetEditorProps) {
  const grammarKey = LANGUAGE_GRAMMAR[language];
  const grammar = grammarKey ? Prism.languages[grammarKey] : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);

  // Keep the line-number gutter's scroll position in lockstep with the
  // underlying textarea - react-simple-code-editor doesn't expose the DOM
  // node via ref, so we reach it through the class name we already assign.
  useEffect(() => {
    const textarea = containerRef.current?.querySelector('textarea');
    if (!textarea) return;
    const syncScroll = () => {
      if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener('scroll', syncScroll);
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
    const target = e.currentTarget as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = target;
    const hasSelection = selectionStart !== selectionEnd;

    // Cursor position is set synchronously on the DOM node (not deferred via
    // requestAnimationFrame) and mirrored onto target.value up front. That
    // way, when React re-renders the controlled `value` a tick later, the
    // assignment is a no-op the browser won't reset the caret for - and any
    // keystroke that lands before that render still reads the right
    // selectionStart instead of racing a pending rAF callback (which, under
    // fast typing, was landing after the *next* keydown had already fired
    // and read a stale cursor position, scrambling the input).
    //
    // Skip-over must be checked BEFORE auto-insert: quotes/backticks use the
    // same character as both opener and closer, so e.g. typing a closing `"`
    // right before an auto-inserted `"` would otherwise match the auto-insert
    // branch first (AUTO_CLOSE_PAIRS['"'] is truthy) and insert a second
    // pair instead of stepping over the existing one.
    if (!hasSelection && AUTO_CLOSERS.has(e.key) && value[selectionStart] === e.key) {
      e.preventDefault();
      target.selectionStart = target.selectionEnd = selectionStart + 1;
      return;
    }

    if (!hasSelection && AUTO_CLOSE_PAIRS[e.key]) {
      e.preventDefault();
      const closer = AUTO_CLOSE_PAIRS[e.key];
      const nextValue = value.slice(0, selectionStart) + e.key + closer + value.slice(selectionEnd);
      const nextCursor = selectionStart + 1;
      target.value = nextValue;
      target.selectionStart = target.selectionEnd = nextCursor;
      onChange(nextValue);
      return;
    }

    if (e.key === 'Backspace' && !hasSelection && selectionStart > 0) {
      const prevChar = value[selectionStart - 1];
      const nextChar = value[selectionStart];
      if (AUTO_CLOSE_PAIRS[prevChar] === nextChar) {
        e.preventDefault();
        const nextValue = value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1);
        const nextCursor = selectionStart - 1;
        target.value = nextValue;
        target.selectionStart = target.selectionEnd = nextCursor;
        onChange(nextValue);
      }
    }
  };

  return (
    <div className="snippet-editor" ref={containerRef} style={{ height }}>
      <div className="snippet-editor__gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="snippet-editor__scroll">
        <Editor
          value={code}
          onValueChange={onChange}
          onKeyDown={handleKeyDown}
          highlight={(text) => (grammar ? Prism.highlight(text, grammar, grammarKey!) : escapeHtml(text))}
          padding={14}
          placeholder={placeholder}
          disabled={disabled}
          textareaClassName="snippet-editor__textarea"
          preClassName="snippet-editor__pre"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.6,
            minHeight: '100%',
          }}
        />
      </div>
    </div>
  );
}
