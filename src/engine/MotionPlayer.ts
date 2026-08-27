import type { Container } from 'pixi.js';
import type { MotionDefinition, MotionKeyframe } from './types';

export class MotionPlayer {
  private activeMotion: MotionDefinition | null = null;
  private elapsed = 0;
  private resolveActive: (() => void) | null = null;

  constructor(
    private readonly bones: Map<string, Container>,
    private readonly catalog: Map<string, MotionDefinition>,
  ) {}

  get isBusy(): boolean {
    return this.activeMotion !== null;
  }

  play(id: string): Promise<void> {
    if (this.activeMotion) return Promise.resolve();
    const motion = this.catalog.get(id);
    if (!motion) throw new Error(`Unknown motion: ${id}`);

    this.activeMotion = motion;
    this.elapsed = 0;

    return new Promise((resolve) => {
      this.resolveActive = resolve;
    });
  }

  update(deltaMS: number): void {
    const motion = this.activeMotion;
    if (!motion) return;

    this.elapsed = Math.min(this.elapsed + deltaMS, motion.duration);
    const bone = this.bones.get(motion.bone);
    if (!bone) throw new Error(`Unknown bone: ${motion.bone}`);

    bone.angle = this.sampleRotation(motion.keyframes, this.elapsed);

    if (this.elapsed >= motion.duration) {
      bone.angle = motion.keyframes.at(-1)?.rotation ?? 0;
      this.activeMotion = null;
      this.resolveActive?.();
      this.resolveActive = null;
    }
  }

  private sampleRotation(frames: MotionKeyframe[], t: number): number {
    if (frames.length === 0) return 0;
    if (t <= frames[0].t) return frames[0].rotation;

    const last = frames.at(-1)!;
    if (t >= last.t) return last.rotation;

    for (let i = 0; i < frames.length - 1; i += 1) {
      const a = frames[i];
      const b = frames[i + 1];
      if (t < a.t || t > b.t) continue;

      const raw = (t - a.t) / Math.max(1, b.t - a.t);
      const p = this.ease(raw, b.ease ?? 'easeInOut');
      return a.rotation + (b.rotation - a.rotation) * p;
    }

    return last.rotation;
  }

  private ease(t: number, type: MotionKeyframe['ease']): number {
    if (type === 'linear') return t;
    if (type === 'easeOut') return 1 - (1 - t) * (1 - t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
