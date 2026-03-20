import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { createHighlighter, bundledLanguages, bundledThemes, type Highlighter } from "shiki";
import ShikiVim, { type VimAction } from "shiki-vim";
import "shiki-vim/styles.css";

const themes = Object.keys(bundledThemes);
const langs = Object.keys(bundledLanguages);

const initialCode = `package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// Config holds the application configuration.
type Config struct {
	Port         int           \`json:"port"\`
	ReadTimeout  time.Duration \`json:"read_timeout"\`
	WriteTimeout time.Duration \`json:"write_timeout"\`
	MaxBodySize  int64         \`json:"max_body_size"\`
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() Config {
	return Config{
		Port:         8080,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		MaxBodySize:  1 << 20, // 1 MB
	}
}

// Task represents a unit of work.
type Task struct {
	ID        string    \`json:"id"\`
	Title     string    \`json:"title"\`
	Done      bool      \`json:"done"\`
	CreatedAt time.Time \`json:"created_at"\`
}

// TaskStore is a thread-safe in-memory store for tasks.
type TaskStore struct {
	mu    sync.RWMutex
	tasks map[string]*Task
}

// NewTaskStore creates an empty TaskStore.
func NewTaskStore() *TaskStore {
	return &TaskStore{
		tasks: make(map[string]*Task),
	}
}

// Add inserts a new task and returns its ID.
func (s *TaskStore) Add(title string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := generateID()
	s.tasks[id] = &Task{
		ID:        id,
		Title:     title,
		Done:      false,
		CreatedAt: time.Now(),
	}
	return id
}

// Get retrieves a task by ID.
func (s *TaskStore) Get(id string) (*Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	t, ok := s.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task %q not found", id)
	}
	return t, nil
}

// List returns all tasks sorted by creation time.
func (s *TaskStore) List() []*Task {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Task, 0, len(s.tasks))
	for _, t := range s.tasks {
		result = append(result, t)
	}
	return result
}

// Toggle flips the done status of a task.
func (s *TaskStore) Toggle(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	t, ok := s.tasks[id]
	if !ok {
		return fmt.Errorf("task %q not found", id)
	}
	t.Done = !t.Done
	return nil
}

// Delete removes a task by ID.
func (s *TaskStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.tasks[id]; !ok {
		return fmt.Errorf("task %q not found", id)
	}
	delete(s.tasks, id)
	return nil
}

// Server wraps the HTTP server and task store.
type Server struct {
	cfg   Config
	store *TaskStore
	srv   *http.Server
}

// NewServer creates a Server with the given config.
func NewServer(cfg Config) *Server {
	s := &Server{
		cfg:   cfg,
		store: NewTaskStore(),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /tasks", s.handleListTasks)
	mux.HandleFunc("POST /tasks", s.handleCreateTask)
	mux.HandleFunc("GET /tasks/{id}", s.handleGetTask)
	mux.HandleFunc("PATCH /tasks/{id}/toggle", s.handleToggleTask)
	mux.HandleFunc("DELETE /tasks/{id}", s.handleDeleteTask)
	mux.HandleFunc("GET /health", s.handleHealth)

	s.srv = &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      withLogging(mux),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}
	return s
}

// Run starts the server and blocks until a signal is received.
func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		log.Printf("listening on %s", s.srv.Addr)
		if err := s.srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-ctx.Done():
		log.Println("shutting down gracefully...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return s.srv.Shutdown(shutdownCtx)
	}
}

// --- Handlers ---

func (s *Server) handleListTasks(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.store.List())
}

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string \`json:"title"\`
	}
	if err := readJSON(r.Body, s.cfg.MaxBodySize, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if body.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	id := s.store.Add(body.Title)
	task, _ := s.store.Get(id)
	writeJSON(w, http.StatusCreated, task)
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := s.store.Get(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleToggleTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.Toggle(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	task, _ := s.store.Get(id)
	writeJSON(w, http.StatusOK, task)
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.store.Delete(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- Middleware ---

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON: %v", err)
	}
}

func readJSON(body io.Reader, maxSize int64, dst any) error {
	limited := io.LimitReader(body, maxSize)
	return json.NewDecoder(limited).Decode(dst)
}

func generateID() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func main() {
	cfg := DefaultConfig()
	if envPort := os.Getenv("PORT"); envPort != "" {
		fmt.Sscanf(envPort, "%d", &cfg.Port)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	srv := NewServer(cfg)
	if err := srv.Run(ctx); err != nil {
		log.Fatal(err)
	}
}
`;

// CSS variables exposed by shiki-vim
type VarType = "text" | "color";

interface ColorState {
  hex: string;
  opacity: number; // 0–100
}

const cssVarDefs: { key: string; label: string; initial: string; type: VarType; initialColor?: ColorState }[] = [
  { key: "--sv-font-size", label: "Font Size", initial: "14px", type: "text" },
  { key: "--sv-line-height", label: "Line Height", initial: "1.5", type: "text" },
  { key: "--sv-font-family", label: "Font Family", initial: '"Menlo", "Monaco", "Courier New", monospace', type: "text" },
  { key: "--sv-cursor-color", label: "Cursor Color", initial: "#ffffff99", type: "color", initialColor: { hex: "#ffffff", opacity: 60 } },
  { key: "--sv-selection-bg", label: "Selection BG", initial: "#6496ff4d", type: "color", initialColor: { hex: "#6496ff", opacity: 30 } },
  { key: "--sv-gutter-color", label: "Gutter Color", initial: "#858585", type: "color", initialColor: { hex: "#858585", opacity: 100 } },
  { key: "--sv-gutter-bg", label: "Gutter BG", initial: "transparent", type: "color", initialColor: { hex: "#000000", opacity: 0 } },
  { key: "--sv-statusline-bg", label: "Statusline BG", initial: "#252526", type: "color", initialColor: { hex: "#252526", opacity: 100 } },
  { key: "--sv-statusline-fg", label: "Statusline FG", initial: "#cccccc", type: "color", initialColor: { hex: "#cccccc", opacity: 100 } },
];

function toHex8(hex: string, opacity: number): string {
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
}

interface HistoryEntry {
  timestamp: Date;
  operation: string;
  detail: string;
  note: string;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default function App() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [theme, setTheme] = useState("vitesse-dark");
  const [lang, setLang] = useState("go");
  const [code, setCode] = useState(initialCode);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [colorStates, setColorStates] = useState<Record<string, ColorState>>(() => {
    const init: Record<string, ColorState> = {};
    for (const def of cssVarDefs) {
      if (def.initialColor) init[def.key] = { ...def.initialColor };
    }
    return init;
  });
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const addHistory = useCallback((operation: string, detail: string) => {
    setHistory((prev) => [...prev, { timestamp: new Date(), operation, detail, note: "" }]);
  }, []);

  const updateNote = useCallback((index: number, note: string) => {
    setHistory((prev) => prev.map((e, i) => i === index ? { ...e, note } : e));
  }, []);

  const buildReport = useCallback(() => {
    const lines: string[] = [];
    lines.push("## shiki-vim debug report");
    lines.push("");
    lines.push(`- theme: ${theme}`);
    lines.push(`- lang: ${lang}`);
    const customVars = Object.entries(cssVars).filter(([, v]) => v);
    if (customVars.length > 0) {
      lines.push(`- css variables: ${customVars.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    }
    lines.push("");
    lines.push("### operation log");
    lines.push("");
    for (let i = 0; i < history.length; i++) {
      const e = history[i];
      let line = `${i + 1}. ${formatTimestamp(e.timestamp)} | <${e.operation}> ${e.detail}`;
      if (e.note) {
        line += `  -- ${e.note}`;
      }
      lines.push(line);
    }
    lines.push("");
    lines.push("### editor content at time of report");
    lines.push("");
    lines.push("```" + lang);
    lines.push(code);
    lines.push("```");
    return lines.join("\n");
  }, [theme, lang, cssVars, history, code]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(buildReport()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [buildReport]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  useEffect(() => {
    if (editingNote !== null) {
      noteInputRef.current?.focus();
    }
  }, [editingNote]);

  useEffect(() => {
    createHighlighter({
      themes: [theme],
      langs: [lang],
    }).then((h) => {
      setHighlighter(h);
      addHistory("init", `highlighter loaded (${theme}, ${lang})`);
    });
  }, [theme, lang, addHistory]);

  const handleAction = useCallback(
    (action: VimAction, key: string) => {
      const displayKey = key === " " ? "Space" : key;
      switch (action.type) {
        case "cursor-move":
          addHistory("cursor-move", `[${displayKey}] -> ${action.position.line + 1}:${action.position.col + 1}`);
          break;
        case "content-change":
          setCode(action.content);
          addHistory("content-change", `[${displayKey}] ${action.content.split("\n").length} lines`);
          break;
        case "mode-change":
          addHistory("mode-change", `[${displayKey}] -> ${action.mode}`);
          break;
        case "yank": {
          const preview = action.text.length > 40 ? `${action.text.slice(0, 40)}...` : action.text;
          addHistory("yank", `[${displayKey}] "${preview.replace(/\n/g, "\\n")}"`);
          break;
        }
        case "save":
          addHistory("save", `[${displayKey}] :w`);
          break;
        case "scroll":
          addHistory("scroll", `[${displayKey}] ${action.direction} ${action.amount}`);
          break;
        case "status-message":
          if (action.message) addHistory("status", `[${displayKey}] ${action.message}`);
          break;
        case "noop":
          break;
      }
    },
    [addHistory],
  );

  const updateCssVar = useCallback((key: string, value: string) => {
    setCssVars((prev) => {
      if (value === "") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const updateColor = useCallback((key: string, patch: Partial<ColorState>) => {
    setColorStates((prev) => {
      const current = prev[key] ?? { hex: "#000000", opacity: 100 };
      const next = { ...current, ...patch };
      setCssVars((p) => ({ ...p, [key]: toHex8(next.hex, next.opacity) }));
      return { ...prev, [key]: next };
    });
  }, []);

  if (!highlighter) {
    return <p style={{ color: "#cdd6f4" }}>Loading highlighter...</p>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>
        shiki-vim debug
      </h1>

      {/* Controls */}
      <div style={controlsStyle}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={labelStyle}>
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)} style={selectStyle}>
              {themes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Lang
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={selectStyle}>
              {langs.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        <div style={cssVarsSectionStyle}>
          <span style={{ color: "#a6adc8", fontSize: "12px", fontWeight: 600 }}>CSS Variables</span>
          <div style={cssVarsGridStyle}>
            {cssVarDefs.map(({ key, label, initial, type }) => (
              <div key={key} style={cssVarLabelStyle}>
                <span style={{ color: "#a6adc8", minWidth: "90px" }}>{label}</span>
                {type === "color" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="color"
                      value={colorStates[key]?.hex ?? "#000000"}
                      onChange={(e) => updateColor(key, { hex: e.target.value })}
                      style={colorPickerStyle}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={colorStates[key]?.opacity ?? 100}
                      onChange={(e) => updateColor(key, { opacity: Number(e.target.value) })}
                      style={rangeStyle}
                    />
                    <span style={opacityValueStyle}>
                      {colorStates[key]?.opacity ?? 100}%
                    </span>
                    <span style={hexPreviewStyle}>
                      {cssVars[key] || initial}
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={initial}
                    value={cssVars[key] ?? ""}
                    onChange={(e) => updateCssVar(key, e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div style={cssVars as CSSProperties}>
        <ShikiVim
          content={code}
          highlighter={highlighter}
          lang={lang}
          theme={theme}
          onChange={setCode}
          onAction={handleAction}
          autoFocus
          className="debug-editor"
        />
      </div>

      {/* History */}
      <div style={historyContainerStyle}>
        <div style={historyHeaderStyle}>
          <span>History ({history.length})</span>
          <button
            onClick={() => setHistory([])}
            style={historyBtnStyle}
          >
            Clear
          </button>
          <button
            onClick={handleCopy}
            style={historyBtnStyle}
          >
            {copied ? "Copied!" : "Copy for LLM"}
          </button>
        </div>
        <div style={historyBodyStyle}>
          {history.length === 0 ? (
            <div style={{ padding: "4px 12px", color: "#585b70" }}>
              No operations yet
            </div>
          ) : (
            history.map((entry, i) => (
              <div
                key={i}
                style={historyEntryStyle}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#45475a", minWidth: "24px", textAlign: "right", userSelect: "none" }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: "#585b70" }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  {" | "}
                  <span style={{ color: operationColor(entry.operation) }}>
                    {"<"}{entry.operation}{">"}
                  </span>{" "}
                  {entry.detail}
                  {entry.note && (
                    <span style={{ color: "#f38ba8", marginLeft: "8px" }}>
                      -- {entry.note}
                    </span>
                  )}
                  <button
                    onClick={() => setEditingNote(editingNote === i ? null : i)}
                    style={noteBtnStyle}
                    title="Add note"
                  >
                    {entry.note ? "edit" : "+ note"}
                  </button>
                </div>
                {editingNote === i && (
                  <div style={{ marginLeft: "28px", marginTop: "2px" }}>
                    <input
                      ref={noteInputRef}
                      type="text"
                      placeholder="e.g. this is where the bug happened"
                      value={entry.note}
                      onChange={(e) => updateNote(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          e.stopPropagation();
                          setEditingNote(null);
                        }
                      }}
                      style={noteInputStyle}
                    />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={historyEndRef} />
        </div>
      </div>
    </div>
  );
}

function operationColor(op: string): string {
  switch (op) {
    case "cursor-move":
      return "#94e2d5";
    case "mode-change":
      return "#cba6f7";
    case "content-change":
      return "#a6e3a1";
    case "yank":
      return "#f9e2af";
    case "save":
      return "#89b4fa";
    case "scroll":
      return "#74c7ec";
    case "status":
      return "#fab387";
    case "init":
      return "#585b70";
    default:
      return "#cdd6f4";
  }
}

// -- Styles --

const controlsStyle: CSSProperties = {
  marginBottom: "0.75rem",
  padding: "12px",
  background: "#11111b",
  border: "1px solid #313244",
  borderRadius: "6px",
};

const labelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "13px",
  color: "#a6adc8",
};

const selectStyle: CSSProperties = {
  background: "#1e1e2e",
  color: "#cdd6f4",
  border: "1px solid #313244",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "13px",
};

const cssVarsSectionStyle: CSSProperties = {
  marginTop: "0.75rem",
  paddingTop: "0.75rem",
  borderTop: "1px solid #313244",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const cssVarsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
  gap: "6px",
};

const cssVarLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  fontSize: "12px",
};

const inputStyle: CSSProperties = {
  background: "#1e1e2e",
  color: "#cdd6f4",
  border: "1px solid #313244",
  borderRadius: "4px",
  padding: "3px 6px",
  fontSize: "12px",
  fontFamily: "monospace",
  width: "140px",
};

const colorPickerStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  padding: "1px",
  border: "1px solid #313244",
  borderRadius: "4px",
  background: "#1e1e2e",
  cursor: "pointer",
  flexShrink: 0,
};

const rangeStyle: CSSProperties = {
  width: "80px",
  accentColor: "#cba6f7",
  cursor: "pointer",
};

const opacityValueStyle: CSSProperties = {
  fontSize: "11px",
  color: "#a6adc8",
  fontFamily: "monospace",
  minWidth: "32px",
  textAlign: "right",
};

const hexPreviewStyle: CSSProperties = {
  fontSize: "11px",
  color: "#585b70",
  fontFamily: "monospace",
};

const historyContainerStyle: CSSProperties = {
  marginTop: "1rem",
  background: "#11111b",
  border: "1px solid #313244",
  borderRadius: "6px",
  fontFamily: "monospace",
  fontSize: "12px",
  height: "240px",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const historyHeaderStyle: CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid #313244",
  color: "#a6adc8",
  fontWeight: 600,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const historyBtnStyle: CSSProperties = {
  background: "#1e1e2e",
  color: "#a6adc8",
  border: "1px solid #313244",
  borderRadius: "4px",
  padding: "2px 8px",
  fontSize: "11px",
  cursor: "pointer",
  fontFamily: "monospace",
};

const historyBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "4px 0",
};

const historyEntryStyle: CSSProperties = {
  padding: "2px 12px",
  color: "#cdd6f4",
  whiteSpace: "nowrap",
};

const noteBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "#585b70",
  fontSize: "10px",
  cursor: "pointer",
  padding: "0 4px",
  fontFamily: "monospace",
  marginLeft: "auto",
};

const noteInputStyle: CSSProperties = {
  background: "#1e1e2e",
  color: "#f38ba8",
  border: "1px solid #45475a",
  borderRadius: "3px",
  padding: "2px 6px",
  fontSize: "11px",
  fontFamily: "monospace",
  width: "100%",
  outline: "none",
};
