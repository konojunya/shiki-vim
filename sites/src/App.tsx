import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import ShikiVim from "shiki-vim";
import "shiki-vim/styles.css";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const themes = [
  { value: "vitesse-dark", label: "Vitesse Dark", dark: true },
  { value: "vitesse-light", label: "Vitesse Light", dark: false },
  { value: "dracula", label: "Dracula", dark: true },
  { value: "nord", label: "Nord", dark: true },
  { value: "github-dark", label: "GitHub Dark", dark: true },
  { value: "github-light", label: "GitHub Light", dark: false },
  { value: "tokyo-night", label: "Tokyo Night", dark: true },
  { value: "rose-pine", label: "Rose Pine", dark: true },
  { value: "catppuccin-mocha", label: "Catppuccin Mocha", dark: true },
  { value: "catppuccin-latte", label: "Catppuccin Latte", dark: false },
  { value: "synthwave-84", label: "Synthwave '84", dark: true },
  { value: "one-dark-pro", label: "One Dark Pro", dark: true },
  { value: "poimandres", label: "Poimandres", dark: true },
  { value: "night-owl", label: "Night Owl", dark: true },
  { value: "solarized-dark", label: "Solarized Dark", dark: true },
  { value: "solarized-light", label: "Solarized Light", dark: false },
] as const;

const langs = [
  { value: "tsx", label: "TSX" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
] as const;

const sampleCode: Record<string, string> = {
  tsx: `import { useState } from "react";

interface Props {
  name: string;
  count?: number;
}

export function Greeting({ name, count = 0 }: Props) {
  const [clicks, setClicks] = useState(count);

  return (
    <div>
      <h1>Hello, {name}!</h1>
      <button onClick={() => setClicks((c) => c + 1)}>
        Clicked {clicks} times
      </button>
    </div>
  );
}`,
  typescript: `interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

const user = await fetchUser("42");
console.log(user.name);`,
  javascript: `function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}`,
  python: `from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    name: str
    email: str
    age: Optional[int] = None

    def greet(self) -> str:
        return f"Hello, {self.name}!"

users = [User("Alice", "alice@example.com", 30)]
for user in users:
    print(user.greet())`,
  rust: `use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let text = "hello world hello rust";
    let counts = word_count(text);
    println!("{:?}", counts);
}`,
  go: `package main

import (
\t"fmt"
\t"strings"
)

func wordCount(s string) map[string]int {
\tcounts := make(map[string]int)
\tfor _, word := range strings.Fields(s) {
\t\tcounts[word]++
\t}
\treturn counts
}

func main() {
\tcounts := wordCount("hello world hello go")
\tfmt.Println(counts)
}`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hello World</title>
  <style>
    body { font-family: system-ui; }
    .card { padding: 2rem; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello World</h1>
    <p>Welcome to shiki-vim!</p>
  </div>
</body>
</html>`,
  css: `:root {
  --bg: #0f0f0f;
  --fg: #e0e0e0;
  --accent: #a78bfa;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: "Inter", system-ui, sans-serif;
}

.editor {
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 12px;
  backdrop-filter: blur(12px);
}`,
  json: `{
  "name": "shiki-vim",
  "version": "0.0.1",
  "description": "A vim-like code editor powered by Shiki",
  "keywords": ["vim", "editor", "shiki", "react"],
  "author": "konojunya",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/konojunya/shiki-vim"
  }
}`,
};

const quickStartCode = `// Install
npm i shiki-vim shiki

// Use
import ShikiVim from 'shiki-vim'
import 'shiki-vim/styles.css'

<ShikiVim
  content={code}
  highlighter={highlighter}
  lang="tsx"
  theme="github-dark"
  readOnly={false}
/>`;

const features = [
  {
    icon: "hjkl",
    title: "Real Vim Keybindings",
    desc: "Normal, Insert, Visual, Command-line modes. Motions, operators, counts \u2014 it all works.",
  },
  {
    icon: "\u2728",
    title: "Shiki Highlighting",
    desc: "60+ themes, 200+ languages. Same engine powering VS Code.",
  },
  {
    icon: "\ud83d\udd12",
    title: "Read-Only Mode",
    desc: "readOnly prop for a zero-config code viewer with nav & search.",
  },
  {
    icon: "\ud83c\udfaf",
    title: "Tiny & Focused",
    desc: "No heavy deps. React + Shiki. Tree-shakeable ESM, full TS types.",
  },
  {
    icon: "\ud83d\udd0d",
    title: "Search",
    desc: "/ and ? for forward/backward search. n and N to jump between matches.",
  },
  {
    icon: "\ud83d\udcdd",
    title: "Undo / Redo",
    desc: "u and Ctrl-R with cursor restore. Multi-level undo stack.",
  },
];

// ---------------------------------------------------------------------------
// Colors (dark only LP)
// ---------------------------------------------------------------------------

const C = {
  bg: "#18181b",
  fg: "#e4e4e7",
  muted: "#71717a",
  surface: "#27272a",
  border: "#3f3f46",
  purple: "#a78bfa",
  pink: "#ec4899",
  cyan: "#06b6d4",
};

function modeColor(mode: string): string {
  switch (mode) {
    case "normal":      return C.purple;
    case "insert":      return C.cyan;
    case "visual":
    case "visual-line": return "#f59e0b";
    case "command-line": return C.pink;
    default:            return C.muted;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [mode, setMode] = useState("normal");
  const [theme, setTheme] = useState<string>("github-dark");
  const [lang, setLang] = useState<string>("tsx");
  const [readOnly, setReadOnly] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    createHighlighter({
      themes: themes.map((t) => t.value),
      langs: langs.map((l) => l.value),
    }).then(setHighlighter);
  }, []);

  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value),
    [],
  );

  const ready = !!highlighter;

  return (
    <div style={page}>
      {/* ---- Nav ---- */}
      <nav style={nav}>
        <span style={logo}>
          <span style={{ color: C.purple }}>:</span>shiki-vim
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <NavLink href="https://www.npmjs.com/package/shiki-vim">npm</NavLink>
          <a
            href="https://github.com/konojunya/shiki-vim"
            target="_blank"
            rel="noreferrer"
            style={ghBtn}
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section style={hero}>
        <Pill>v0.0.1 &mdash; MIT License</Pill>

        <h1 style={heroTitle}>
          <VimTyper />
        </h1>

        <p style={heroSub}>
          Drop-in component with real Vim modes,
          <br />
          Shiki highlighting, and zero configuration.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
          <a href="#playground" style={ctaBtn}>
            Try it live
          </a>
          <code style={installBadge}>npm i shiki-vim</code>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section style={sectionWide}>
        <div style={featureGrid}>
          {features.map((f) => (
            <div key={f.title} style={featureCard}>
              <div style={featureIcon}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Playground ---- */}
      <section
        id="playground"
        style={{
          ...sectionWide,
          filter: ready ? "none" : "blur(8px)",
          opacity: ready ? 1 : 0.5,
          transition: "filter 0.4s, opacity 0.4s",
          pointerEvents: ready ? "auto" : "none",
        }}
      >
        <h2 style={sectionTitle}>Playground</h2>

        {/* Toolbar */}
        <div style={toolbar}>
          <select value={theme} onChange={handleThemeChange} style={themeSelect}>
            {themes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {langs.map((l) => (
              <button
                key={l.value}
                onClick={() => setLang(l.value)}
                style={{
                  ...pill,
                  background: lang === l.value ? C.purple : C.border,
                  color: lang === l.value ? "#fff" : C.muted,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setReadOnly((v) => !v)}
            style={{
              ...pill,
              border: `2px solid ${readOnly ? "#f59e0b" : "#10b981"}`,
              background: readOnly ? "#422006" : "#022c22",
              color: readOnly ? "#f59e0b" : "#10b981",
              fontWeight: 700,
            }}
          >
            {readOnly ? "READ ONLY" : "EDITABLE"}
          </button>

          <div
            style={{
              ...pill,
              background: modeColor(mode),
              color: "#fff",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontWeight: 700,
              letterSpacing: "0.04em",
              transition: "background 0.15s",
            }}
          >
            {mode.toUpperCase()}
          </div>
        </div>

        {/* Editor */}
        <div style={{ position: "relative" }}>
        <div style={editorWrap}>
          {highlighter && (
            <ShikiVim
              key={lang}
              content={sampleCode[lang] ?? sampleCode.tsx}
              highlighter={highlighter}
              lang={lang}
              theme={theme}
              readOnly={readOnly}
              onSave={() => showToast("Saved!")}
              onYank={(t) => {
                navigator.clipboard.writeText(t);
                const preview = t.length > 40 ? t.slice(0, 40) + "..." : t;
                showToast(`Yanked: ${preview}`);
              }}
              onChange={() => {}}
              onModeChange={(m) => setMode(m)}
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={toastStyle}>
            {toast}
          </div>
        )}
        </div>

        {/* Hints */}
        <div style={hints}>
          <Kbd>h</Kbd><Kbd>j</Kbd><Kbd>k</Kbd><Kbd>l</Kbd>{" "}
          move{"  "}<Kbd>i</Kbd> insert{"  "}<Kbd>v</Kbd> visual{"  "}
          <Kbd>dd</Kbd> delete{"  "}<Kbd>yy</Kbd> yank{"  "}
          <Kbd>/</Kbd> search{"  "}<Kbd>:w</Kbd> save{"  "}<Kbd>Esc</Kbd> normal
        </div>
      </section>

      {/* ---- Quick Start ---- */}
      <section
        style={{
          ...sectionWide,
          filter: ready ? "none" : "blur(8px)",
          opacity: ready ? 1 : 0.5,
          transition: "filter 0.4s, opacity 0.4s",
        }}
      >
        <h2 style={sectionTitle}>Quick Start</h2>
        <div
          className="quick-start"
          style={quickStartWrap}
          dangerouslySetInnerHTML={
            highlighter
              ? { __html: highlighter.codeToHtml(quickStartCode, { lang: "tsx", theme }) }
              : { __html: `<pre><code>${quickStartCode}</code></pre>` }
          }
        />
      </section>

      {/* ---- Usage ---- */}
      <section style={sectionWide}>
        <h2 style={sectionTitle}>Usage</h2>

        {/* Props */}
        <h3 style={subTitle}>Props</h3>
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Prop</th>
                <th style={th}>Type</th>
                <th style={th}>Default</th>
                <th style={th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["content", "string", "\u2014", "The code to display and edit"],
                ["highlighter", "HighlighterCore", "\u2014", "Shiki highlighter instance"],
                ["lang", "string", "\u2014", "Language for syntax highlighting"],
                ["theme", "string", "\u2014", "Shiki theme name"],
                ["readOnly", "boolean", "false", "Disable all editing \u2014 viewer mode"],
                ["showLineNumbers", "boolean", "true", "Show line number gutter"],
                ["cursorPosition", "string", '"1:1"', "Initial cursor position (1-based)"],
                ["className", "string", "\u2014", "Additional class for the container"],
              ] as const).map(([prop, type, def, desc]) => (
                <tr key={prop}>
                  <td style={td}><code style={propName}>{prop}</code></td>
                  <td style={td}><code style={typeName}>{type}</code></td>
                  <td style={td}><code style={defValue}>{def}</code></td>
                  <td style={{ ...td, color: C.muted }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Callbacks */}
        <h3 style={subTitle}>Callbacks</h3>
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Prop</th>
                <th style={th}>Signature</th>
                <th style={th}>Trigger</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["onChange", "(content: string) => void", "Any content edit"],
                ["onYank", "(text: string) => void", "Text yanked (y, dd, etc.)"],
                ["onSave", "(content: string) => void", ":w command"],
                ["onModeChange", "(mode: VimMode) => void", "Mode transition"],
              ] as const).map(([prop, sig, trigger]) => (
                <tr key={prop}>
                  <td style={td}><code style={propName}>{prop}</code></td>
                  <td style={td}><code style={typeName}>{sig}</code></td>
                  <td style={{ ...td, color: C.muted }}>{trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CSS Variables */}
        <h3 style={subTitle}>CSS Variables</h3>
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Variable</th>
                <th style={th}>Default</th>
                <th style={th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["--sv-font-family", "Menlo, Monaco, ...", "Editor font"],
                ["--sv-font-size", "14px", "Font size"],
                ["--sv-line-height", "1.5", "Line height"],
                ["--sv-cursor-color", "rgba(255,255,255,0.6)", "Cursor color"],
                ["--sv-selection-bg", "rgba(100,150,255,0.3)", "Visual selection background"],
                ["--sv-focus-color", "transparent", "Focus outline color"],
                ["--sv-gutter-color", "#858585", "Line number color"],
                ["--sv-statusline-bg", "#252526", "Status line background"],
                ["--sv-statusline-fg", "#cccccc", "Status line text color"],
              ] as const).map(([v, def, desc]) => (
                <tr key={v}>
                  <td style={td}><code style={propName}>{v}</code></td>
                  <td style={td}><code style={defValue}>{def}</code></td>
                  <td style={{ ...td, color: C.muted }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer style={footer}>
        <span>Built by </span>
        <a href="https://github.com/konojunya" target="_blank" rel="noreferrer" style={footerLink}>
          @konojunya
        </a>
        <Dot />
        <a href="https://github.com/konojunya/shiki-vim" target="_blank" rel="noreferrer" style={footerLinkMuted}>
          GitHub
        </a>
        <Dot />
        <a href="https://www.npmjs.com/package/shiki-vim" target="_blank" rel="noreferrer" style={footerLinkMuted}>
          npm
        </a>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hero typing animation — looks like a real vim editing session
// ---------------------------------------------------------------------------

interface AnimFrame {
  lines: string[];
  cursor: [number, number] | null;
  mode: "NORMAL" | "INSERT" | "VISUAL";
  selection?: [[number, number], [number, number]];
  ms: number;
}

function buildFrames(): AnimFrame[] {
  const f: AnimFrame[] = [];
  const push = (frame: AnimFrame) => f.push(frame);

  // Helper: generate INSERT typing frames char by char
  const typeChars = (
    startLines: string[],
    lineIdx: number,
    startCol: number,
    text: string,
    msBase: number,
  ): { lines: string[]; col: number } => {
    let lines = [...startLines];
    let col = startCol;
    for (const ch of text) {
      const line = lines[lineIdx];
      lines = [...lines];
      lines[lineIdx] = line.slice(0, col) + ch + line.slice(col);
      col++;
      push({ lines: [...lines], cursor: [lineIdx, col], mode: "INSERT", ms: msBase + Math.floor(Math.random() * 20) });
    }
    return { lines: [...lines], col };
  };

  // 1. "your code editor" already visible, NORMAL
  push({ lines: ["your code editor"], cursor: [0, 0], mode: "NORMAL", ms: 900 });

  // 2. O → open line above, INSERT
  push({ lines: ["", "your code editor"], cursor: [0, 0], mode: "INSERT", ms: 350 });

  // 3. Type "Vim keybndings for" (typo: "keybndings")
  const s1 = typeChars(["", "your code editor"], 0, 0, "Vim keybndings for", 50);

  // 4. Esc → NORMAL
  push({ lines: s1.lines, cursor: [0, s1.col - 1], mode: "NORMAL", ms: 500 });

  // 5. Realize typo — go to "keybndings": w → move to word
  push({ lines: s1.lines, cursor: [0, 4], mode: "NORMAL", ms: 350 });

  // 6. v → VISUAL
  push({ lines: s1.lines, cursor: [0, 4], mode: "VISUAL", selection: [[0, 4], [0, 5]], ms: 250 });

  // 7. e → extend to end of "keybndings" (col 13)
  push({ lines: s1.lines, cursor: [0, 13], mode: "VISUAL", selection: [[0, 4], [0, 14]], ms: 450 });

  // 8. d → delete "keybndings", yanked → "Vim  for"
  const afterDel = [s1.lines[0].slice(0, 4) + s1.lines[0].slice(14), s1.lines[1]];
  push({ lines: afterDel, cursor: [0, 4], mode: "NORMAL", ms: 400 });

  // 9. i → INSERT before the space
  push({ lines: afterDel, cursor: [0, 4], mode: "INSERT", ms: 300 });

  // 10. Type "keybindings" (correct)
  const s2 = typeChars(afterDel, 0, 4, "keybindings", 45);

  // 11. Esc → NORMAL
  push({ lines: s2.lines, cursor: [0, s2.col - 1], mode: "NORMAL", ms: 900 });

  // 12. Done — no cursor
  push({ lines: s2.lines, cursor: null, mode: "NORMAL", ms: 999999 });

  return f;
}

function VimTyper() {
  const frames = useMemo(() => buildFrames(), []);
  const [fi, setFi] = useState(0);

  useEffect(() => {
    if (fi >= frames.length - 1) return;
    const t = setTimeout(() => setFi((i) => i + 1), frames[fi].ms);
    return () => clearTimeout(t);
  }, [fi, frames]);

  const frame = frames[fi];

  const modeLabel = frame.mode === "INSERT"
    ? "-- INSERT --"
    : frame.mode === "VISUAL"
      ? "-- VISUAL --"
      : "NORMAL";

  const modeClr = frame.mode === "INSERT"
    ? C.cyan
    : frame.mode === "VISUAL"
      ? "#f59e0b"
      : C.purple;

  return (
    <span>
      <span style={{ display: "block", fontSize: 13, fontFamily: "'SF Mono','Fira Code',monospace", fontWeight: 700, color: modeClr, marginBottom: 12, height: 20, letterSpacing: "0.04em" }}>
        {modeLabel}
      </span>
      {frame.lines.map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          <HeroLine text={line} lineIdx={li} frame={frame} />
        </span>
      ))}
    </span>
  );
}

/** Render a single line of the hero animation with cursor + selection */
function HeroLine({ text, lineIdx, frame }: { text: string; lineIdx: number; frame: AnimFrame }) {
  const cursorCol = frame.cursor?.[0] === lineIdx ? frame.cursor[1] : null;

  // Selection range on this line
  let selFrom = -1;
  let selTo = -1;
  if (frame.selection && frame.mode === "VISUAL") {
    const [[sLine, sCol], [eLine, eCol]] = frame.selection;
    if (lineIdx >= sLine && lineIdx <= eLine) {
      selFrom = lineIdx === sLine ? sCol : 0;
      selTo = lineIdx === eLine ? eCol : text.length;
    }
  }

  const elements: React.ReactNode[] = [];

  // Insert mode line cursor at position
  const insertCursorAt = frame.mode === "INSERT" ? cursorCol : null;

  for (let col = 0; col <= text.length; col++) {
    // INSERT cursor before this char
    if (insertCursorAt === col) {
      elements.push(
        <span key={`cur-${col}`} style={{ display: "inline-block", width: 2, height: "0.85em", background: C.cyan, verticalAlign: "text-bottom", animation: "vim-blink 1s step-start infinite", marginLeft: -1, marginRight: -1 }} />,
      );
    }

    if (col >= text.length) break;

    const ch = text[col];
    const isSelected = col >= selFrom && col < selTo;
    const isBlockCursor = frame.mode === "NORMAL" && cursorCol === col;

    const style: React.CSSProperties = {};
    if (isSelected) style.background = "rgba(100, 150, 255, 0.35)";
    if (isBlockCursor) {
      style.background = "rgba(255,255,255,0.5)";
      style.color = "#18181b";
      style.animation = "vim-blink 1s step-start infinite";
    }

    elements.push(
      <span key={col} style={Object.keys(style).length ? style : undefined}>{ch}</span>,
    );
  }

  return <>{elements}</>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={kbd}>{children}</kbd>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={heroPill}>{children}</div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={navLink}>
      {children}
    </a>
  );
}

function Dot() {
  return <span style={{ margin: "0 8px" }}>&middot;</span>;
}

// ---------------------------------------------------------------------------
// Styles (static objects for perf)
// ---------------------------------------------------------------------------

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: C.fg,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
};

const center: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", minHeight: "100vh", background: C.bg, gap: 16,
};

const spinner: React.CSSProperties = {
  width: 36, height: 36,
  border: `3px solid ${C.border}`, borderTop: `3px solid ${C.purple}`,
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};

const nav: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  maxWidth: 1060, margin: "0 auto", padding: "20px 24px",
};

const logo: React.CSSProperties = {
  fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em",
};

const navLink: React.CSSProperties = {
  color: C.muted, textDecoration: "none", fontSize: 14, fontWeight: 500,
};

const ghBtn: React.CSSProperties = {
  padding: "7px 16px", borderRadius: 20, background: C.surface,
  border: `1px solid ${C.border}`, color: C.fg,
  textDecoration: "none", fontSize: 13, fontWeight: 600,
};

const hero: React.CSSProperties = {
  textAlign: "center", padding: "64px 24px 48px", maxWidth: 700, margin: "0 auto",
};

const heroPill: React.CSSProperties = {
  display: "inline-block", padding: "4px 14px", borderRadius: 20,
  background: C.surface, border: `1px solid ${C.border}`,
  fontSize: 13, fontWeight: 600, color: C.cyan, marginBottom: 20,
};

const heroTitle: React.CSSProperties = {
  fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 900, lineHeight: 1.1,
  letterSpacing: "-0.04em", margin: 0,
  minHeight: "clamp(100px, 20vw, 160px)", // sp: 100px, desktop: 160px
};

const heroSub: React.CSSProperties = {
  fontSize: "clamp(14px, 2.5vw, 18px)", color: C.muted, marginTop: 16, lineHeight: 1.6,
};

const ctaBtn: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 24, background: C.purple, color: "#fff",
  textDecoration: "none", fontSize: "clamp(13px, 2vw, 15px)", fontWeight: 700, border: "none",
};

const installBadge: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 24, background: C.surface,
  border: `1.5px solid ${C.border}`, fontSize: "clamp(12px, 2vw, 14px)",
  fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500,
  color: C.fg, userSelect: "all", cursor: "text",
};

const sectionWide: React.CSSProperties = {
  maxWidth: 1060, margin: "0 auto", padding: "0 24px 56px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em",
  marginBottom: 20, textAlign: "center",
};

const featureGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12,
};

const featureCard: React.CSSProperties = {
  padding: "20px 22px", borderRadius: 14, background: C.surface,
  border: `1px solid ${C.border}`,
};

const featureIcon: React.CSSProperties = {
  fontSize: 14, fontWeight: 800,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  color: C.purple, marginBottom: 6,
};

const toolbar: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
  marginBottom: 12, padding: "10px 14px", background: C.surface,
  borderRadius: 14, border: `1px solid ${C.border}`,
};

const themeSelect: React.CSSProperties = {
  appearance: "none", padding: "6px 26px 6px 10px", borderRadius: 8,
  border: `1.5px solid ${C.border}`, background: C.bg, color: C.fg,
  fontSize: 13, fontFamily: "inherit", fontWeight: 500,
  cursor: "pointer", outline: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
};

const pill: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 20, border: "none", fontSize: 12,
  fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
  transition: "all 0.12s", whiteSpace: "nowrap",
};

const editorWrap: React.CSSProperties = {
  borderRadius: 14, overflow: "hidden",
  boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
};

const hints: React.CSSProperties = {
  marginTop: 12, padding: "10px 16px", borderRadius: 10,
  background: C.surface, border: `1px solid ${C.border}`,
  color: C.muted, fontSize: 13, lineHeight: 2.2,
};

const kbd: React.CSSProperties = {
  display: "inline-block", padding: "1px 7px", fontSize: 12,
  fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500,
  borderRadius: 5, border: `1.5px solid ${C.border}`,
  background: C.bg, color: C.fg, marginRight: 2,
};

const toastStyle: React.CSSProperties = {
  position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
  padding: "8px 20px", borderRadius: 20,
  background: C.purple, color: "#fff",
  fontSize: 13, fontWeight: 600,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  whiteSpace: "nowrap",
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  animation: "toast-in 0.2s ease-out",
  zIndex: 10,
};

const quickStartWrap: React.CSSProperties = {
  borderRadius: 14, overflow: "hidden",
  boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
  fontSize: 14, lineHeight: 1.7,
  padding: "20px 24px",
  background: C.surface,
};

const footer: React.CSSProperties = {
  textAlign: "center", padding: "32px 24px",
  borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: 13,
};

const subTitle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
  marginTop: 32, marginBottom: 12, color: C.fg,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto", borderRadius: 12,
  border: `1px solid ${C.border}`, background: C.surface,
};

const table: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: 13, lineHeight: 1.6,
};

const th: React.CSSProperties = {
  textAlign: "left", padding: "10px 16px", fontWeight: 600, fontSize: 12,
  color: C.muted, borderBottom: `1px solid ${C.border}`,
  textTransform: "uppercase", letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
  verticalAlign: "top",
};

const propName: React.CSSProperties = {
  color: C.cyan, fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 13, fontWeight: 600,
};

const typeName: React.CSSProperties = {
  color: C.pink, fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const defValue: React.CSSProperties = {
  color: C.muted, fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
};

const footerLink: React.CSSProperties = {
  color: C.purple, textDecoration: "none", fontWeight: 600,
};

const footerLinkMuted: React.CSSProperties = {
  color: C.fg, textDecoration: "none", fontWeight: 500,
};

export default App;
