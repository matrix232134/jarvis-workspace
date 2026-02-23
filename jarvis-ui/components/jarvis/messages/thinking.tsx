import { memo } from "react"
import Presence from "../presence"

export default memo(function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
      <Presence state="processing" size={5} />
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="rounded-full inline-block"
            style={{
              width: 4,
              height: 4,
              backgroundColor: "rgba(29,78,216,0.2)",
              animation: `j-dot-bounce 1.6s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
})
