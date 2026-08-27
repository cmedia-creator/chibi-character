export type BoneName = 'body' | 'arm_L' | 'arm_R' | 'head';

export interface BoneDefinition {
  name: BoneName;
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
  rotation: number;
  ease?: EaseName;
}

export interface MotionDefinition {
  id: string;
  duration: number;
  bone: BoneName;
  keyframes: MotionKeyframe[];
}

export interface MotionCatalog {
  motions: MotionDefinition[];
}
