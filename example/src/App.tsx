import { useState, useEffect } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import ShikiVim from "shiki-vim";
import "shiki-vim/styles.css";

const sampleCode = `import { useState } from "react";

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
}`;

function App() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [mode, setMode] = useState("normal");

  useEffect(() => {
    createHighlighter({
      themes: ["vitesse-dark"],
      langs: ["tsx"],
    }).then(setHighlighter);
  }, []);

  if (!highlighter) {
    return <div style={{ color: "#ccc", padding: 32 }}>Loading Shiki...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#ccc" }}>shiki-vim example</h1>
      <p style={{ color: "#888" }}>
        Current mode: <code style={{ color: "#7ec" }}>{mode}</code> — Click the
        editor and start typing vim commands!
      </p>

      <ShikiVim
        content={sampleCode}
        highlighter={highlighter}
        lang="tsx"
        theme="vitesse-dark"
        onSave={(content) => {
          console.log("Saved!", content.length, "chars");
          alert("Saved! (check console)");
        }}
        onYank={(text) => {
          navigator.clipboard.writeText(text);
          console.log("Yanked:", text);
        }}
        onChange={(content) => {
          console.log("Changed:", content.length, "chars");
        }}
        onModeChange={(m) => setMode(m)}
      />
    </div>
  );
}

export default App;
