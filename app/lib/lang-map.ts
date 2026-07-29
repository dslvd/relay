// Shared language <-> extension mapping used by the snippet composer
// (language picker), the /d/[...path] share page (snippet + repo-browser
// syntax highlighting), and the API route that derives a filename for a
// pasted snippet when the caller doesn't supply one.

export interface LanguageOption {
  value: string;
  label: string;
  ext: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'plaintext', label: 'Plain text', ext: 'txt' },
  { value: 'javascript', label: 'JavaScript', ext: 'js' },
  { value: 'typescript', label: 'TypeScript', ext: 'ts' },
  { value: 'jsx', label: 'JSX', ext: 'jsx' },
  { value: 'tsx', label: 'TSX', ext: 'tsx' },
  { value: 'python', label: 'Python', ext: 'py' },
  { value: 'go', label: 'Go', ext: 'go' },
  { value: 'rust', label: 'Rust', ext: 'rs' },
  { value: 'java', label: 'Java', ext: 'java' },
  { value: 'c', label: 'C', ext: 'c' },
  { value: 'cpp', label: 'C++', ext: 'cpp' },
  { value: 'csharp', label: 'C#', ext: 'cs' },
  { value: 'ruby', label: 'Ruby', ext: 'rb' },
  { value: 'php', label: 'PHP', ext: 'php' },
  { value: 'swift', label: 'Swift', ext: 'swift' },
  { value: 'kotlin', label: 'Kotlin', ext: 'kt' },
  { value: 'html', label: 'HTML', ext: 'html' },
  { value: 'css', label: 'CSS', ext: 'css' },
  { value: 'json', label: 'JSON', ext: 'json' },
  { value: 'yaml', label: 'YAML', ext: 'yml' },
  { value: 'markdown', label: 'Markdown', ext: 'md' },
  { value: 'bash', label: 'Shell', ext: 'sh' },
  { value: 'sql', label: 'SQL', ext: 'sql' },
];

export const EXT_TO_LANGUAGE: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  txt: 'plaintext',
};

export function languageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANGUAGE[ext] || 'plaintext';
}

export function extensionForLanguage(language?: string): string {
  if (!language) return 'txt';
  return LANGUAGE_OPTIONS.find((opt) => opt.value === language)?.ext || 'txt';
}
