"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { ArtifactRef } from "@/lib/types"
import type { Artifact } from "@/lib/use-artifact"

// Button style helper (matching new UI: 0.5px borders, var(--border), etc.)
function PanelButton({
  onClick,
  label,
  active,
}: {
  onClick: () => void
  label: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="font-sans cursor-pointer"
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: active ? "var(--accent)" : "var(--ink-tertiary)",
        border: active ? "0.5px solid var(--accent-ring)" : "0.5px solid var(--border)",
        borderRadius: 8,
        padding: "5px 10px",
        backgroundColor: active ? "var(--accent-faint)" : "transparent",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = "var(--surface-hover)"
          e.currentTarget.style.borderColor = "var(--border-focus)"
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = "transparent"
          e.currentTarget.style.borderColor = "var(--border)"
        }
      }}
    >
      {label}
    </button>
  )
}

// === Renderers ===

function MermaidRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          themeVariables: {
            primaryColor: "#1D4ED8",
            primaryTextColor: "#1A1A19",
            primaryBorderColor: "#EBEBEA",
            lineColor: "#D4D4D2",
            secondaryColor: "#F7F7F6",
            tertiaryColor: "#F2F2F0",
            background: "#FAFAF9",
            mainBkg: "#FFFFFF",
            nodeBorder: "#EBEBEA",
            clusterBkg: "#F7F7F6",
            titleColor: "#1A1A19",
            edgeLabelBackground: "#FFFFFF",
          },
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 13,
        })
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, content)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Mermaid render failed")
      }
    }
    render()
    return () => { cancelled = true }
  }, [content])

  if (error) return <CodeRenderer content={content} language="mermaid" error={error} />

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: "var(--bg)",
        border: "0.5px solid var(--border-light)",
        borderRadius: 12,
        padding: 22,
        overflow: "auto",
      }}
    />
  )
}

function SvgRenderer({ content }: { content: string }) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg)",
        border: "0.5px solid var(--border-light)",
        borderRadius: 12,
        padding: 22,
        overflow: "auto",
      }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

function CodeRenderer({ content, language, error }: { content: string; language?: string; error?: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki")
        const result = await codeToHtml(content, {
          lang: language || "text",
          theme: "github-light-default",
        })
        if (!cancelled) setHtml(result)
      } catch {
        // Shiki failed — fallback to plain text
      }
    }
    highlight()
    return () => { cancelled = true }
  }, [content, language])

  return (
    <div>
      {error && (
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            color: "var(--j-red)",
            backgroundColor: "var(--red-faint)",
            border: "0.5px solid var(--j-red)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 12,
          }}
        >
          Parse error: {error}
        </div>
      )}
      {html ? (
        <div
          style={{
            backgroundColor: "var(--bg)",
            border: "0.5px solid var(--border-light)",
            borderRadius: 12,
            padding: 22,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.8,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre
          className="font-mono whitespace-pre-wrap"
          style={{
            backgroundColor: "var(--bg)",
            border: "0.5px solid var(--border-light)",
            borderRadius: 12,
            padding: 22,
            fontSize: 13,
            lineHeight: 1.8,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {content}
        </pre>
      )}
    </div>
  )
}

function HtmlRenderer({ content }: { content: string }) {
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0; padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px; line-height: 1.6;
          color: #1A1A19; background: #FAFAF9;
        }
        * { box-sizing: border-box; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `
  return (
    <iframe
      srcDoc={body}
      sandbox="allow-scripts"
      style={{
        width: "100%",
        minHeight: 300,
        border: "0.5px solid var(--border-light)",
        borderRadius: 12,
        backgroundColor: "var(--bg)",
      }}
    />
  )
}

function ReactRenderer({ content }: { content: string }) {
  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
      <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body {
          margin: 0; padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1A1A19; background: #FAFAF9;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script type="text/babel">
        ${content}
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(typeof App !== 'undefined' ? App : () => React.createElement('div', null, 'No App component found')));
      </script>
    </body>
    </html>
  `
  return (
    <iframe
      srcDoc={body}
      sandbox="allow-scripts"
      style={{
        width: "100%",
        minHeight: 400,
        border: "0.5px solid var(--border-light)",
        borderRadius: 12,
        backgroundColor: "var(--bg)",
      }}
    />
  )
}

function ArtifactRenderer({ artifact }: { artifact: ArtifactRef }) {
  const t = artifact.type.toLowerCase()

  if (t === "mermaid" || t === "diagram") {
    return <MermaidRenderer content={artifact.content} />
  }
  if (t === "svg") {
    return <SvgRenderer content={artifact.content} />
  }
  if (t === "html") {
    return <HtmlRenderer content={artifact.content} />
  }
  if (t === "react") {
    return <ReactRenderer content={artifact.content} />
  }
  // Default: code
  return <CodeRenderer content={artifact.content} language={artifact.language} />
}

// === Main Panel ===

export default function ArtifactPanel({
  artifact,
  history,
  onSelectHistory,
  onClose,
}: {
  artifact: ArtifactRef | Artifact
  history?: Artifact[]
  onSelectHistory?: (id: string) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [artifact.content])

  return (
    <div
      ref={panelRef}
      className="fixed bottom-0 right-0 overflow-y-auto"
      style={{
        top: 48,
        width: "min(48vw, 620px)",
        minWidth: 380,
        backgroundColor: "var(--surface)",
        borderLeft: "0.5px solid var(--border)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.03)",
        zIndex: 55,
        animation: "j-slide-right 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 sticky top-0"
        style={{
          padding: "16px 20px",
          backgroundColor: "var(--surface)",
          borderBottom: "0.5px solid var(--border-light)",
          zIndex: 2,
        }}
      >
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "var(--accent)",
          }}
        >
          {artifact.type}
        </span>

        {/* Hairline separator */}
        <span
          style={{
            width: 0.5,
            height: 14,
            backgroundColor: "rgba(29,78,216,0.12)",
          }}
        />

        <span
          className="font-sans flex-1"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {artifact.title}
        </span>

        {/* History button */}
        {history && history.length > 1 && onSelectHistory && (
          <PanelButton
            onClick={() => setShowHistory((p) => !p)}
            label={`History (${history.length})`}
            active={showHistory}
          />
        )}

        {/* Copy button */}
        <PanelButton onClick={handleCopy} label={copied ? "Copied" : "Copy"} />

        {/* Close button */}
        <PanelButton onClick={onClose} label="Close" />
      </div>

      {/* History dropdown */}
      {showHistory && history && onSelectHistory && (
        <div
          style={{
            padding: "8px 20px",
            borderBottom: "0.5px solid var(--border-light)",
            backgroundColor: "var(--bg)",
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {history
              .slice()
              .reverse()
              .map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    onSelectHistory(h.id)
                    setShowHistory(false)
                  }}
                  className="font-sans cursor-pointer"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color:
                      "id" in artifact && (artifact as Artifact).id === h.id
                        ? "var(--accent)"
                        : "var(--ink-secondary)",
                    backgroundColor:
                      "id" in artifact && (artifact as Artifact).id === h.id
                        ? "var(--accent-faint)"
                        : "var(--surface)",
                    border: "0.5px solid var(--border)",
                    borderRadius: 6,
                    padding: "4px 8px",
                    transition: "all 0.15s",
                  }}
                >
                  {h.title}
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--ink-faint)",
                      marginLeft: 6,
                    }}
                  >
                    {h.timestamp}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: 20 }}>
        <ArtifactRenderer artifact={artifact} />
      </div>
    </div>
  )
}
