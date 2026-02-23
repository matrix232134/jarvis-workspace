"use client"

import { cn } from "@/lib/utils"

type OrbState = "idle" | "processing" | "disconnected" | "connecting"

interface OrbProps {
  size?: "sm" | "md" | "lg"
  state?: OrbState
  className?: string
}

const stateStyles: Record<OrbState, { gradient: string; breathe: string; glow: string; opacity: string }> = {
  idle: {
    gradient: "bg-[radial-gradient(circle_at_30%_30%,_oklch(0.82_0.14_250)_0%,_oklch(0.62_0.18_250)_40%,_oklch(0.35_0.18_260)_100%)]",
    breathe: "animate-orb-breathe",
    glow: "bg-primary/15",
    opacity: "opacity-30",
  },
  processing: {
    gradient: "bg-[radial-gradient(circle_at_30%_30%,_oklch(0.90_0.16_250)_0%,_oklch(0.72_0.20_250)_40%,_oklch(0.45_0.20_260)_100%)]",
    breathe: "animate-orb-breathe-fast",
    glow: "bg-primary/30",
    opacity: "opacity-50",
  },
  disconnected: {
    gradient: "bg-[radial-gradient(circle_at_30%_30%,_oklch(0.50_0.01_260)_0%,_oklch(0.35_0.01_260)_40%,_oklch(0.20_0.01_260)_100%)]",
    breathe: "",
    glow: "bg-muted-foreground/10",
    opacity: "opacity-15",
  },
  connecting: {
    gradient: "bg-[radial-gradient(circle_at_30%_30%,_oklch(0.82_0.12_80)_0%,_oklch(0.62_0.14_70)_40%,_oklch(0.40_0.12_60)_100%)]",
    breathe: "animate-orb-breathe-medium",
    glow: "bg-amber-400/20",
    opacity: "opacity-35",
  },
}

export function JarvisOrb({ size = "md", state = "idle", className }: OrbProps) {
  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  }

  const glowClasses = {
    sm: "h-6 w-6",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  }

  const s = stateStyles[state]

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Core orb */}
      <div
        className={cn(
          "rounded-full",
          s.breathe,
          state !== "disconnected" && "animate-orb-glow",
          s.gradient,
          sizeClasses[size]
        )}
      />
      {/* Inner highlight — gives depth */}
      {state !== "disconnected" && (
        <div
          className={cn(
            "absolute rounded-full",
            "bg-[radial-gradient(circle_at_40%_35%,_oklch(0.95_0_0_/_0.3),_transparent_60%)]",
            s.breathe,
            sizeClasses[size]
          )}
        />
      )}
      {/* Outer ambient glow ring */}
      <div
        className={cn(
          "absolute rounded-full blur-lg",
          s.breathe,
          s.glow,
          s.opacity,
          glowClasses[size]
        )}
      />
    </div>
  )
}
