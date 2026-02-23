/**
 * Delivery Router — streaming tag parser for the four-pillar output format.
 *
 * Accepts LLM tokens one at a time and routes content to the correct channel:
 *   [VOICE]     → onVoice    (spoken via TTS)
 *   [DISPLAY]   → onDisplay  (sent to screen or queued)
 *   [ACTION]    → onAction   (executed, not spoken)
 *   [ARTIFACT]  → onArtifact (rich visualization, rendered in side panel)
 *
 * [ARTIFACT] is different: it has attributes in the opening tag and an explicit
 * [/ARTIFACT] closing tag. Content between them is buffered and emitted at close.
 *
 * If the LLM response contains no tags at all, everything routes to onVoice
 * (backward-compatible passthrough mode).
 *
 * Tags may be split across multiple tokens (e.g. "[", "VOICE", "]").
 * The parser buffers up to MAX_TAG_BUFFER chars to resolve them.
 */

export interface ArtifactMeta {
  type: string;   // 'mermaid' | 'svg' | 'html' | 'react' | 'code'
  title: string;
  language?: string;  // for code type
}

export interface DeliveryCallbacks {
  onVoice: (text: string) => void;
  onDisplay: (text: string) => void;
  onAction: (text: string) => void;
  onArtifact: (content: string, meta: ArtifactMeta) => void;
}

type ParserState = 'passthrough' | 'voice' | 'display' | 'action' | 'artifact';

const TAG_MAP: Record<string, ParserState> = {
  'VOICE': 'voice',
  'DISPLAY': 'display',
  'ACTION': 'action',
};

// [ARTIFACT type="mermaid" title="Long Title Here"] can be up to ~200 chars
const MAX_TAG_BUFFER = 200;

function parseArtifactAttributes(inner: string): ArtifactMeta {
  const typeMatch = inner.match(/type="([^"]+)"/);
  const titleMatch = inner.match(/title="([^"]+)"/);
  const langMatch = inner.match(/language="([^"]+)"/);
  return {
    type: typeMatch?.[1] ?? 'code',
    title: titleMatch?.[1] ?? 'Artifact',
    language: langMatch?.[1],
  };
}

export class DeliveryRouter {
  private state: ParserState = 'passthrough';
  private tagBuffer = '';
  private callbacks: DeliveryCallbacks;
  private hasSeenAnyTag = false;
  private artifactBuffer = '';
  private artifactMeta: ArtifactMeta | null = null;

  constructor(callbacks: DeliveryCallbacks) {
    this.callbacks = callbacks;
  }

  /** Feed a single LLM token into the router. */
  addToken(token: string): void {
    for (const char of token) {
      this.processChar(char);
    }
  }

  /** Flush any remaining buffered content at end of stream. */
  flush(): void {
    if (this.tagBuffer) {
      this.emitContent(this.tagBuffer);
      this.tagBuffer = '';
    }
    // If stream ends mid-artifact, emit what we have
    if (this.state === 'artifact' && this.artifactBuffer && this.artifactMeta) {
      this.callbacks.onArtifact(this.artifactBuffer.trim(), this.artifactMeta);
      this.artifactBuffer = '';
      this.artifactMeta = null;
      this.state = 'voice';
    }
  }

  private processChar(char: string): void {
    // If we're accumulating a potential tag
    if (this.tagBuffer.length > 0) {
      this.tagBuffer += char;

      if (char === ']') {
        const inner = this.tagBuffer.slice(1, -1);

        // Check simple section tags: [VOICE], [DISPLAY], [ACTION]
        const newState = TAG_MAP[inner];
        if (newState) {
          this.state = newState;
          this.hasSeenAnyTag = true;
          this.tagBuffer = '';
          return;
        }

        // Check ARTIFACT opening: [ARTIFACT type="mermaid" title="..."] or [ARTIFACT]
        if (inner === 'ARTIFACT' || inner.startsWith('ARTIFACT ')) {
          this.artifactMeta = parseArtifactAttributes(inner);
          this.state = 'artifact';
          this.hasSeenAnyTag = true;
          this.tagBuffer = '';
          this.artifactBuffer = '';
          return;
        }

        // Check ARTIFACT close: [/ARTIFACT]
        if (inner === '/ARTIFACT' && this.state === 'artifact') {
          if (this.artifactMeta) {
            this.callbacks.onArtifact(this.artifactBuffer.trim(), this.artifactMeta);
          }
          this.artifactBuffer = '';
          this.artifactMeta = null;
          this.state = 'voice'; // return to voice after artifact
          this.tagBuffer = '';
          return;
        }

        // Not a valid tag — emit buffer as content in current section
        const buffered = this.tagBuffer;
        this.tagBuffer = '';
        this.emitContent(buffered);
        return;
      }

      if (this.tagBuffer.length > MAX_TAG_BUFFER) {
        // Too long to be a tag — emit and reset
        const buffered = this.tagBuffer;
        this.tagBuffer = '';
        this.emitContent(buffered);
      }
      return;
    }

    if (char === '[') {
      // Potential tag start
      this.tagBuffer = '[';
      return;
    }

    // Regular character — emit to current section
    this.emitContent(char);
  }

  private emitContent(text: string): void {
    // Artifact state: accumulate to buffer instead of emitting
    if (this.state === 'artifact') {
      this.artifactBuffer += text;
      return;
    }

    // If no tags have been seen, treat all content as voice (backward compat)
    const section = this.hasSeenAnyTag ? this.state : 'passthrough';

    switch (section) {
      case 'voice':
      case 'passthrough':
        this.callbacks.onVoice(text);
        break;
      case 'display':
        this.callbacks.onDisplay(text);
        break;
      case 'action':
        this.callbacks.onAction(text);
        break;
    }
  }
}
