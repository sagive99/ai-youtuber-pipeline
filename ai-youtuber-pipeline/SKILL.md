---
name: "ai-youtuber-pipeline"
description: "End-to-end pipeline for a YouTube channel run by an AI persona (Shorts and long-form): research what works, produce with HyperFrames, make the thumbnail, publish with youtube-publisher, and learn from results and from reference videos. Use when asked to run the pipeline, plan, make or publish a video or thumbnail, finish a project, or learn from a reference video."
---

# AI YouTuber Pipeline (Shorts + long-form)

Analyze → learn → pick ideas → produce (HyperFrames) → thumbnail → publish (youtube-publisher) → learn from the results and from the reference videos the creator shares.

## Modes

Decide the mode from the creator's prompt before doing anything else:

- **Discovery mode**: no specific idea given ("run the pipeline", "what should the persona post next?"). Run Steps 0 → 1 → 2 → 3 → 4 → 5–10.
- **Idea mode**: the creator describes a video he wants ("make a Short where the persona reacts to…", "a long video explaining how X was made"). Run Steps 0 → 1 → 2-lite → **3B → 4B** → 5–10. His idea is the starting point: research how to do *that* video well, don't swap it for a different idea.
- **Finish mode**: the creator already has a HyperFrames project in progress ("publish the video I'm working on", or he points at a project folder). Run Steps 0 → 1 → the verification checks in Step 6 → 6B → 7 → 8 → 9 → 10. Don't rebuild or restyle it unless he asks. Ask him for a one-line hypothesis (or propose one) so the video still feeds the learning loop.
- **Reference mode**: the creator shares a video or link he likes ("I liked this edit", an attached .mp4, an Instagram/YouTube link). Run Step R, then continue with whatever else he asked.

If the prompt is ambiguous (a vague topic rather than a video), ask one question: "Want me to build this idea, or find ideas around this topic?"

Format: **Shorts** are 1080×1920, ~30–40 s. **Long-form** is 1920×1080, usually over 5 minutes (comparable winners run 7–9 min). Ask which one only if the prompt doesn't make it clear.

## Channel direction (read before every step)

The channel is **pivoting to a new niche**. `channel-profile.md` holds the target niche and the pivot date: that is the source of truth, not what the channel posted before.

- Videos before the pivot date are **legacy**. Never use legacy performance to pick topics, formats, or to judge a new-niche idea.
- Research is about **doing the target niche well**: proven formats and channels that already succeed there. Trends are an optional input, never a requirement. Don't search TikTok/Instagram or chase "what's trending" unless the creator asks or his idea is explicitly about a current event.
- If the target niche isn't in the profile yet, ask the creator for it before Step 2.

Channel: (your channel URL, set in channel-profile.md)

The pipeline has **two hard approval gates** (Gate 1: idea pick, Gate 2: publish). Never skip them, never upload without an explicit "go" from the creator in this session, and never treat a previous run's approval as approval for this one.

---

## Workspace layout

Everything lives in one workspace folder on the creator's PC (renders and uploads run there).

```
your-workspace/
  pipeline/
    channel-profile.md   # niche, the persona's look & voice, audience, production style, cadence (confirmed by the creator)
    STYLE.md             # editing + thumbnail style guide, built from the reference videos the creator shares
    learnings.md         # evidence-backed lessons from the persona's own videos: what works / what doesn't
    published.csv        # one row per pipeline upload (the feedback loop reads this)
  YYYY-MM-DD-<slug>/     # one folder per video
    SCRIPT.md / brief    # hook, beats, on-screen text, hypothesis
    narration.json       # the persona's lines (read by make_voice.py)
    index.html, compositions/, assets/, build/   # HyperFrames project
    thumbnail/           # thumbnail drafts + the chosen one
    renders/             # final render
    metadata.json        # title, description, tags, category, privacy
    result.json          # upload output (video ID, URL, status)
  .claude/skills/youtube-publisher/   # the uploader (keys in scripts/.env, login in scripts/.youtube-token.json)
```

`published.csv` header:
`date,video_id,url,slug,origin,topic,hook,workflow,length_s,title,hypothesis,source_evidence`

`origin` is `discovery`, `idea` or `finish`. Step 2 compares how the creator's own ideas perform vs. discovered ones and records that in `learnings.md`. Every row in this file is a new-niche video.

---

## Step 0: Preflight (every run)

Check all of these and stop with a clear list if anything is missing:

1. **Node 22+ and FFmpeg** on the creator's PC (renders and uploads run there; the cloud shells can't reach googleapis.com or huggingface.co). If FFmpeg is missing, install it (Windows: `winget install Gyan.FFmpeg`).
2. **HyperFrames**: `npx hyperframes doctor`. Skills installed (`/hyperframes` router available). If not: `npx hyperframes skills update`.
3. **youtube-publisher**: confirm `scripts/.env` has `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` and `scripts/.youtube-token.json` exists. If the token is missing or expired, ask the creator to run the `--auth` command himself (it opens a Google login). Never handle his Google password.
4. **vidIQ tools** are available in this session (names contain `vidiq_`). If not, tell the creator to connect the vidIQ connector and stop: the pipeline does not guess analytics. Check `vidiq_balance` before research (most calls cost 5 credits) and tell him if a step would run him out.
5. Upload quota: the YouTube Data API allows roughly 6 uploads/day. Count today's rows in `published.csv`; warn if near the limit.

---

## Step 1: Load memory / first-run setup

Read `channel-profile.md`, `STYLE.md`, `learnings.md`, `published.csv`. STYLE.md is binding for every video you build (Step 6) and every thumbnail (Step 6B).

**First run only** (no `channel-profile.md`):
- Find the channel: `vidiq_user_channels` (or `vidiq_channel_search` for the channel handle). If the creator hasn't linked YouTube inside vidIQ, use `vidiq_connect_youtube_channel` / `vidiq_authorize_with_youtube` so private analytics (retention, audience) are available.
- Pull a baseline only: `vidiq_channel_stats`, `vidiq_subscriber_insights`. Don't derive the niche from old videos.
- **Ask the creator** for the new direction, and confirm each item before saving:
  - **Target niche** and content pillars, and the **pivot date** (default: the date of the first new-niche upload)
  - 3–5 **reference channels** that already do the target niche well (offer candidates via `vidiq_channel_search` / `vidiq_similar_channels`; save with `vidiq_update_competitors`)
  - the persona's persona: personality, voice, catchphrases, visual look, things the persona never does
  - Whether the persona's footage looks realistic (decides the disclosure rule in Step 8)
  - Production style: supplied footage or fully generated in HyperFrames? Voiceover source?
  - Target length, posting cadence, language
- Save `channel-profile.md`, create empty `learnings.md`, `published.csv` and `STYLE.md`.

---

## Step R: Learn from a reference video (Reference mode, any time)

When the creator shares a video he likes, it becomes part of the persona's style. Do this every time, even mid-task:

1. Get the file (attachment, or ask him to attach it if it's only a link you can't download).
2. Analyse it, don't guess: `ffprobe` for length/format; a frame contact sheet (`ffmpeg -vf fps=1.3,scale=240:-1,tile=6x4`); scene-change times (`select='gt(scene,0.2)'`); a loudness profile of the audio; look at 2–3 full-size frames.
3. Write down what makes it work: camera/framing, pacing (seconds per visual state), colour, type, captions, sound design, hook, ending. Note the creator/handle and source.
4. Append a `## Reference N: <name>` section to `pipeline/STYLE.md` with those observations, and add numbered rules (continue the existing numbering) only for things that are new and that the persona can actually do in HyperFrames.
5. Tell the creator in 3–5 lines what you took from it and where it will show up next.

References shape *how* videos look. `learnings.md` stays for evidence from the persona's own published videos (views, retention); don't mix the two.

---

## Step 2: What's working / what's not

1. Pull performance for **new-niche videos only** (uploaded on/after the pivot date): `vidiq_channel_videos`, then `vidiq_video_stats` for each. Legacy videos are excluded from every comparison.
2. Normalize: compare each new-niche video to the **new-niche median** views for its age, separately for Shorts and long-form (not raw views, not the legacy median). Flag over-performers (≥2× median) and under-performers (≤0.5×). Use retention / avg view % and subs gained when analytics are available. Until there are ~5 new-niche videos of a format, report each one's numbers plainly and say it's too early for patterns; don't fill the gap with legacy data.
3. For over- and under-performers, extract the pattern: topic, hook style, length, on-screen text density, title pattern, thumbnail, posting day/time. Use `vidiq_video_transcript` / `vidiq_watch_shortform_content` when the pattern isn't obvious from metadata.
4. **Close the loop**: for each row in `published.csv` that is ≥48h old and not yet scored, compare the result with its `hypothesis`. Append a lesson to `learnings.md`:
   `- [YYYY-MM-DD] <lesson>, evidence: <video_id> <views> vs median <n>, <retention>`
   Mark older lessons contradicted by new evidence as `(superseded YYYY-MM-DD: <why>)` rather than deleting them.
5. Audience: refresh `vidiq_subscriber_insights` and `vidiq_comment_insights` on new-niche videos: note what viewers ask for, complain about, or repeat. Requests from comments are idea candidates. Also note audience shift.

Only state patterns backed by numbers. If the sample is too small (fewer than ~5 comparable videos), say so.

**2-lite (Idea mode):** do item 4 and read `learnings.md`. Skip the full channel review unless the creator's idea touches a topic or format the channel has already tried; then pull those specific videos' stats.

---

## Step 3: Find ideas in the target niche

Work from what's **proven** in the target niche, not from what's trending:
- `vidiq_outliers` on the target-niche keywords and the reference channels (set `contentType` to short or long). Prefer evergreen topics and repeatable formats.
- `vidiq_channel_videos` on the reference channels: their consistent top formats and series.
- `vidiq_keyword_research` for search demand on candidate topics.
- `vidiq_similar_videos` on the channel's own top new-niche performers (once there are some).
- `vidiq_trending_videos` only if the creator asks for timely ideas.

Filter candidates: fits the niche and the persona's persona (reject anything off-niche, even if popular); feasible in HyperFrames; not already covered (`published.csv`); builds a repeatable series; consistent with `learnings.md` or deliberately tests one of its open questions.

---

## Step 4: Pitch → GATE 1

Present 3–5 ideas. For each:
- **Hook** (exact first line / first 2 seconds)
- **Angle**: the persona's take, why it's his
- **Evidence**: the proven target-niche video/format it's based on (video + multiplier) and any matching pattern from Step 2 / `learnings.md`
- **Workflow** (Step 6) and target length
- **2–3 title options**, scored with `vidiq_score_title`

Mark one as recommended with a one-line reason. **Wait for the creator to pick** (he may pick several, edit, or ask for new ones). Do not start production before he answers.

---

## Step 3B: Idea mode: research how to do the creator's idea right

1. **Restate the idea** in one line: topic, the persona's role in it, intended feeling. If a detail that changes the whole video is missing, ask once; otherwise assume and state the assumption.
2. **Define the video's own niche**: 3–6 keywords that describe *this* video.
3. **What's working for this kind of video:**
   - `vidiq_youtube_search` + `vidiq_keyword_research` on those keywords: search demand and competition.
   - `vidiq_outliers` on the keywords and the reference channels: the videos on this exact topic/format that beat their channel's average. Take the top 5–10, preferring evergreen over one-off spikes. For long-form, also compare duration vs outlier score to set the length.
   - Only if the idea is about a current event: `vidiq_trending_videos`. TikTok/Instagram search only if the creator asks.
4. **Break the winners down** (`vidiq_video_transcript`, `vidiq_watch_shortform_content`, `vidiq_get_videos_by_ids`): hook in the first seconds, length, pacing, structure, on-screen text, captions, music/sound, ending/CTA, title and thumbnail patterns, top comments. Also note what the **under-performers** did differently.
5. **Fit check** against `channel-profile.md`, `STYLE.md` and `learnings.md` (new-niche lessons only). If it conflicts with a lesson, say so plainly with the evidence, but it's the creator's call: don't block it; suggest the smallest change that makes it fit.

## Step 4B: Execution plan → GATE 1 (Idea mode)

Present one plan (with up to 2 alternative angles if the research clearly suggests them):
- **What's working for this kind of video**: 3–5 bullets, each citing a video and its multiplier
- **Avoid**: 2–3 bullets from the under-performers
- **The plan for the persona's version**: hook (exact first line), structure with rough timings, length, on-screen text/captions, audio, ending
- **Workflow** (Step 6) and what the creator needs to supply, if anything
- **2–3 title options** scored with `vidiq_score_title`
- Timing: "post within X days" only if the idea is about a current event

**Wait for the creator to approve or edit the plan**, then continue to Step 5 with `origin=idea`. The hypothesis should name which researched pattern the video is betting on.

When the creator adds a factual claim to the script (models, versions, prices), verify it with a web search before it goes into the persona's mouth, and tell him what you changed.

---

## Step 5: Brief / script

Write the brief (Shorts) or `SCRIPT.md` + `narration.json` (long-form) in the video's folder: hook, beats with timestamps, on-screen text per beat, captions, voice/audio, ending/CTA, persona check (the persona's voice per `channel-profile.md`), and the **hypothesis** ("We expect this to beat median because <specific reason>"; Step 2 of a later run tests it). the creator sees the script before rendering.

Voice: Supertonic M3 via `make_voice.py`, which the creator runs on his PC (the model downloads from huggingface.co, which the cloud can't reach). Avoid words the voice mispronounces (e.g. the creator's own name).

---

## Step 6: Produce with HyperFrames

Invoke `/hyperframes` with the brief (the router confirms the brief and picks the workflow). Expected workflow by input:
- the creator supplied the persona footage (talking head) → `/talking-head-recut` or `/embedded-captions`
- Topic explainer with no footage → `/faceless-explainer`
- Short design-led hit (<10s) → `/motion-graphics`
- Anything else → `/general-video`

Composition root: `data-width="1080" data-height="1920"` for Shorts, `1920`×`1080` for long-form. Follow every rule in `STYLE.md`. Generated scenes (e.g. a persona cold open) can come from Gemini image/video generation in the creator's Gemini account, using the persona's character sheet as reference; keep only the parts that look real (video models drift on faces after a few seconds), and ask before downloading. Screen content is recreated as animated HTML UI with the real file contents, never raw screen recordings.

Before calling it done:
1. `npx hyperframes lint` and `npx hyperframes check`: fix all errors.
2. `npx hyperframes render` on the creator's PC (the cloud renders far too slowly).
3. Verify with `ffprobe`: expected size, duration (±0.5s), audio stream present if the brief has audio.
4. Extract frames at 0s, 1s, middle, and the last second and **look at them**: hook readable in the first second, nothing cut off (Shorts: keep text out of the bottom ~20% and right edge), no blank frames.

---

## Step 6B: Thumbnail (long-form, and Shorts if the creator wants one)

1. Research: `vidiq_outliers` for the video's keywords; look at the top 10–12 thumbnails (open them in the browser if the shell can't reach i.ytimg.com) and note the shared patterns (faces + expression, word count, logos, UI). Record new patterns in the Thumbnails section of `STYLE.md` with video IDs and multipliers.
2. Build 2–3 options as HTML at 1280×720 and screenshot them with Playwright. Use an expressive the persona (generate one in Gemini from the character sheet if needed, cut out with rembg and fix the mask), 2–4 huge words, the persona orange.
3. **No third-party logos.** Anthropic's trademark guidelines (anthropic.com/legal/trademark-guidelines) require prior approval to use the Claude logo, so name tools in text ("Claude Code") instead. Same for other brands unless the creator has permission.
4. Save options to the video's `thumbnail/` folder and let the creator pick. After the private upload (Step 9), score the chosen one with `vidiq_score_thumbnail` on the video ID before going public.

---

## Step 7: Package

Write `metadata.json`:
- `title` ≤100 chars (Shorts: include `#Shorts` only if it fits naturally)
- `description` ≤5000 chars: one-line hook, chapters for long-form, the CTA, 2–3 hashtags
- `tags` ≤500 chars total, comma-separated
- `category`: ID from the profile (28 Science & Technology)
- `privacy`: decided at Gate 2

If captions exist, pass them with `--subtitle-lang en --subtitle-name "English"` (or the profile's language). **youtube-publisher defaults to `zh` / 中文: always override.**

Dry run first, as its own command:
```bash
cd <youtube-publisher>/scripts
node node_modules/ts-node/dist/bin.js youtube-upload.ts -v <video.mp4> -t "<title>" -d "<description>" \
  --tags "<tags>" -c <category> [--short] --dry-run
```
On Windows never call it through `npx` (the `.cmd` wrapper cuts arguments at the first newline, which once turned a dry run into a real upload), and read the description from a UTF-8 file (`Get-Content -Encoding UTF8`) so emoji survive. Pass `--short` only for Shorts.

---

## Step 8: GATE 2 (publish approval)

Show the creator: the render path (send/open the file), the frame checks, the thumbnail, the full metadata, and the dry-run output. Ask: **publish public / unlisted / private / revise?**

AI disclosure: if `channel-profile.md` says the persona looks realistic, YouTube requires marking the video as altered/synthetic content, and youtube-publisher has no flag for it. Default: upload as **private** → the creator ticks the altered/synthetic disclosure in YouTube Studio → he switches it to public. Tell him this in one line at the gate.

Only proceed on an explicit answer in this session.

---

## Step 9: Upload

On the creator's PC, same command style as Step 7:
```bash
cd <youtube-publisher>/scripts
node node_modules/ts-node/dist/bin.js youtube-upload.ts -v <video.mp4> -t "<title>" -d "<description>" \
  --tags "<tags>" -c <category> -p <privacy> [--short] \
  [--subtitles <captions.srt> --subtitle-lang en --subtitle-name "English"]
```

- Save the output to `result.json` (video ID, URL, status).
- If the upload is interrupted or exits with `42` / `43`, **do not re-run the upload**: follow youtube-publisher's recovery rules (inspect the channel for the same-title video first). Re-uploading risks duplicates and burns quota.
- If only the thumbnail failed, use its `upload-thumbnail.ts` recovery command.
- Append a row to `published.csv`.

---

## Step 10: Close out

Tell the creator in a few lines: the URL, the privacy state (and the Studio step if the disclosure rule applied), the hypothesis being tested, and that the next run will score it once it's ≥48h old.

---

## Rules

- One publish path: youtube-publisher. Don't upload through vidIQ (`vidiq_video_upload`) or anything else.
- Never delete or edit existing videos, and never post comments or replies (including `vidiq_generate_comment_replies` output) without the creator approving the exact text. YouTube has no DMs: "comment X and I'll send it" CTAs are answered in the comments.
- Ask before every download, message or upload.
- Every claim about what works cites video IDs and numbers. No vibes-based "trends".
- Don't copy another creator's video or reference: use them for the *pattern*, then make the persona's own version.
- Keep `learnings.md` and `STYLE.md` concise: merge duplicates, keep the evidence.