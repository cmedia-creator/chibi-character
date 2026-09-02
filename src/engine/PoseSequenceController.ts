import type { AtlasCharacterRig } from './AtlasCharacterRig';

type PoseStep = { frame: number; hold: number; transition?: number };

const ATLAS = '/assets/idol-expressive-v1/rehearsal-motion-atlas.webp';
const FRAME_WIDTH = 384;
const FRAME_HEIGHT = 512;
const COLUMNS = 4;

const wait = (duration: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export class PoseSequenceController {
  private token = 0;
  private busy = false;
  private blinkTimer: number | null = null;

  constructor(private readonly rig: AtlasCharacterRig) {
    this.scheduleBlink();
  }

  blink(): Promise<void> {
    return this.play([
      { frame: 1, hold: 135 },
      { frame: 0, hold: 80, transition: 55 },
    ]);
  }

  wave(): Promise<void> {
    return this.play([
      { frame: 2, hold: 90, transition: 130 },
      { frame: 3, hold: 105, transition: 115 },
      { frame: 4, hold: 105, transition: 115 },
      { frame: 3, hold: 105, transition: 115 },
      { frame: 4, hold: 120, transition: 115 },
      { frame: 0, hold: 100, transition: 150 },
    ]);
  }

  heart(): Promise<void> {
    return this.play([
      { frame: 5, hold: 120, transition: 180 },
      { frame: 6, hold: 700, transition: 170 },
      { frame: 5, hold: 100, transition: 150 },
      { frame: 0, hold: 100, transition: 170 },
    ]);
  }

  dance(): Promise<void> {
    return this.play([
      { frame: 0, hold: 80 },
      { frame: 7, hold: 130, transition: 210 },
      { frame: 4, hold: 110, transition: 180 },
      { frame: 7, hold: 130, transition: 180 },
      { frame: 3, hold: 110, transition: 170 },
      { frame: 7, hold: 130, transition: 180 },
      { frame: 0, hold: 120, transition: 220 },
    ]);
  }

  destroy(): void {
    this.token += 1;
    if (this.blinkTimer !== null) window.clearTimeout(this.blinkTimer);
  }

  private async play(steps: PoseStep[]): Promise<void> {
    if (this.busy) return;
    const token = ++this.token;
    this.busy = true;
    try {
      for (const step of steps) {
        if (token !== this.token) return;
        await this.setFrame(step.frame, step.transition ?? 75);
        await wait(step.hold);
      }
    } finally {
      if (token === this.token) {
        this.busy = false;
        await this.setFrame(0, 100);
      }
    }
  }

  private setFrame(index: number, duration: number): Promise<void> {
    return this.rig.transitionPartSource('production_look', {
      asset: ATLAS,
      frame: {
        x: (index % COLUMNS) * FRAME_WIDTH,
        y: Math.floor(index / COLUMNS) * FRAME_HEIGHT,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
      },
    }, duration);
  }

  private scheduleBlink(): void {
    const delay = 2600 + Math.random() * 2800;
    this.blinkTimer = window.setTimeout(() => {
      this.blink().finally(() => this.scheduleBlink());
    }, delay);
  }
}
