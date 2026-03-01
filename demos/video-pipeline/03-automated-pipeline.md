# Agent 3: Automated Long-Format Video Editing Pipeline
> Sources: Tavily search (live) — shotstack.io, colossyan.com, auto-editor docs, FFmpeg docs

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    JARVIS Video Pipeline                         │
│                                                                  │
│  RAW FOOTAGE (1-2 hrs)                                          │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ 1. INGEST   │───►│ 2. TRANSCRIBE│───►│ 3. SILENCE REMOVAL │  │
│  │   FFmpeg     │    │   Whisper    │    │   Auto-Editor      │  │
│  │   normalize  │    │   word-level │    │   loudness-based   │  │
│  │   probe info │    │   timestamps │    │   + motion detect  │  │
│  └─────────────┘    └──────────────┘    └────────┬───────────┘  │
│                                                   │              │
│       ┌───────────────────────────────────────────┘              │
│       ▼                                                          │
│  ┌─────────────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │ 4. SCENE DETECT  │───►│ 5. ROUGH CUT │───►│ 6. CAPTIONS  │   │
│  │   FFmpeg/PyScene  │    │  ★ HUMAN     │    │   Whisper    │   │
│  │   detect          │    │  REVIEW ★    │    │   → SRT/ASS  │   │
│  └─────────────────┘    └──────────────┘    └──────┬────────┘   │
│                                                     │            │
│       ┌─────────────────────────────────────────────┘            │
│       ▼                                                          │
│  ┌─────────────┐    ┌──────────────┐                            │
│  │ 7. ENHANCE   │───►│ 8. EXPORT    │                            │
│  │  Audio norm  │    │  FFmpeg      │                            │
│  │  Color grade │    │  H.264/H.265 │                            │
│  │  (optional)  │    │  Multi-res   │                            │
│  └─────────────┘    └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step

| Step | Tool | Automated? | Time (1hr raw) | Command |
|------|------|-----------|-----------------|---------|
| 1. Ingest & normalize | FFmpeg | ✅ Full | ~2 min | `ffmpeg -i raw.mp4 -af loudnorm -c:v copy normalized.mp4` |
| 2. Transcribe | Whisper | ✅ Full | ~5-15 min (GPU) | `whisper normalized.mp4 --model medium --output_format srt` |
| 3. Silence removal | Auto-Editor | ✅ Full | ~3-5 min | `auto-editor normalized.mp4 --margin 0.3s --export premiere` |
| 4. Scene detection | PySceneDetect | ✅ Full | ~2 min | `scenedetect -i normalized.mp4 detect-content list-scenes` |
| 5. Rough cut review | DaVinci/Descript | ❌ Human | Variable | Import auto-editor output, review scenes |
| 6. Auto-captions | Whisper → SRT | ✅ Full | Already done (step 2) | Embed: `ffmpeg -i cut.mp4 -vf subtitles=subs.srt output.mp4` |
| 7. Audio enhancement | FFmpeg | ✅ Full | ~1 min | `ffmpeg -i cut.mp4 -af "highpass=f=80,lowpass=f=8000,loudnorm"` |
| 8. Export | FFmpeg | ✅ Full | ~5-10 min | Multi-resolution encode script |

## Automation Score

- **Steps 1-4, 6-8:** Fully automatable — JARVIS can run these via exec or MCP
- **Step 5 (Rough cut review):** Requires human judgment — JARVIS prepares the timeline, sir reviews
- **Overall:** ~85% automated, ~15% human creative decisions

## JARVIS Integration

JARVIS triggers the pipeline via a single command or standing order:
```
"Process raw footage at C:\Videos\raw\interview-20260222.mp4"
→ Steps 1-4 run automatically
→ JARVIS alerts sir: "Rough cut ready for review at C:\Videos\cuts\"
→ After sir's review, steps 6-8 complete the pipeline
```

## Required Installs (All Free, All Windows)

| Tool | Install | Purpose |
|------|---------|---------|
| FFmpeg | `choco install ffmpeg` | Video processing foundation |
| Python 3.10+ | Already available or `choco install python` | Runtime |
| Whisper | `pip install openai-whisper` | Transcription |
| Auto-Editor | `pip install auto-editor` | Silence/dead-air removal |
| PySceneDetect | `pip install scenedetect[opencv]` | Scene boundary detection |
| mcp-video-editor | Go binary from GitHub | MCP integration (optional) |
