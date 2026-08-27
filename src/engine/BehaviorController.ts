type BehaviorRig = {
  readonly isBusy: boolean;
  canPlay(id: string): boolean;
  play(id: string, options?: { interrupt?: boolean }): Promise<void>;
  blinkNow(): Promise<void>;
};

export type BehaviorState =
  | 'idle'
  | 'look'
  | 'sway'
  | 'greet'
  | 'curious'
  | 'walk'
  | 'sit'
  | 'heart';

type StateListener = (state: BehaviorState) => void;

type AmbientChoice = {
  state: BehaviorState;
  motionId: string;
  weight: number;
};

const AMBIENT_CHOICES: AmbientChoice[] = [
  { state: 'look', motionId: 'motion.look.left.001', weight: 18 },
  { state: 'look', motionId: 'motion.look.right.001', weight: 18 },
  { state: 'curious', motionId: 'motion.curious.001', weight: 16 },
  { state: 'sway', motionId: 'motion.sway.001', weight: 20 },
  { state: 'walk', motionId: 'motion.walk.inplace.001', weight: 12 },
  { state: 'sit', motionId: 'motion.sit.001', weight: 9 },
  { state: 'heart', motionId: 'motion.heart.001', weight: 5 },
  { state: 'greet', motionId: 'motion.wave.001', weight: 2 },
];

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

    if (this.tapCount >= 3 && this.rig.canPlay('motion.curious.001')) {
      this.onState('curious');
      await this.rig.play('motion.curious.001', { interrupt: true });
      this.onState('idle');
      this.tapCount = 0;
      return;
    }

    if (!this.rig.canPlay('motion.wave.001')) return;
    this.onState('greet');
    await this.rig.play('motion.wave.001', { interrupt: true });
    this.onState('idle');
  }

  async greetAfterAbsence(msAway: number): Promise<void> {
    if (!this.enabled || msAway < 30_000 || !this.rig.canPlay('motion.wave.001')) return;
    this.resetTimer();
    this.onState('greet');
    await this.rig.play('motion.wave.001', { interrupt: true });
    this.onState('idle');
  }

  private runAmbientAction(): void {
    const available = AMBIENT_CHOICES.filter((choice) => this.rig.canPlay(choice.motionId));
    if (available.length === 0) return;

    const totalWeight = available.reduce((sum, choice) => sum + choice.weight, 0);
    let cursor = Math.random() * totalWeight;
    let selected = available.at(-1)!;
    for (const choice of available) {
      cursor -= choice.weight;
      if (cursor <= 0) {
        selected = choice;
        break;
      }
    }

    this.onState(selected.state);
    void this.rig.play(selected.motionId).finally(() => this.onState('idle'));
  }

  private resetTimer(): void {
    this.elapsed = 0;
    this.nextActionAt = this.randomDelay();
  }

  private randomDelay(): number {
    return 4_000 + Math.random() * 5_500;
  }
}
