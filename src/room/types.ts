export type FurnitureKind = 'rug' | 'sofa' | 'table' | 'plant' | 'lamp' | 'speaker';

export interface RoomThemeDefinition {
  id: string;
  name: string;
  wallColor: string;
  floorColor: string;
  accentColor: string;
  panelColor: string;
}

export interface FurnitureDefinition {
  id: string;
  name: string;
  kind: FurnitureKind;
  width: number;
  height: number;
  color: string;
  accentColor: string;
  defaultX: number;
  defaultY: number;
  defaultScale: number;
}

export interface RoomCatalog {
  schemaVersion: number;
  themes: RoomThemeDefinition[];
  furniture: FurnitureDefinition[];
}
