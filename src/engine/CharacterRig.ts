import { Assets, Container, Rectangle, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { MotionPlayer } from './MotionPlayer';
import type { BoneName, CharacterDefinition, MotionCatalog, MotionDefinition } from './types';

export class CharacterRig {
  readonly root = new Container();
  private readonly bones = new Map<string, Container>();
  private readonly slots = new Map<string, Sprite>();
  private readonly motionPlayer: MotionPlayer;
  private blinkTimer: number | null = null;
  private elapsedSeconds = 0;
  private blinking = false;

  private constructor(
    private readonly definition: CharacterDefinition,
    motionCatalog: MotionCatalog,
  ) {
    this.root.position.set(definition.root.x, definition.root.y);
    this.root.scale.set(definition.root.scale);
    this.root.sortableChildren = true;
    this.root.eventMode = 'static';
    this.root.hitArea = new Rectangle(-245, -900, 490, 920);

    for (const boneDef of definition.bones) {
      const bone = new Container();
      bone.label = boneDef.name;
      bone.position.set(boneDef.x, boneDef.y);
      bone.zIndex = boneDef.zIndex;
      bone.sortableChildren = true;
      this.bones.set(boneDef.name, bone);
      this.root.addChild(bone);
    }

    const motions = new Map<string, MotionDefinition>(
      motionCatalog.motions.map((motion) => [motion.id, motion]),
    );
    this.motionPlayer = new MotionPlayer(this.bones, motions);
  }

  static async create(characterUrl: string, motionUrl: string): Promise<CharacterRig> {
    const [character, motionCatalog] = await Promise.all([
      fetch(characterUrl).then((r) => {
        if (!r.ok) throw new Error(`Character load failed: ${r.status}`);
        return r.json() as Promise<CharacterDefinition>;
      }),
      fetch(motionUrl).then((r) => {
        if (!r.ok) throw new Error(`Motion load failed: ${r.status}`);
        return r.json() as Promise<MotionCatalog>;
      }),
    ]);

    const rig = new CharacterRig(character, motionCatalog);
    await rig.loadParts();
    rig.startBlinkLoop();
    return rig;
  }

  onTap(handler: () => void): void {
    this.root.on('pointertap', handler);
  }

  play(id: string): Promise<void> {
    return this.motionPlayer.play(id);
  }

  blinkNow(): Promise<void> {
    return this.blink();
  }

  update(deltaMS: number): void {
    this.elapsedSeconds += deltaMS / 1000;
    this.motionPlayer.update(deltaMS);

    const idle = Math.sin(this.elapsedSeconds * 2.1);
    const head = this.requireBone('head');
    const body = this.requireBone('body');

    this.root.y = this.definition.root.y + idle * 2.5;
    if (!this.motionPlayer.isBusy) {
      head.angle = Math.sin(this.elapsedSeconds * 0.72) * 1.1;
    }
    body.scale.y = 1 + idle * 0.004;
  }

  destroy(): void {
    if (this.blinkTimer !== null) window.clearTimeout(this.blinkTimer);
    this.root.destroy({ children: true });
  }

  private async loadParts(): Promise<void> {
    const uniqueAssets = [...new Set(this.definition.parts.map((part) => part.asset))];
    await Assets.load(uniqueAssets);

    for (const part of this.definition.parts) {
      const texture = Assets.get(part.asset) as Texture | undefined;
      if (!texture) throw new Error(`Texture missing: ${part.asset}`);

      const sprite = new Sprite(texture);
      sprite.label = part.id;
      sprite.anchor.set(part.anchorX, part.anchorY);
      sprite.position.set(part.x, part.y);
      sprite.width = part.width;
      sprite.height = part.height;
      sprite.zIndex = part.zIndex;
      sprite.visible = part.visible ?? true;

      this.requireBone(part.bone).addChild(sprite);
      this.slots.set(part.slot, sprite);
    }

    for (const bone of this.bones.values()) bone.sortChildren();
    this.root.sortChildren();
  }

  private startBlinkLoop(): void {
    const schedule = (): void => {
      const delay = 2400 + Math.random() * 3000;
      this.blinkTimer = window.setTimeout(() => {
        this.blink().finally(schedule);
      }, delay);
    };
    schedule();
  }

  private async blink(): Promise<void> {
    if (this.blinking) return;

    const open = this.slots.get('eyes_open');
    const closed = this.slots.get('eyes_closed');
    if (!open || !closed) return;

    this.blinking = true;
    try {
      open.visible = false;
      closed.visible = true;
      await new Promise((resolve) => window.setTimeout(resolve, 140));
      open.visible = true;
      closed.visible = false;
    } finally {
      this.blinking = false;
    }
  }

  private requireBone(name: BoneName): Container {
    const bone = this.bones.get(name);
    if (!bone) throw new Error(`Bone missing: ${name}`);
    return bone;
  }
}
