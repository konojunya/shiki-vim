# shiki-vim

[![CI](https://github.com/konojunya/shiki-vim/actions/workflows/ci.yaml/badge.svg)](https://github.com/konojunya/shiki-vim/actions/workflows/ci.yaml)
[![npm version](https://img.shields.io/npm/v/shiki-vim)](https://www.npmjs.com/package/shiki-vim)
[![license](https://img.shields.io/npm/l/shiki-vim)](./LICENSE)

Vim keybindings for your React app. A lightweight code editor component with [Shiki](https://shiki.style/) syntax highlighting.

## Why shiki-vim?

- **Shiki-powered highlighting** — Same engine as VS Code. Any Shiki theme and language works out of the box.
- **Vim keybindings** — Motions, operators, visual mode, search, and more. Designed to feel natural to vim users.
- **Just a React component** — Drop it in with `<ShikiVim />`. No wrapper, no adapter, no framework lock-in.
- **Callback-driven** — `onSave`, `onYank`, `onChange` — you decide what happens. Clipboard, server sync, whatever you want.
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

// Create a highlighter (do this once, outside your component)
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
        // :w triggers this
        fetch("/api/save", { method: "POST", body: content });
      }}
      onYank={(text) => {
        // yy, dw, etc. trigger this
        navigator.clipboard.writeText(text);
      }}
      onChange={(content) => {
        // Every edit triggers this
        console.log("content changed:", content.length, "chars");
      }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | *required* | The content to display and edit |
| `highlighter` | `HighlighterCore` | *required* | Shiki highlighter instance |
| `lang` | `string` | *required* | Language for syntax highlighting |
| `theme` | `string` | *required* | Theme for syntax highlighting |
| `shikiOptions` | `Record<string, unknown>` | — | Additional options passed directly to Shiki's `codeToTokens` |
| `cursorPosition` | `string` | `"1:1"` | Initial cursor position (`"line:col"`, 1-based) |
| `onChange` | `(content: string) => void` | — | Called on every content change |
| `onYank` | `(text: string) => void` | — | Called when text is yanked (`yy`, `dw`, etc.) |
| `onSave` | `(content: string) => void` | — | Called on `:w` |
| `onModeChange` | `(mode: VimMode) => void` | — | Called when vim mode changes |
| `className` | `string` | — | Additional class name for the container |
| `readOnly` | `boolean` | `false` | Disable editing (motions still work) |
| `showLineNumbers` | `boolean` | `true` | Show line numbers |

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

### Search

| Key | Action |
|-----|--------|
| `/{pattern}` | Search forward (regex) |
| `?{pattern}` | Search backward (regex) |
| `n` / `N` | Next / Previous match |

### Scroll & Commands

| Key | Action |
|-----|--------|
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

// Build your own editor UI with the vim engine
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
bun run test        # Run tests (345 cases)
bun run typecheck   # Type check
bun run lint        # oxlint
bun run fmt         # oxfmt
```

## License

[MIT](./LICENSE)
