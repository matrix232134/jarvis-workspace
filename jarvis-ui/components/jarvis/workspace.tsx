"use client"

import { useState, useCallback } from "react"
import { JarvisSidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { MessageStream } from "./message-stream"
import { InputBar } from "./input-bar"
import { ArtifactPanel } from "./artifact-panel"
import { useBridge } from "@/lib/use-bridge"
import { useVoice } from "@/lib/use-voice"
import { useArtifact } from "@/lib/use-artifact"
import { cn } from "@/lib/utils"

const BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || "ws://127.0.0.1:19300"
const BRIDGE_PAIRING_TOKEN = process.env.NEXT_PUBLIC_BRIDGE_PAIRING_TOKEN || "0f78c90c-c00a-4a17-ac9b-15e1b1f531b5"
const PICOVOICE_ACCESS_KEY = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY || "9tMDzB9p86Vf/zXV4R82fwt1nGvrRzQJEmMZqgJ+bjC9JQx5TS5C+g=="

export function JarvisWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const artifact = useArtifact()

  const voice = useVoice({
    accessKey: PICOVOICE_ACCESS_KEY,
    enabled: true,
    sendFrame: (frame) => sendFrame(frame),
    sendBinary: (data) => sendBinary(data),
    onAddMessage: (msg) => addMessage(msg),
    onShowArtifact: (a) => artifact.showArtifact(a),
  })

  const { status, messages, isProcessing, sendChat, sendFrame, sendBinary, addMessage } = useBridge({
    url: BRIDGE_URL,
    pairingToken: BRIDGE_PAIRING_TOKEN,
    deviceName: "jarvis-ui",
    onVoiceFrame: voice.voiceFrameRef,
    onBinaryFrame: voice.binaryFrameRef,
  })

  // Send text and speak the response via voice pipeline
  const handleSend = useCallback(async (text: string) => {
    const voiceText = await sendChat(text)
    if (voiceText) {
      voice.speakResponse(voiceText)
    }
  }, [sendChat, voice.speakResponse])

  const statusLabel =
    status === "connected" ? "Connected" :
    status === "authenticating" ? "Authenticating" :
    status === "connecting" ? "Connecting..." :
    "Disconnected"

  const orbState: "idle" | "processing" | "disconnected" | "connecting" =
    status === "connected" ? (isProcessing ? "processing" : "idle") :
    status === "connecting" || status === "authenticating" ? "connecting" :
    "disconnected"

  // Map voice status to input bar voice status
  const inputVoiceStatus =
    voice.voiceStatus === "listening" || voice.voiceStatus === "streaming" ? "listening" as const :
    voice.voiceStatus === "playing" ? "speaking" as const :
    voice.voiceStatus === "ready" ? "ready" as const :
    "unavailable" as const

  const isVoiceActive = voice.voiceStatus === "listening" || voice.voiceStatus === "streaming" || voice.voiceStatus === "playing"

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {/* ====== Ambient background glow ====== */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] animate-ambient-glow"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, oklch(0.62 0.18 250 / 0.1) 0%, transparent 65%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[25vh] animate-ambient-glow"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 50% 100%, oklch(0.62 0.18 250 / 0.04) 0%, transparent 70%)",
          animationDelay: "4s",
        }}
      />

      {/* ====== Sidebar ====== */}
      <JarvisSidebar collapsed={!sidebarOpen} orbState={orbState} />

      {/* ====== Main area ====== */}
      <div
        className={cn(
          "flex flex-col h-full transition-all duration-300 ease-out",
          sidebarOpen ? "ml-72" : "ml-0",
          artifact.panelOpen ? "mr-[45vw]" : "mr-0",
        )}
      >
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isProcessing={isProcessing}
          isVoiceActive={isVoiceActive}
        />

        <MessageStream
          messages={messages}
          isThinking={isProcessing}
          onArtifactClick={(a) => artifact.showArtifact(a)}
        />

        <InputBar
          onSend={handleSend}
          onVoiceToggle={voice.toggleSession}
          primaryDevice={statusLabel}
          voiceStatus={inputVoiceStatus}
          trustLevel="autonomous"
          transcript={voice.transcript}
          hasPorcupine={voice.hasPorcupine}
        />
      </div>

      {/* ====== Artifact Panel ====== */}
      <ArtifactPanel
        artifact={artifact.activeArtifact}
        history={artifact.history}
        open={artifact.panelOpen}
        onClose={artifact.closePanel}
        onSelectHistory={artifact.selectFromHistory}
      />

      {/* ====== Mobile sidebar overlay ====== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
