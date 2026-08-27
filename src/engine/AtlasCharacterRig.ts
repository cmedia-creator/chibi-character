import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { buildBones } from './buildBones';
import { MotionPlayer } from './MotionPlayer';
import type {
  BoneName,
  CharacterDefinition,
  MotionCatalog,
  MotionDefinition,
  PartDebugState,
  TextureFrameDefinition,
} from './types';

export class AtlasCharacterRig {
  readonly root = new Container();
  private readonly bones = new Map<string, Container>();
  private readonly slots = new Map<string, Sprite>();
  private readonly defaults = new Map<string, PartDebugState>();
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
    this.root.hitArea = new Rectangle(-260, -930, 520, 950);

    for (const [name, bone] of buildBones(this.root, definition.bones)) {
      this.bones.set(name, bone);
    }

    const motions = new Map<string, MotionDefinition>(
      motionCatalog.motions.map((motion) => [motion.id, motion]),
    );
    this.motionPlayer = new MotionPlayer(this.bones, motions);
  }

  static async create(characterUrl: string, motionUrl: string): Promise<AtlasCharacterRig> {
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

    const rig = new AtlasCharacterRig(character, motionCatalog);
    await rig.loadParts();
    rig.startBlinkLoop();
    return rig;
  }

  get isBusy(): boolean {
    return this.motionPlayer.isBusy;
  }

  canPlay(id: string): boolean {
    return this.motionPlayer.canPlay(id);
  }

  onTap(handler: () => void): void {
    this.root.on('pointertap', handler);
  }

  play(id: string, options: { interrupt?: boolean } = {}): Promise<void> {
    return this.motionPlayer.play(id, options);
  }

  blinkNow(): Promise<void> {
    return this.blink();
  }

  async replacePartSource(
    slot: string,
    source: { asset: string; frame?: TextureFrameDefinition },
  ): Promise<void> {
    const sprite = this.slots.get(slot);
    if (!sprite) return;
    await Assets.load(source.asset);
    const sourceTexture = Assets.get(source.asset) as Texture | undefined;
    if (!sourceTexture) throw new Error(`Texture missing: ${source.asset}`);

    const width = sprite.width;
    const height = sprite.height;
    sprite.texture = source.frame
      ? new Texture({
          source: sourceTexture.source,
          frame: new Rectangle(source.frame.x, source.frame.y, source.frame.width, source.frame.height),
        })
      : sourceTexture;
    sprite.width = width;
    sprite.height = height;
  }

  getPartDebugStates(): PartDebugState[] {
    return [...this.slots.entries()].map(([slot, sprite]) => ({
      slot,
      x: Math.round(sprite.x * 100) / 100,
      y: Math.round(sprite.y * 100) / 100,
      width: Math.round(sprite.width * 100) / 100,
      height: Math.round(sprite.height * 100) / 100,
      rotation: Math.round(sprite.angle * 100) / 100,
      visible: sprite.visible,
    }));
  }

  setPartDebugState(slot: string, patch: Partial<Omit<PartDebugState, 'slot'>>): void {
    const sprite = this.slots.get(slot);
    if (!sprite) return;
    if (patch.x !== undefined) sprite.x = patch.x;
    if (patch.y !== undefined) sprite.y = patch.y;
    if (patch.width !== undefined) sprite.width = Math.max(1, patch.width);
    if (patch.height !== undefined) sprite.height = Math.max(1, patch.height);
    if (patch.rotation !== undefined) sprite.angle = patch.rotation;
    if (patch.visible !== undefined) sprite.visible = patch.visible;
  }

  resetPartDebugState(slot: string): void {
    const state = this.defaults.get(slot);
    if (!state) return;
    this.setPartDebugState(slot, state);
  }

  update(deltaMS: number): void {
    this.elapsedSeconds += deltaMS / 1000;
    this.motionPlayer.update(deltaMS);
    const idle = Math.sin(this.elapsedSeconds * 2.1);
    const head = this.requireBone('head');
    const body = this.requireBone('body');
    this.root.y = this.definition.root.y + idle * 2.5;
    if (!this.motionPlayer.isBusy) head.angle = Math.sin(this.elapsedSeconds * 0.72) * 1.1;
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
      const sourceTexture = Assets.get(part.asset) as Texture | undefined;
      if (!sourceTexture) throw new Error(`Texture missing: ${part.asset}`);
      const texture = part.frame
        ? new Texture({
            source: sourceTexture.source,
            frame: new Rectangle(part.frame.x, part.frame.y, part.frame.width, part.frame.height),
          })
        : sourceTexture;
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
      this.defaults.set(part.slot, {
        slot: part.slot,
        x: part.x,
        y: part.y,
        width: part.width,
        height: part.height,
        rotation: 0,
        visible: part.visible ?? true,
      });
    }

    for (const bone of this.bones.values()) bone.sortChildren();
    this.root.sortChildren();
  }

  private startBlinkLoop(): void {
    const schedule = (): void => {
      const delay = 2400 + Math.random() * 3000;
      this.blinkTimer = window.setTimeout(() => this.blink().finally(schedule), delay);
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
