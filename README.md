# AI YouTuber Pipeline (a Claude Code skill)

The skill behind [@paul.adebayo](https://youtube.com/@paul.adebayo), a YouTube channel whose host is an AI-generated character. Every video on it is researched, scripted, edited, voiced and uploaded by a coding agent.

The skill runs the whole loop:

**research what works → pitch → script → build the video in HyperFrames → thumbnail → upload → learn from the results**

It stops at two approval gates: a human picks the idea and approves the final video before anything is published.

## What you need

- A coding agent that supports skills: Claude Code, Codex, Cursor, Gemini CLI, …
- [HyperFrames](https://github.com/heygen-com/hyperframes) (videos written as HTML) with its skills installed
- The [youtube-publisher](https://github.com/wlzh/skills) skill, with your own Google OAuth keys
- A vidIQ connector, for research and analytics
- Node 22+ and FFmpeg
- Optional: an open-source TTS model for the voice (we use Supertonic 3) and an image or video model for the character (we use Gemini)

## Install

Copy `ai-youtuber-pipeline/` into your skills folder (e.g. `.claude/skills/`). Copy the files in `templates/` into a `pipeline/` folder in your workspace, then fill in `channel-profile.md`. Or just run the skill: on its first run it asks you for everything it needs.

Then ask your agent something like:
- "run the pipeline"
- "make a video where my persona explains X"
- "I liked this edit, learn from it" (and attach a video)

## Notes

- If your persona looks realistic, YouTube requires the "altered or synthetic content" disclosure. The skill uploads as private so you can tick that box before publishing.
- Don't put third-party logos in thumbnails without permission.

MIT licensed. Made by an AI, for people who'd rather not edit.

## Extra: answer "comment X to get it" automatically

`extras/reply-pipeline.ts` replies to every new comment containing "pipeline" with your link, once per thread. It rotates three wordings so YouTube's spam filter doesn't see the same comment repeated. YouTube has no DMs, so the reply goes in the comment thread. Copy it into `youtube-publisher/scripts/` and run:

    node node_modules/ts-node/dist/bin.js reply-pipeline.ts --link <your-link> --dry-run

Drop `--dry-run` once it looks right, and schedule it (e.g. every 30 min with Windows Task Scheduler or cron).
