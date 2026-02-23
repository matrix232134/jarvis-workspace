import { memo } from "react"
import type { UserMessage } from "@/lib/types"

export default memo(function UserBubble({ message }: { message: UserMessage }) {
  return (
    <div className="flex flex-col items-end" style={{ marginBottom: 18, animation: "j-fade-slide 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <div
        className="font-sans"
        style={{
          maxWidth: "68%",
          backgroundColor: "var(--accent)",
          color: "#FFFFFF",
          borderRadius: "20px 20px 6px 20px",
          padding: "12px 18px",
          fontSize: 15,
          fontWeight: 420,
          lineHeight: 1.65,
          letterSpacing: "-0.006em",
        }}
      >
        {message.text}
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          color: "var(--ink-ghost)",
          marginTop: 5,
        }}
      >
        {message.timestamp}
      </span>
    </div>
  )
})
