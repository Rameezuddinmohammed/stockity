// Renders index.html to quad-trailer.mp4 (1920x1080, 30fps, AAC audio).
//
//   npm i --no-save playwright ffmpeg-static   (in any folder Node can resolve from)
//   node marketing/trailer/render.mjs [--fps 30] [--out path.mp4] [--frames 12,17.5]
//
// --frames writes PNG stills at those seconds instead of a video (handy for checking a scene).
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((a) => a.trim().split(/\s+/)),
);
const fps = Number(args.fps ?? 30);
const out = args.out ?? join(here, "quad-trailer.mp4");

const browser = await chromium.launch({
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: optional local override
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${pathToFileURL(join(here, "index.html"))}?render`);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => DURATION);

if (args.frames) {
  for (const s of args.frames.split(",")) {
    await page.evaluate((t) => window.__seek(t), Number(s));
    await page.screenshot({ path: join(here, `still-${s}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const wavPath = join(here, "soundtrack.wav");
writeFileSync(wavPath, Buffer.from(await page.evaluate(() => window.__renderAudio()), "base64"));
console.log("soundtrack.wav written");

const ff = spawn(
  ffmpeg,
  [
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(fps),
    "-c:v",
    "mjpeg",
    "-i",
    "-",
    "-i",
    wavPath,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    "-movflags",
    "+faststart",
    out,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);

const total = Math.round(duration * fps);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.__seek(t), i / fps);
  const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % fps === 0) process.stdout.write(`\rframe ${i}/${total}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log(`\n${out}`);
