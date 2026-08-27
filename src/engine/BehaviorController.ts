type BehaviorRig = {
  readonly isBusy: boolean;
  play(id: string, options?: { interrupt?: boolean }): Promise<void>;
  blinkNow(): Promise<void>;
};

export type BehaviorState = 'idle' | 'look' | 'sway' | 'greet' | 'curious';

type StateListener = (state: BehaviorState) => void;

export class BehaviorController {
  private elapsed = 0;
  private nextActionAt = this.randomDelay();
  private lastTapAt = -Infinity;
  private tapCount = 0;
  private enabled = true;

  constructor(
    private readonly rig: BehaviorRig,
    private readonly onState: StateListener = () => undefined,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.onState('idle');
    this.resetTimer();
  }

  update(deltaMS: number): void {
    if (!this.enabled) return;
    this.elapsed += deltaMS;
    if (this.elapsed < this.nextActionAt || this.rig.isBusy) return;
    this.runAmbientAction();
    this.resetTimer();
  }

  async onTap(now = performance.now()): Promise<void> {
    if (now - this.lastTapAt < 1600) this.tapCount += 1;
    else this.tapCount = 1;
    this.lastTapAt = now;
    this.resetTimer();

    if (this.tapCount >= 3) {
      this.onState('curious');
      await this.rig.play('motion.curious.001', { interrupt: true });
      this.onState('idle');
      this.tapCount = 0;
      return;
    }

    this.onState('greet');
    await this.rig.play('motion.wave.001', { interrupt: true });
    this.onState('idle');
  }

  async greetAfterAbsence(msAway: number): Promise<void> {
    if (!this.enabled || msAway < 30_000) return;
    this.resetTimer();
    this.onState('greet');
    await this.rig.play('motion.wave.001', { interrupt: true });
    this.onState('idle');
  }

  private runAmbientAction(): void {
    const roll = Math.random();

    if (roll < 0.3) {
      this.onState('look');
      void this.rig.play('motion.look.left.001').finally(() => this.onState('idle'));
      return;
    }

    if (roll < 0.6) {
      this.onState('look');
      void this.rig.play('motion.look.right.001').finally(() => this.onState('idle'));
      return;
    }

    if (roll < 0.82) {
      this.onState('curious');
      void this.rig.play('motion.curious.001').finally(() => this.onState('idle'));
      return;
    }

    if (roll < 0.96) {
      this.onState('sway');
      void this.rig.play('motion.sway.001').finally(() => this.onState('idle'));
      return;
    }

    this.onState('greet');
    void this.rig.play('motion.wave.001').finally(() => this.onState('idle'));
  }

  private resetTimer(): void {
    this.elapsed = 0;
    this.nextActionAt = this.randomDelay();
  }

  private randomDelay(): number {
    return 4_000 + Math.random() * 5_500;
  }
}
