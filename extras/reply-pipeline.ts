/**
 * Reply to "pipeline" comments with the link to the pipeline skill.
 * YouTube has no DMs, so the reply goes in the comment thread.
 *
 *   node node_modules/ts-node/dist/bin.js reply-pipeline.ts --link <url> [--dry-run] [--max 20]
 *
 * Put it in youtube-publisher/scripts/ (it reuses that skill's login). Remembers answered threads in --state
 * and logs every action to --log (defaults: <workspace>/pipeline/replied.json and replies-log.txt).
 */
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { authenticate } from "./authenticate";

const args = process.argv.slice(2);
const arg = (k: string, d = "") => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DRY = args.includes("--dry-run");
const LINK = arg("--link");
const MAX = parseInt(arg("--max", "20"), 10);
const ROOT = path.resolve(__dirname, "../../../../pipeline");
const STATE = arg("--state", path.join(ROOT, "replied.json"));
const LOG = arg("--log", path.join(ROOT, "replies-log.txt"));
const KEYWORD = /\bpipeline\b/i;

// Rotated so YouTube's spam filter doesn't see one identical reply.
const TEMPLATES = [
  "Here you go 👇 {link} That's the full pipeline skill. Star it if it helps!",
  "Sent! Here's the full pipeline skill: {link} 🤖 Star it if it helps!",
  "As promised, the full pipeline skill 👉 {link} Star it if it helps!",
];

function log(line: string) {
  const s = `${new Date().toISOString()}  ${line}`;
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf-8");
}

async function main() {
  if (!LINK) { console.error("Missing --link <url>"); process.exit(1); }
  const state: { replied: string[] } = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf-8")) : { replied: [] };
  const done = new Set(state.replied);
  const { oauth2Client: auth } = await authenticate(false);
  const yt = google.youtube({ version: "v3", auth });

  const me = (await yt.channels.list({ part: ["id"], mine: true })).data.items?.[0]?.id;
  if (!me) throw new Error("Could not read the channel ID for this login");

  let pageToken: string | undefined, scanned = 0, replied = 0;
  do {
    const res = await yt.commentThreads.list({
      part: ["snippet", "replies"], allThreadsRelatedToChannelId: me, maxResults: 100,
      order: "time", textFormat: "plainText", pageToken,
    });
    for (const t of res.data.items || []) {
      scanned++;
      const top = t.snippet?.topLevelComment?.snippet;
      const id = t.id!;
      if (!top || done.has(id)) continue;
      if (top.authorChannelId?.value === me) continue;              // our own comments
      if (!KEYWORD.test(top.textOriginal || top.textDisplay || "")) continue;
      const ours = (t.replies?.comments || []).some((c) => c.snippet?.authorChannelId?.value === me);
      if (ours) { done.add(id); continue; }                          // already answered by hand
      if (replied >= MAX) continue;
      const text = TEMPLATES[(done.size + replied) % TEMPLATES.length].replace("{link}", LINK);
      const who = top.authorDisplayName, video = t.snippet?.videoId;
      if (DRY) { log(`[dry-run] would reply to ${who} on ${video}: ${text}`); replied++; continue; }
      await yt.comments.insert({ part: ["snippet"], requestBody: { snippet: { parentId: id, textOriginal: text } } });
      done.add(id); replied++;
      log(`replied to ${who} on ${video} (thread ${id})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken && scanned < 500);

  if (!DRY) fs.writeFileSync(STATE, JSON.stringify({ replied: [...done] }, null, 1), "utf-8");
  log(`${DRY ? "[dry-run] " : ""}scanned ${scanned} comment threads, ${replied} ${DRY ? "would be answered" : "answered"}`);
}

main().catch((e) => { log(`ERROR ${e?.message || e}`); process.exit(1); });
