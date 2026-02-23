import { memo } from "react"
import Presence from "../presence"
import DisplayCardInline from "../surfaces/display-card"
import ArtifactRefInline from "../surfaces/artifact-ref"
import PipelineCard from "../surfaces/pipeline-card"
import MemoryGlimpse from "../surfaces/memory-glimpse"
import ActionLine from "../surfaces/action-line"
import type { JarvisVoiceMessage, ArtifactRef } from "@/lib/types"

export default memo(function JarvisVoice({
  message,
  onOpenDisplay,
  onOpenArtifact,
}: {
  message: JarvisVoiceMessage
  onOpenDisplay: (display: { title: string; content: string }) => void
  onOpenArtifact: (artifact: ArtifactRef) => void
}) {
  return (
    <div style={{ marginBottom: 18, animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Voice text with presence dot */}
      {message.voice && (
        <div className="flex items-start gap-3">
          <Presence state="idle" size={5} className="mt-[9px] shrink-0" />
          <div>
            <p
              className="font-sans"
              style={{
                fontSize: 15,
                lineHeight: 1.85,
                color: "var(--ink)",
                fontWeight: 400,
                letterSpacing: "-0.006em",
              }}
            >
              {message.voice.text}
            </p>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--ink-ghost)",
                marginTop: 5,
              }}
            >
              {message.timestamp}
            </div>
          </div>
        </div>
      )}

      {/* Inline surfaces */}
      <div className="flex flex-col gap-2.5" style={{ paddingLeft: 20, marginTop: message.voice ? 10 : 0 }}>
        {/* Display cards */}
        {message.displays?.map((d, i) => (
          <DisplayCardInline key={i} display={d} onClick={() => onOpenDisplay(d)} />
        ))}

        {/* Pipeline */}
        {message.pipeline && <PipelineCard pipeline={message.pipeline} />}

        {/* Memory */}
        {message.memory && <MemoryGlimpse stats={message.memory} />}

        {/* Artifact refs */}
        {message.artifacts?.map((a, i) => (
          <ArtifactRefInline key={i} artifact={a} onClick={() => onOpenArtifact(a)} />
        ))}

        {/* Action indicators */}
        {message.actions?.map((a, i) => (
          <ActionLine key={i} action={a} />
        ))}
      </div>
    </div>
  )
})
