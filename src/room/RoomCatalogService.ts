import type { FurnitureDefinition, RoomCatalog, RoomThemeDefinition } from './types';

export class RoomCatalogService {
  private catalog: RoomCatalog | null = null;

  constructor(private readonly url = '/data/rooms/catalog.json') {}

  async load(): Promise<RoomCatalog> {
    if (this.catalog) return this.catalog;
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Room catalog load failed: ${response.status}`);
    this.catalog = await response.json() as RoomCatalog;
    return this.catalog;
  }

  async theme(id: string): Promise<RoomThemeDefinition | null> {
    const catalog = await this.load();
    return catalog.themes.find((theme) => theme.id === id) ?? null;
  }

  async furniture(id: string): Promise<FurnitureDefinition | null> {
    const catalog = await this.load();
    return catalog.furniture.find((item) => item.id === id) ?? null;
  }
}
