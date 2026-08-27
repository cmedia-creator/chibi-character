export type BoneName = 'pelvis' | 'body' | 'arm_L' | 'arm_R' | 'head' | 'leg_L' | 'leg_R';

export interface BoneDefinition {
  name: BoneName;
  parent?: BoneName;
  x: number;
  y: number;
  zIndex: number;
}

export interface TextureFrameDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PartDefinition {
  id: string;
  slot: string;
  bone: BoneName;
  asset: string;
  frame?: TextureFrameDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  zIndex: number;
  visible?: boolean;
}

export interface CharacterDefinition {
  id: string;
  schemaVersion: number;
  root: { x: number; y: number; scale: number };
  bones: BoneDefinition[];
  parts: PartDefinition[];
}

export type EaseName = 'linear' | 'easeInOut' | 'easeOut';

export interface MotionKeyframe {
  t: number;
  rotation?: number;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  ease?: EaseName;
}

export interface MotionTrack {
  bone: BoneName;
  keyframes: MotionKeyframe[];
}

export interface MotionDefinition {
  id: string;
  duration: number;
  priority?: number;
  tracks?: MotionTrack[];
  /** Legacy single-bone form kept while Phase 1 data migrates. */
  bone?: BoneName;
  keyframes?: MotionKeyframe[];
}

export interface MotionCatalog {
  motions: MotionDefinition[];
}

export interface PartDebugState {
  slot: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
}
