"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { Artifact } from "@/lib/use-artifact"

interface ArtifactPanelProps {
  artifact: Artifact | null
  history: Artifact[]
  open: boolean
  onClose: () => void
  onSelectHistory: (id: string) => void
}

export function ArtifactPanel({ artifact, history, open, onClose, onSelectHistory }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const copyContent = useCallback(() => {
    if (!artifact) return
    navigator.clipboard.writeText(artifact.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [artifact])

  if (!open || !artifact) return null

  return (
    <div className="fixed top-0 right-0 h-dvh w-[45vw] min-w-[400px] max-w-[700px] border-l border-glass-border bg-background/95 backdrop-blur-xl z-30 animate-slide-in-right flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {artifact.type}
          </span>
          <h2 className="text-sm font-medium text-foreground/90 truncate max-w-[300px]">
            {artifact.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* History */}
          {history.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="px-2.5 py-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground/80 border border-glass-border rounded-lg transition-colors"
              >
                {history.length} artifacts
              </button>
              {historyOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-glass-border bg-background/95 backdrop-blur-xl shadow-2xl z-50 py-1 max-h-[300px] overflow-y-auto">
                  {history.slice().reverse().map((h) => (
                    <button
                      key={h.id}
                      onClick={() => { onSelectHistory(h.id); setHistoryOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-glass/60 transition-colors flex items-center gap-2",
                        h.id === artifact.id && "bg-primary/[0.08]"
                      )}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 flex-shrink-0">
                        {h.type}
                      </span>
                      <span className="text-[12px] text-foreground/80 truncate">{h.title}</span>
                      <span className="text-[10px] text-muted-foreground/40 ml-auto flex-shrink-0">{h.timestamp}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Copy */}
          <button
            onClick={copyContent}
            className="px-2.5 py-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground/80 border border-glass-border rounded-lg transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground/80 border border-glass-border rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <ArtifactRenderer artifact={artifact} />
      </div>
    </div>
  )
}

function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "mermaid":
      return <MermaidRenderer content={artifact.content} />
    case "svg":
      return <SvgRenderer content={artifact.content} />
    case "code":
      return <CodeRenderer content={artifact.content} language={artifact.language} />
    case "html":
      return <HtmlRenderer content={artifact.content} />
    case "react":
      return <ReactRenderer content={artifact.content} />
    default:
      return <CodeRenderer content={artifact.content} language={artifact.language} />
  }
}

// --- Mermaid Renderer ---

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
          theme: "dark",
          themeVariables: {
            primaryColor: "oklch(0.62 0.18 250)",
            primaryTextColor: "#e5e5e5",
            primaryBorderColor: "oklch(0.45 0.005 260 / 0.40)",
            lineColor: "oklch(0.55 0.005 260 / 0.60)",
            secondaryColor: "oklch(0.26 0.006 260)",
            tertiaryColor: "oklch(0.22 0.006 260)",
            background: "oklch(0.18 0.008 260)",
            mainBkg: "oklch(0.24 0.006 260)",
            nodeBorder: "oklch(0.62 0.18 250 / 0.5)",
            clusterBkg: "oklch(0.22 0.006 260)",
            clusterBorder: "oklch(0.45 0.005 260 / 0.40)",
            titleColor: "#e5e5e5",
            edgeLabelBackground: "oklch(0.22 0.006 260)",
          },
        })
        const id = `mermaid-${crypto.randomUUID().slice(0, 8)}`
        const { svg } = await mermaid.render(id, content)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [content])

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.05] p-4">
        <p className="text-[11px] text-destructive/80 mb-2">Mermaid render error:</p>
        <pre className="text-[12px] text-foreground/70 whitespace-pre-wrap font-mono">{error}</pre>
        <pre className="text-[12px] text-foreground/50 whitespace-pre-wrap font-mono mt-3 border-t border-glass-border pt-3">{content}</pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center min-h-[200px] [&_svg]:max-w-full"
    />
  )
}

// --- SVG Renderer ---

function SvgRenderer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Basic sanitization: only allow SVG content
    if (content.trim().startsWith("<svg") || content.trim().startsWith("<?xml")) {
      containerRef.current.innerHTML = content
    } else {
      containerRef.current.innerHTML = `<p class="text-foreground/60 text-sm">Invalid SVG content</p>`
    }
  }, [content])

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto"
    />
  )
}

// --- Code Renderer ---

function CodeRenderer({ content, language }: { content: string; language?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki")
        const html = await codeToHtml(content, {
          lang: language ?? "text",
          theme: "github-dark-default",
        })
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = html
          setLoaded(true)
        }
      } catch {
        // Fallback: plain pre
        if (!cancelled && containerRef.current) {
          const pre = document.createElement("pre")
          pre.className = "text-[13px] leading-6 text-foreground/90 whitespace-pre-wrap font-mono"
          pre.textContent = content
          containerRef.current.innerHTML = ""
          containerRef.current.appendChild(pre)
          setLoaded(true)
        }
      }
    }
    highlight()
    return () => { cancelled = true }
  }, [content, language])

  return (
    <div className="rounded-xl border border-glass-border overflow-hidden">
      {language && (
        <div className="px-4 py-2 border-b border-glass-border bg-glass/30">
          <span className="text-[10px] font-mono text-muted-foreground/60">{language}</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "p-4 overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!text-[13px] [&_code]:!leading-6",
          !loaded && "min-h-[100px] animate-pulse bg-glass/20"
        )}
      />
    </div>
  )
}

// --- HTML Renderer (sandboxed iframe) ---

function HtmlRenderer({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const srcdoc = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: oklch(0.18 0.008 260); color: #e5e5e5; font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.6; }
  a { color: oklch(0.78 0.16 250); }
</style>
</head><body>${content}</body></html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      className="w-full min-h-[400px] h-[60vh] rounded-xl border border-glass-border bg-background"
      title="HTML Artifact"
    />
  )
}

// --- React Renderer (sandboxed iframe with React CDN) ---

function ReactRenderer({ content }: { content: string }) {
  const srcdoc = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: oklch(0.18 0.008 260); color: #e5e5e5; font-family: system-ui, sans-serif; }
</style>
</head><body>
<div id="root"></div>
<script type="text/babel">
${content}
const root = ReactDOM.createRoot(document.getElementById('root'));
if (typeof App !== 'undefined') { root.render(React.createElement(App)); }
</script>
</body></html>`

  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      className="w-full min-h-[400px] h-[60vh] rounded-xl border border-glass-border bg-background"
      title="React Artifact"
    />
  )
}
