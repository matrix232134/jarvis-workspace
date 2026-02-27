"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import type { JarvisState, Message, DisplayCard, ArtifactRef, AttentionItem } from "@/lib/types"
import { useBridge, type BridgeFrame } from "@/lib/use-bridge"
import { useVoice } from "@/lib/use-voice"
import { useArtifact } from "@/lib/use-artifact"
import { useTheme } from "@/lib/use-theme"
import { useAudioReactive } from "@/lib/use-audio-reactive"
import { useSubAgents } from "@/lib/use-sub-agents"
import { useSystemData } from "@/lib/use-system-data"
import { mockOpenItems, mockTrustEntries } from "@/lib/mock-data"

import Waveform from "./waveform"
import Grain from "./grain"
import ContextBar from "./context-bar"
import InputBar from "./input-bar"
import Stream from "./stream"
import SubAgentRail from "./surfaces/sub-agent-rail"
import OpenItemsStrip from "./surfaces/open-items"
import TimeDivider from "./messages/time-divider"
import Briefing from "./messages/briefing"
import UserBubble from "./messages/user"
import JarvisVoice from "./messages/jarvis"
import ProactiveAlert from "./messages/proactive"
import ThinkingIndicator from "./messages/thinking"
import SystemDrawer from "./overlays/system-drawer"
import LibraryDrawer from "./overlays/library-drawer"
import ArtifactPanel from "./overlays/artifact-panel"
import CanvasPanel from "./overlays/canvas-panel"
import DisplayModal from "./overlays/display-modal"
import AttentionBanners from "./overlays/attention"

function resolveBridgeUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:19300"
  const host = window.location.hostname
  // Remote access via Tailscale (*.ts.net) or any non-local host → use wss
  if (host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.")) {
    return `wss://${host}:19300`
  }
  return process.env.NEXT_PUBLIC_BRIDGE_URL || "ws://127.0.0.1:19300"
}
const BRIDGE_URL = resolveBridgeUrl()
const BRIDGE_PAIRING_TOKEN = process.env.NEXT_PUBLIC_BRIDGE_PAIRING_TOKEN || "jarvis-ui"

export default function Workspace() {
  // Theme
  const { isDark, toggleTheme } = useTheme()

  // Audio reactive waveform
  const audioReactive = useAudioReactive()

  // Artifact state
  const artifact = useArtifact()

  // Real data hooks
  const subAgents = useSubAgents()
  const systemData = useSystemData()

  // Intermediate refs for voice frame routing (solves circular dependency)
  const voiceFrameRef = useRef<((frame: BridgeFrame) => void) | null>(null)
  const binaryFrameRef = useRef<((data: ArrayBuffer) => void) | null>(null)

  // Bridge connection — uses intermediate refs for voice frame routing
  const bridge = useBridge({
    url: BRIDGE_URL,
    pairingToken: BRIDGE_PAIRING_TOKEN,
    deviceName: "JARVIS Workspace",
    onVoiceFrame: voiceFrameRef,
    onBinaryFrame: binaryFrameRef,
  })

  // Voice pipeline — uses bridge's real sendFrame/sendBinary
  const voice = useVoice({
    enabled: true,
    sendFrame: bridge.sendFrame,
    sendBinary: bridge.sendBinary,
    onAddMessage: bridge.addMessage,
    onShowArtifact: (a) => artifact.showArtifact(a),
  })

  // Wire voice frame handlers into the intermediate refs
  // useVoice exposes voiceFrameRef/binaryFrameRef with the actual handlers
  voiceFrameRef.current = voice.voiceFrameRef.current
  binaryFrameRef.current = voice.binaryFrameRef.current

  // Derive jarvisState from bridge + voice status
  const jarvisState: JarvisState = useMemo(() => {
    if (bridge.status !== "connected") return "disconnected"
    if (voice.voiceStatus === "streaming") return "listening"
    if (voice.voiceStatus === "playing") return "speaking"
    if (bridge.isProcessing) return "processing"
    return "idle"
  }, [bridge.status, voice.voiceStatus, bridge.isProcessing])

  // Surface visibility
  const [showAgentRail, setShowAgentRail] = useState(true)
  const [showOpenItems, setShowOpenItems] = useState(true)
  const [showSystemDrawer, setShowSystemDrawer] = useState(false)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)

  // Hydrate canvas state from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    if (localStorage.getItem("jarvis-canvas-panel") === "open") {
      setShowCanvas(true)
    }
  }, [])

  const toggleCanvas = useCallback(() => {
    setShowCanvas((prev) => {
      const next = !prev
      localStorage.setItem("jarvis-canvas-panel", next ? "open" : "closed")
      return next
    })
  }, [])

  // Overlay state
  const [activeDisplay, setActiveDisplay] = useState<DisplayCard | null>(null)
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([])
  const [canvasDisplayItems, setCanvasDisplayItems] = useState<Array<{ title: string; content: string }>>([])
  const [inputPrefill, setInputPrefill] = useState<string | null>(null)

  // Panel offset for layout compression
  const [windowWidth, setWindowWidth] = useState(0)
  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])
  const canvasVisible = showCanvas && !artifact.panelOpen
  const panelOffset = artifact.panelOpen
    ? Math.min(windowWidth * 0.48, 620)
    : canvasVisible ? 360 : 0

  // Ctrl+, toggles Canvas panel
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault()
        toggleCanvas()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [toggleCanvas])

  // Send text message through bridge + speak response
  const handleSend = useCallback(
    async (text: string) => {
      const { voiceText, artifacts, displays } = await bridge.sendChat(text)
      if (voiceText) {
        voice.speakResponse(voiceText)
      }
      if (artifacts && artifacts.length > 0) {
        // Persist ALL artifacts to library — guaranteed capture
        artifact.saveAllToLibrary(artifacts)
        // Open the first one in the panel
        artifact.showArtifact(artifacts[0])
      }
      if (displays && displays.length > 0) {
        // Push display content to Canvas iframe
        setCanvasDisplayItems((prev) => [...prev, ...displays])
      }
    },
    [bridge.sendChat, voice.speakResponse, artifact.showArtifact, artifact.saveAllToLibrary]
  )

  const handleOpenDisplay = useCallback((display: DisplayCard) => {
    setActiveDisplay(display)
  }, [])

  const handleOpenArtifact = useCallback((ref: ArtifactRef) => {
    artifact.showArtifact(ref)
  }, [artifact.showArtifact])

  const handleDismissAttention = useCallback((id: string) => {
    setAttentionItems((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Library drawer handlers
  const handleOpenLibrary = useCallback(() => {
    setShowLibraryDrawer(true)
    setShowSystemDrawer(false) // Close system if open
  }, [])

  const handleLibraryOpen = useCallback((item: import("@/lib/use-artifact").Artifact) => {
    artifact.showArtifact(item)
    setShowLibraryDrawer(false)
  }, [artifact.showArtifact])

  const handleLibraryDiscuss = useCallback((item: import("@/lib/use-artifact").Artifact) => {
    setInputPrefill(`About "${item.title}": `)
    setShowLibraryDrawer(false)
  }, [])

  const handleAutomationDiscuss = useCallback((cron: import("@/lib/types").CronJob) => {
    setInputPrefill(`About "${cron.name}" automation: `)
    setShowLibraryDrawer(false)
  }, [])

  const handlePrefillConsumed = useCallback(() => {
    setInputPrefill(null)
  }, [])

  const runningAgents = subAgents.agents.filter((a) => a.status === "running")

  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* Background layers */}
      <Waveform state={jarvisState} audioLevels={audioReactive.active ? audioReactive.levels : undefined} />
      <Grain isDark={isDark} />

      {/* Attention banners */}
      <AttentionBanners items={attentionItems} onDismiss={handleDismissAttention} />

      {/* Context bar */}
      <ContextBar
        state={jarvisState}
        agentCount={runningAgents.length}
        onToggleAgents={() => setShowAgentRail((p) => !p)}
        onOpenLibrary={handleOpenLibrary}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        audioReactive={audioReactive.active}
        onToggleAudio={audioReactive.toggle}
        onToggleCanvas={toggleCanvas}
        showCanvas={canvasVisible}
      />

      {/* Sub-agent rail */}
      {showAgentRail && runningAgents.length > 0 && (
        <SubAgentRail agents={subAgents.agents} />
      )}

      {/* Conversation stream */}
      <Stream panelOffset={panelOffset}>
        {/* Open items strip */}
        {showOpenItems && mockOpenItems.length > 0 && (
          <OpenItemsStrip
            items={mockOpenItems}
            onDismiss={() => setShowOpenItems(false)}
          />
        )}

        {/* Messages */}
        {bridge.messages.map((msg) => {
          switch (msg.type) {
            case "separator":
              return <TimeDivider key={msg.id} message={msg} />
            case "briefing":
              return <Briefing key={msg.id} message={msg} />
            case "user":
              return <UserBubble key={msg.id} message={msg} />
            case "jarvis":
              return (
                <JarvisVoice
                  key={msg.id}
                  message={msg}
                  onOpenDisplay={handleOpenDisplay}
                  onOpenArtifact={handleOpenArtifact}
                />
              )
            case "proactive":
              return <ProactiveAlert key={msg.id} message={msg} />
            default:
              return null
          }
        })}

        {/* Thinking indicator */}
        {bridge.isProcessing && <ThinkingIndicator />}
      </Stream>

      {/* Input bar */}
      <InputBar
        state={jarvisState}
        onSend={handleSend}
        panelOffset={panelOffset}
        onVoiceToggle={voice.toggleSession}
        voiceReady={voice.voiceStatus !== "unavailable" && voice.voiceStatus !== "initializing"}
        transcript={voice.transcript}
        hasWakeWord={voice.hasWakeWord}
        connectionStatus={bridge.status}
        prefill={inputPrefill}
        onPrefillConsumed={handlePrefillConsumed}
      />

      {/* Overlays */}
      {showLibraryDrawer && (
        <LibraryDrawer
          items={artifact.libraryItems}
          crons={systemData.crons}
          onOpen={handleLibraryOpen}
          onDiscuss={handleLibraryDiscuss}
          onDiscussAutomation={handleAutomationDiscuss}
          onClose={() => setShowLibraryDrawer(false)}
        />
      )}

      {showSystemDrawer && (
        <SystemDrawer
          services={systemData.services}
          devices={systemData.devices}
          crons={systemData.crons}
          trust={mockTrustEntries}
          skills={systemData.skills}
          model={systemData.model}
          heartbeat={systemData.heartbeat}
          onClose={() => setShowSystemDrawer(false)}
        />
      )}

      {artifact.panelOpen && artifact.activeArtifact && (
        <ArtifactPanel
          artifact={artifact.activeArtifact}
          history={artifact.history}
          onSelectHistory={artifact.selectFromHistory}
          onClose={artifact.closePanel}
        />
      )}

      {canvasVisible && (
        <CanvasPanel
          onClose={toggleCanvas}
          onSendMessage={(text) => handleSend(text)}
          isDark={isDark}
          jarvisState={jarvisState}
          services={systemData.services}
          devices={systemData.devices}
          model={systemData.model}
          heartbeat={systemData.heartbeat}
          connectionStatus={bridge.status}
          displayItems={canvasDisplayItems}
        />
      )}

      {activeDisplay && (
        <DisplayModal
          display={activeDisplay}
          onClose={() => setActiveDisplay(null)}
        />
      )}
    </div>
  )
}
