import type { DisplayCard, ArtifactRef } from "@/lib/types"
import { extractArtifacts, type ParsedArtifact } from "./parse-artifact"

interface ParsedResponse {
  voice?: { text: string }
  displays?: DisplayCard[]
  artifacts?: ArtifactRef[]
}

export function parseJarvisResponse(content: string): ParsedResponse {
  const result: ParsedResponse = {}

  // Extract artifacts first (they have explicit close tags, won't interfere with section parsing)
  const { cleaned, artifacts } = extractArtifacts(content)
  if (artifacts.length > 0) {
    result.artifacts = artifacts
  }

  // Use cleaned content (artifacts removed) for section parsing
  const text = cleaned

  // Check for [VOICE] and [DISPLAY] markers
  const hasVoice = text.includes("[VOICE]")
  const hasDisplay = text.includes("[DISPLAY]")

  if (!hasVoice && !hasDisplay) {
    // No markers — treat entire content as voice
    const trimmed = text.trim()
    if (trimmed) {
      result.voice = { text: trimmed }
    }
    return result
  }

  // Extract [VOICE] section
  if (hasVoice) {
    const voiceMatch = text.match(/\[VOICE\]\s*([\s\S]*?)(?=\[DISPLAY\]|\[ACTION\]|$)/)
    if (voiceMatch) {
      result.voice = { text: voiceMatch[1].trim() }
    }
  }

  // Extract [DISPLAY] section — render as plain text display card
  if (hasDisplay) {
    const displayMatch = text.match(/\[DISPLAY\]\s*([\s\S]*?)(?=\[ACTION\]|$)/)
    if (displayMatch) {
      const displayText = displayMatch[1].trim()
      result.displays = [
        {
          title: "Details",
          content: displayText,
        },
      ]
    }
  }

  // If we had markers but no voice extracted, use the whole thing
  if (!result.voice && !result.displays) {
    result.voice = { text: text.trim() }
  }

  return result
}
