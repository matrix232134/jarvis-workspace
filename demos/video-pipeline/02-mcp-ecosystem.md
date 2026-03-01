# Agent 2: MCP Servers & APIs for Video Editing
> Sources: Tavily search (live) — GitHub repos, punkpeye/awesome-mcp-servers

---

## MCP Servers Found

### Video Editing

| Server | URL | Features | Install | Windows |
|--------|-----|----------|---------|---------|
| **mcp-video-editor** (chandler767) | [github.com/chandler767/mcp-video-editor](https://github.com/chandler767/mcp-video-editor) | **60 MCP tools** — FFmpeg-powered: core ops, effects, compositing, transitions, text overlays, audio ops, timeline system, multi-take editing, AI vision analysis | Go binary | ✅ |
| **video-audio-mcp** (misbahsy) | [github.com/misbahsy/video-audio-mcp](https://github.com/misbahsy/video-audio-mcp) | FFmpeg-powered basic video/audio editing + Whisper transcription | npm/Python | ✅ |

### Transcription

| Server | URL | Features | Install | Windows |
|--------|-----|----------|---------|---------|
| **MCP-YouTube-Transcribe** (JackHP) | [github.com/JackHP/MCP-YouTube-Transcribe](https://github.com/JackHP/MCP-YouTube-Transcribe) | YouTube transcript fetching + local whisper.cpp fallback, chunked output for long videos | Python + whisper.cpp | ✅ (explicit Windows support) |

### Key Finding: mcp-video-editor is Remarkable

The chandler767 `mcp-video-editor` is a **60-tool MCP server** written in Go that wraps FFmpeg comprehensively:
- Core video operations (trim, concat, resize, convert, etc.)
- Visual effects (blur, color grade, speed)
- Compositing (overlay, picture-in-picture)
- Timeline system (multi-track editing)
- Multi-take editing (select best takes)
- AI vision analysis (requires OpenAI API key)
- Transcript features (Whisper integration)

This could give JARVIS direct video editing capabilities via MCP — trim clips, remove silence, add captions, all conversationally.

## Self-Hosted APIs/Tools (No MCP Wrapper Needed)

| Tool | Purpose | Install | Notes |
|------|---------|---------|-------|
| **Whisper** (OpenAI) | Transcription with word-level timestamps | `pip install openai-whisper` | Local GPU accelerated |
| **whisper.cpp** | Fast C++ Whisper implementation | Binary download | Very fast on CPU |
| **Auto-Editor** | Automated silence/motion-based cuts | `pip install auto-editor` | Uses FFmpeg under the hood |
| **FFmpeg** | Everything video | `choco install ffmpeg` or download | Foundation for all tools |

## Gaps

- No MCP server for DaVinci Resolve scripting API
- No MCP server for Descript API
- No MCP server for Adobe Premiere ExtendScript
- No dedicated subtitle/captioning MCP server (mcp-video-editor covers basics)
