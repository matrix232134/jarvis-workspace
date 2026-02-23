export interface ParsedArtifact {
  type: string
  title: string
  language?: string
  content: string
}

/**
 * Extract [ARTIFACT type="..." title="..."]...[/ARTIFACT] blocks from text.
 * Returns the cleaned text (with artifacts removed) and the extracted artifacts.
 */
export function extractArtifacts(text: string): { cleaned: string; artifacts: ParsedArtifact[] } {
  const artifacts: ParsedArtifact[] = []
  const regex = /\[ARTIFACT\s+([^\]]*)\]([\s\S]*?)\[\/ARTIFACT\]/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const attrs = match[1]
    const content = match[2].trim()
    const typeMatch = attrs.match(/type="([^"]+)"/)
    const titleMatch = attrs.match(/title="([^"]+)"/)
    const langMatch = attrs.match(/language="([^"]+)"/)

    artifacts.push({
      type: typeMatch?.[1] ?? "code",
      title: titleMatch?.[1] ?? "Artifact",
      language: langMatch?.[1],
      content,
    })
  }

  const cleaned = text.replace(/\[ARTIFACT\s+[^\]]*\][\s\S]*?\[\/ARTIFACT\]/g, "").trim()
  return { cleaned, artifacts }
}
