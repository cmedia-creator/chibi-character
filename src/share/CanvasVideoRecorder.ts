import { renderChibiCard, type ChibiCardOptions } from './ChibiCardRenderer';

export interface CanvasVideoOptions {
  durationMs?: number;
  fps?: number;
  card: ChibiCardOptions;
  onStart?: () => void | Promise<void>;
}

export interface RecordedVideo {
  blob: Blob;
  mimeType: string;
  extension: 'mp4' | 'webm';
}

export async function recordChibiVideo(
  source: HTMLCanvasElement,
  options: CanvasVideoOptions,
): Promise<RecordedVideo> {
  if (!('MediaRecorder' in window)) throw new Error('MediaRecorder is not supported.');

  const durationMs = options.durationMs ?? 4_000;
  const fps = options.fps ?? 30;
  const output = renderChibiCard(source, options.card);
  const capture = output.captureStream?.bind(output);
  if (!capture) throw new Error('Canvas captureStream is not supported.');

  const stream = capture(fps);
  const mimeType = pickMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true });
    recorder.addEventListener('error', () => reject(recorder.error ?? new Error('Recording failed.')), { once: true });
  });

  let raf = 0;
  let running = true;
  const draw = (): void => {
    if (!running) return;
    renderChibiCard(source, options.card, output);
    raf = requestAnimationFrame(draw);
  };

  recorder.start(250);
  draw();

  try {
    await options.onStart?.();
    await wait(durationMs);
  } finally {
    running = false;
    cancelAnimationFrame(raf);
    if (recorder.state !== 'inactive') recorder.stop();
  }

  await stopped;
  for (const track of stream.getTracks()) track.stop();

  const actualMime = recorder.mimeType || mimeType || 'video/webm';
  const blob = new Blob(chunks, { type: actualMime });
  return {
    blob,
    mimeType: actualMime,
    extension: actualMime.includes('mp4') ? 'mp4' : 'webm',
  };
}

function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
