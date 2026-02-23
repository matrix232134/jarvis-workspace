"use client"

import { PanelLeft } from "lucide-react"
import { JarvisOrb } from "./orb"
import { cn } from "@/lib/utils"

interface TopBarProps {
  onToggleSidebar: () => void
  isProcessing: boolean
  isVoiceActive: boolean
}

export function TopBar({ onToggleSidebar, isProcessing }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between h-13 px-5",
        "border-b border-glass-border",
        "bg-glass/40 backdrop-blur-xl"
      )}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground/65 hover:text-foreground/80 hover:bg-glass-hover transition-all duration-200"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/55">
          Workspace
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {/* Model badge */}
        <span className="text-[10px] font-mono font-medium tracking-wide text-muted-foreground/55">
          Opus 4.6
        </span>

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/[0.08]">
            <JarvisOrb size="sm" state="processing" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/90">
              Processing
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
