# Agent 1: AI Long-Format Video Editing Tools
> Sources: Tavily search (live) — iide.co, zapier.com, colossyan.com, opus.pro, meetjamie.ai

---

## Comparison Table

| Tool | Long-Format | AI Features | Pricing | Local/Cloud | Windows |
|------|-------------|-------------|---------|-------------|---------|
| **Descript** | ✅ Pro: 40hr/mo transcription | Edit-by-transcript, filler word removal, overdub voice cloning, auto-captions, multilingual dubbing | Free (1hr/mo) / $24/mo / $33/mo | Cloud processing | ✅ Desktop app |
| **DaVinci Resolve** | ✅ No limits | AI scene detection, auto-colour, noise reduction, voice isolation, speed warp, magic mask | Free / $295 one-time (Studio) | **Local GPU** | ✅ Native |
| **Adobe Premiere Pro** | ✅ No limits | Auto-captions, scene edit detection, auto-reframe, generative extend, audio cleanup | $23/mo (Creative Cloud) | Hybrid (local + cloud) | ✅ Native |
| **CapCut** | ⚠️ 60min max | Auto-captions, silence removal, templates, AI effects | Free / $8/mo Pro | Cloud | ✅ Desktop |
| **Runway ML** | ❌ Short clips only | Generative video, inpainting, style transfer | $15/mo Standard | Cloud only | ✅ Web-based |
| **Auto-Editor** | ✅ No limits | Silence removal, scene detection, motion-based cuts | **Free (open source)** | **Local (FFmpeg + Python)** | ✅ `pip install auto-editor` |

## Key Findings

1. **Descript** is the king of transcript-based editing — edit video by editing text. But transcription hours are metered (40hr/mo on Pro).
2. **DaVinci Resolve Free** is the most powerful local editor with no time limits — but AI features require Studio ($295 one-time).
3. **Auto-Editor** is the hidden gem for automation — free, open source, runs locally with FFmpeg, perfect for automated silence removal in a pipeline.
4. **CapCut** has a 60-minute limit — eliminates it for true long-format.
5. **Runway ML** is for generative clips, not long-format editing.

## Recommendation

**For hands-on editing:** DaVinci Resolve (free, unlimited, local, powerful AI in Studio).
**For transcript-based editing:** Descript (edit video by editing words).
**For automated pipeline:** Auto-Editor + Whisper + FFmpeg (free, scriptable, no limits).
