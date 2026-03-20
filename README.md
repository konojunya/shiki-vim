<p align="center">
  <img src="sites/public/icon.svg" alt="shiki-vim" width="80" />
</p>

<h1 align="center">shiki-vim</h1>

<p align="center">
  Vim-powered code editor component for React with Shiki syntax highlighting.
</p>

<p align="center">
  <a href="https://shiki-vim.0xjj.dev">Documentation</a> ·
  <a href="https://shiki-vim.0xjj.dev/#playground">Playground</a> ·
  <a href="https://www.npmjs.com/package/shiki-vim">npm</a>
</p>

<p align="center">
  <a href="https://github.com/konojunya/shiki-vim/actions/workflows/ci.yaml"><img src="https://github.com/konojunya/shiki-vim/actions/workflows/ci.yaml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/shiki-vim"><img src="https://img.shields.io/npm/v/shiki-vim" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/shiki-vim"><img src="https://img.shields.io/npm/dm/shiki-vim" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/shiki-vim"><img src="https://img.shields.io/bundlephobia/minzip/shiki-vim" alt="bundle size" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/shiki-vim" alt="license" /></a>
</p>

---

Drop-in `<ShikiVim />` component with real Vim modes, [Shiki](https://shiki.style/) highlighting, and zero configuration.

## Features

- **Real Vim Keybindings** — Normal, Insert, Visual, Command-line modes. Motions, operators, counts — it all works.
- **Shiki Highlighting** — 60+ themes, 200+ languages. Same engine powering VS Code.
- **Read-Only Mode** — `readOnly` prop for a zero-config code viewer with navigation & search.
- **Tiny & Focused** — No heavy deps. React + Shiki. Tree-shakeable ESM, full TypeScript types.
- **Search** — `/` and `?` for forward/backward regex search. `n` and `N` to jump between matches.
- **Undo / Redo** — `u` and `Ctrl-R` with cursor restore. Multi-level undo stack.
- **Callback-driven** — `onSave`, `onYank`, `onChange`, `onModeChange` — you decide what happens.
- **Customizable** — CSS variables for theming. Shiki options are passed through transparently.

## Install

```bash
npm install shiki-vim shiki react react-dom
```

`shiki`, `react`, and `react-dom` are peer dependencies.

## Quick Start

```tsx
import ShikiVim from "shiki-vim";
import "shiki-vim/styles.css";
import { createHighlighter } from "shiki";

const highlighter = await createHighlighter({
  themes: ["vitesse-dark"],
  langs: ["typescript"],
});

function App() {
  return (
    <ShikiVim
      content={`function greet(name: string) {\n  return "Hello, " + name;\n}`}
      highlighter={highlighter}
      lang="typescript"
      theme="vitesse-dark"
      onSave={(content) => {
        fetch("/api/save", { method: "POST", body: content });
      }}
      onYank={(text) => {
        navigator.clipboard.writeText(text);
      }}
    />
  );
}
```

> [Try it live in the playground](https://shiki-vim.0xjj.dev/#playground)

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | *required* | The code to display and edit |
| `highlighter` | `HighlighterCore` | *required* | Shiki highlighter instance |
| `lang` | `string` | *required* | Language for syntax highlighting |
| `theme` | `string` | *required* | Shiki theme name |
| `shikiOptions` | `Record<string, unknown>` | — | Additional options passed to Shiki's `codeToTokens` |
| `cursorPosition` | `string` | `"1:1"` | Initial cursor position (`"line:col"`, 1-based) |
| `readOnly` | `boolean` | `false` | Disable editing (motions still work) |
| `showLineNumbers` | `boolean` | `true` | Show line number gutter |
| `className` | `string` | — | Additional class for the container |

### Callbacks

| Prop | Signature | Trigger |
|------|-----------|---------|
| `onChange` | `(content: string) => void` | Any content edit |
| `onYank` | `(text: string) => void` | Text yanked (`yy`, `dw`, etc.) |
| `onSave` | `(content: string) => void` | `:w` command |
| `onModeChange` | `(mode: VimMode) => void` | Mode transition |

## Keybindings

### Modes

| Key | Action |
|-----|--------|
| `i` `a` `I` `A` | Enter insert mode |
| `o` `O` | Open line below / above |
| `v` | Visual mode (character) |
| `V` | Visual line mode |
| `Escape` | Return to normal mode |

### Motions

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Left / Down / Up / Right |
| `w` `e` `b` | Next word / End of word / Previous word |
| `0` `^` `$` | Line start / First non-blank / Line end |
| `gg` `G` | File start / File end (or `{count}gg`, `{count}G`) |
| `f{char}` `F{char}` | Find char forward / backward |
| `t{char}` `T{char}` | Till char forward / backward |
| `%` | Jump to matching bracket |
| `{count}{motion}` | Repeat motion (e.g. `5j`, `3w`) |

### Operators

| Key | Action |
|-----|--------|
| `d{motion}` | Delete |
| `y{motion}` | Yank |
| `c{motion}` | Change (delete + enter insert) |
| `dd` `yy` `cc` | Operate on whole line |
| `{count}{operator}{motion}` | e.g. `3dw`, `2yy` |

### Editing

| Key | Action |
|-----|--------|
| `x` | Delete char under cursor |
| `r{char}` | Replace char under cursor |
| `p` / `P` | Paste after / before cursor |
| `J` | Join current line with next |
| `u` | Undo |
| `Ctrl-R` | Redo |

### Search & Commands

| Key | Action |
|-----|--------|
| `/{pattern}` | Search forward (regex) |
| `?{pattern}` | Search backward (regex) |
| `n` / `N` | Next / Previous match |
| `Ctrl-U` / `Ctrl-D` | Half page up / down |
| `:w` | Save |
| `:{number}` | Go to line |

## Styling

Override CSS variables to match your theme:

```css
.sv-container {
  --sv-font-family: "JetBrains Mono", monospace;
  --sv-font-size: 14px;
  --sv-line-height: 1.5;
  --sv-cursor-color: rgba(255, 255, 255, 0.6);
  --sv-selection-bg: rgba(100, 150, 255, 0.3);
  --sv-gutter-color: #858585;
  --sv-statusline-bg: #252526;
  --sv-statusline-fg: #cccccc;
  --sv-focus-color: #007acc;
}
```

## Hooks

For advanced use cases, the internal hooks are exported:

```tsx
import { useVimEngine, useShikiTokens } from "shiki-vim";

const engine = useVimEngine({
  content: "hello world",
  onSave: (content) => { /* ... */ },
});

// engine.cursor, engine.mode, engine.handleKeyDown, etc.
```

## Roadmap

Contributions welcome for any of these:

- [ ] Text objects (`iw`, `i"`, `i(`, `a{`, etc.)
- [ ] Visual block mode (`Ctrl-V`)
- [ ] `.` repeat last change
- [ ] `~` toggle case
- [ ] `>>` / `<<` indent / dedent
- [ ] `:s/old/new/g` substitute
- [ ] Named registers (`"a`, `"0`, etc.)
- [ ] Macros (`q{reg}`, `@{reg}`)
- [ ] Marks (`m{a-z}`, `'{a-z}`)

## Contributing

```bash
bun install
bun run dev         # Watch mode
bun run test        # Run tests (360 cases)
bun run typecheck   # Type check
bun run lint        # oxlint
bun run fmt         # oxfmt
```

PRs are welcome! Please make sure `bun run test` and `bun run typecheck` pass before submitting.

## License

[MIT](./LICENSE) &copy; [JJ](https://github.com/konojunya)
