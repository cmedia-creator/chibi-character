export type CatalogCategory = 'face' | 'eyes' | 'hair' | 'outfit' | 'accessory';

export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RigPartSource {
  asset: string;
  frame?: AtlasRegion;
}

export interface CatalogBundle {
  id: string;
  category: CatalogCategory;
  name: string;
  description: string;
  packId: string;
  isFree: boolean;
  tags: string[];
  sources: Record<string, RigPartSource>;
}

export interface CatalogPack {
  id: string;
  name: string;
  description: string;
  priceJpy: number;
  available: boolean;
  themeTags: string[];
}

export interface PartCatalog {
  schemaVersion: number;
  bundles: CatalogBundle[];
  packs: CatalogPack[];
}

export interface CreatorSelection {
  face?: string;
  eyes?: string;
  hair?: string;
  outfit?: string;
  accessory?: string;
}
