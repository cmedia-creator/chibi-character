import type { Container } from 'pixi.js';
import type { MotionDefinition, MotionKeyframe, MotionTrack } from './types';

type PlayOptions = {
  interrupt?: boolean;
};

type BoneBaseline = {
  angle: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
};

export class MotionPlayer {
  private activeMotion: MotionDefinition | null = null;
  private activeTracks: MotionTrack[] = [];
  private activeBaselines = new Map<string, BoneBaseline>();
  private elapsed = 0;
  private resolveActive: (() => void) | null = null;

  constructor(
    private readonly bones: Map<string, Container>,
    private readonly catalog: Map<string, MotionDefinition>,
  ) {}

  get isBusy(): boolean {
    return this.activeMotion !== null;
  }

  get activeId(): string | null {
    return this.activeMotion?.id ?? null;
  }

  play(id: string, options: PlayOptions = {}): Promise<void> {
    const motion = this.catalog.get(id);
    if (!motion) throw new Error(`Unknown motion: ${id}`);

    if (this.activeMotion) {
      const currentPriority = this.activeMotion.priority ?? 0;
      const nextPriority = motion.priority ?? 0;
      if (!options.interrupt && nextPriority <= currentPriority) return Promise.resolve();
      this.finishActive(true);
    }

    const tracks = this.normalizeTracks(motion);
    this.activeBaselines.clear();
    for (const track of tracks) {
      const bone = this.bones.get(track.bone);
      if (!bone) throw new Error(`Unknown bone: ${track.bone}`);
      if (!this.activeBaselines.has(track.bone)) {
        this.activeBaselines.set(track.bone, {
          angle: bone.angle,
          x: bone.x,
          y: bone.y,
          scaleX: bone.scale.x,
          scaleY: bone.scale.y,
          alpha: bone.alpha,
        });
      }
    }

    this.activeMotion = motion;
    this.activeTracks = tracks;
    this.elapsed = 0;

    return new Promise((resolve) => {
      this.resolveActive = resolve;
    });
  }

  update(deltaMS: number): void {
    const motion = this.activeMotion;
    if (!motion) return;

    this.elapsed = Math.min(this.elapsed + deltaMS, motion.duration);

    for (const track of this.activeTracks) {
      const bone = this.bones.get(track.bone)!;
      const frames = track.keyframes;
      if (frames.length === 0) continue;

      const rotation = this.sampleNumber(frames, this.elapsed, 'rotation');
      const x = this.sampleNumber(frames, this.elapsed, 'x');
      const y = this.sampleNumber(frames, this.elapsed, 'y');
      const scaleX = this.sampleNumber(frames, this.elapsed, 'scaleX');
      const scaleY = this.sampleNumber(frames, this.elapsed, 'scaleY');
      const alpha = this.sampleNumber(frames, this.elapsed, 'alpha');

      if (rotation !== null) bone.angle = rotation;
      if (x !== null) bone.x = x;
      if (y !== null) bone.y = y;
      if (scaleX !== null) bone.scale.x = scaleX;
      if (scaleY !== null) bone.scale.y = scaleY;
      if (alpha !== null) bone.alpha = alpha;
    }

    if (this.elapsed >= motion.duration) this.finishActive(true);
  }

  private finishActive(restoreBaseline: boolean): void {
    if (restoreBaseline) {
      for (const [boneName, baseline] of this.activeBaselines) {
        const bone = this.bones.get(boneName);
        if (!bone) continue;
        bone.angle = baseline.angle;
        bone.position.set(baseline.x, baseline.y);
        bone.scale.set(baseline.scaleX, baseline.scaleY);
        bone.alpha = baseline.alpha;
      }
    }

    this.activeMotion = null;
    this.activeTracks = [];
    this.activeBaselines.clear();
    this.elapsed = 0;
    this.resolveActive?.();
    this.resolveActive = null;
  }

  private normalizeTracks(motion: MotionDefinition): MotionTrack[] {
    if (motion.tracks?.length) return motion.tracks;
    if (motion.bone && motion.keyframes) {
      return [{ bone: motion.bone, keyframes: motion.keyframes }];
    }
    return [];
  }

  private sampleNumber(
    frames: MotionKeyframe[],
    t: number,
    key: 'rotation' | 'x' | 'y' | 'scaleX' | 'scaleY' | 'alpha',
  ): number | null {
    const defined = frames.filter((frame) => frame[key] !== undefined);
    if (defined.length === 0) return null;
    if (t <= defined[0].t) return defined[0][key] as number;

    const last = defined.at(-1)!;
    if (t >= last.t) return last[key] as number;

    for (let i = 0; i < defined.length - 1; i += 1) {
      const a = defined[i];
      const b = defined[i + 1];
      if (t < a.t || t > b.t) continue;

      const raw = (t - a.t) / Math.max(1, b.t - a.t);
      const p = this.ease(raw, b.ease ?? 'easeInOut');
      const av = a[key] as number;
      const bv = b[key] as number;
      return av + (bv - av) * p;
    }

    return last[key] as number;
  }

  private ease(t: number, type: MotionKeyframe['ease']): number {
    if (type === 'linear') return t;
    if (type === 'easeOut') return 1 - (1 - t) * (1 - t);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
