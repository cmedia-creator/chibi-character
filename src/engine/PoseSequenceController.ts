import { Assets } from 'pixi.js';
import type { AtlasCharacterRig } from './AtlasCharacterRig';

type PoseAtlas = 'base' | 'gesture' | 'dance';
type PoseStep = { atlas: PoseAtlas; frame: number; hold: number };

const ATLASES: Record<PoseAtlas, string> = {
  base: '/assets/idol-expressive-v1/rehearsal-motion-atlas-v2.png',
  gesture: '/assets/idol-expressive-v1/wave-heart-inbetweens.png',
  dance: '/assets/idol-expressive-v1/dance-inbetweens.png',
};
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
    void Assets.load(Object.values(ATLASES));
    this.scheduleBlink();
  }

  blink(): Promise<void> {
    return this.play([
      { atlas: 'base', frame: 1, hold: 110 },
      { atlas: 'base', frame: 0, hold: 60 },
    ]);
  }

  wave(): Promise<void> {
    return this.play([
      { atlas: 'gesture', frame: 0, hold: 80 },
      { atlas: 'gesture', frame: 1, hold: 80 },
      { atlas: 'gesture', frame: 2, hold: 80 },
      { atlas: 'gesture', frame: 3, hold: 90 },
      { atlas: 'gesture', frame: 4, hold: 90 },
      { atlas: 'gesture', frame: 3, hold: 90 },
      { atlas: 'gesture', frame: 4, hold: 100 },
      { atlas: 'gesture', frame: 5, hold: 85 },
      { atlas: 'gesture', frame: 1, hold: 75 },
      { atlas: 'gesture', frame: 0, hold: 70 },
      { atlas: 'base', frame: 0, hold: 60 },
    ]);
  }

  heart(): Promise<void> {
    return this.play([
      { atlas: 'gesture', frame: 6, hold: 90 },
      { atlas: 'gesture', frame: 7, hold: 100 },
      { atlas: 'base', frame: 5, hold: 110 },
      { atlas: 'base', frame: 6, hold: 650 },
      { atlas: 'base', frame: 5, hold: 100 },
      { atlas: 'gesture', frame: 7, hold: 90 },
      { atlas: 'gesture', frame: 6, hold: 80 },
      { atlas: 'base', frame: 0, hold: 60 },
    ]);
  }

  dance(): Promise<void> {
    return this.play([
      { atlas: 'dance', frame: 0, hold: 85 },
      { atlas: 'dance', frame: 1, hold: 85 },
      { atlas: 'dance', frame: 2, hold: 90 },
      { atlas: 'dance', frame: 3, hold: 85 },
      { atlas: 'dance', frame: 4, hold: 85 },
      { atlas: 'dance', frame: 5, hold: 90 },
      { atlas: 'dance', frame: 6, hold: 110 },
      { atlas: 'dance', frame: 7, hold: 220 },
      { atlas: 'dance', frame: 6, hold: 95 },
      { atlas: 'dance', frame: 5, hold: 85 },
      { atlas: 'dance', frame: 4, hold: 85 },
      { atlas: 'dance', frame: 3, hold: 85 },
      { atlas: 'dance', frame: 2, hold: 85 },
      { atlas: 'dance', frame: 1, hold: 80 },
      { atlas: 'dance', frame: 0, hold: 80 },
      { atlas: 'base', frame: 0, hold: 60 },
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
        await this.setFrame(step.atlas, step.frame);
        await wait(step.hold);
      }
    } finally {
      if (token === this.token) {
        this.busy = false;
        await this.setFrame('base', 0);
      }
    }
  }

  private setFrame(atlas: PoseAtlas, index: number): Promise<void> {
    return this.rig.replacePartSource('production_look', {
      asset: ATLASES[atlas],
      frame: {
        x: (index % COLUMNS) * FRAME_WIDTH,
        y: Math.floor(index / COLUMNS) * FRAME_HEIGHT,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
      },
    });
  }

  private scheduleBlink(): void {
    const delay = 2600 + Math.random() * 2800;
    this.blinkTimer = window.setTimeout(() => {
      this.blink().finally(() => this.scheduleBlink());
    }, delay);
  }
}
