export interface ParsedArtifact {
  type: string
  title: string
  language?: string
  content: string
}

/**
 * Flexibly extract an attribute value — handles:
 *   type="code"   type='code'   type=code
 */
function getAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|(\\S+))`, "i"))
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

/**
 * Extract [ARTIFACT type="..." title="..."]...[/ARTIFACT] blocks from text.
 * Case-insensitive, handles single/double/no quotes on attributes.
 * Returns the cleaned text (with artifacts removed) and the extracted artifacts.
 */
export function extractArtifacts(text: string): { cleaned: string; artifacts: ParsedArtifact[] } {
  const artifacts: ParsedArtifact[] = []
  const regex = /\[ARTIFACT\s*([^\]]*)\]([\s\S]*?)\[\/ARTIFACT\]/gi
  let match

  while ((match = regex.exec(text)) !== null) {
    const attrs = match[1]
    const content = match[2].trim()

    artifacts.push({
      type: getAttr(attrs, "type") ?? "code",
      title: getAttr(attrs, "title") ?? "Artifact",
      language: getAttr(attrs, "language"),
      content,
    })
  }

  const cleaned = text.replace(/\[ARTIFACT\s*[^\]]*\][\s\S]*?\[\/ARTIFACT\]/gi, "").trim()
  return { cleaned, artifacts }
}
