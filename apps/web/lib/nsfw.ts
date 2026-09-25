/**
 * Checks the video we *receive* for nudity, in the browser (no frames leave the device unless you
 * report). Loaded lazily the first time a video call starts, so it never slows down sign-up.
 */
type Model = {
  classify(
    img: HTMLVideoElement,
    topk?: number,
  ): Promise<{ className: string; probability: number }[]>;
};

let modelPromise: Promise<Model> | null = null;

function loadModel(): Promise<Model> {
  modelPromise ??= (async () => {
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    // Only the small MobileNetV2 model (~3.5 MB) is bundled; nsfwjs's default entry pulls in all three.
    const [{ load }, { MobileNetV2Model }] = await Promise.all([
      import("nsfwjs/core"),
      import("nsfwjs/models/mobilenet_v2"),
    ]);
    return (await load("MobileNetV2", {
      modelDefinitions: [MobileNetV2Model],
    })) as unknown as Model;
  })();
  return modelPromise;
}

const SAMPLE_MS = 2_000;
const THRESHOLD = 0.7;

/** Samples the video every 2s; calls onFlag once after two explicit frames in a row. */
export function watchForNudity(
  video: HTMLVideoElement,
  onFlag: (score: number) => void,
): () => void {
  let stopped = false;
  let strikes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const model = await loadModel();
        if (stopped) return;
        const preds = await model.classify(video, 5);
        const score = preds
          .filter((p) => p.className === "Porn" || p.className === "Hentai")
          .reduce((sum, p) => sum + p.probability, 0);
        strikes = score >= THRESHOLD ? strikes + 1 : 0;
        if (strikes >= 2) {
          onFlag(score);
          return; // one flag per call is enough
        }
      }
    } catch {
      // Model failed to load (old device, no WebGL): reports still work.
    }
    timer = setTimeout(tick, SAMPLE_MS);
  };
  timer = setTimeout(tick, SAMPLE_MS);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
