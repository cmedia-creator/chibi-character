import type { EntitlementSnapshot } from '../data/models';
import type { CatalogBundle, CatalogCategory, PartCatalog } from './types';

export class CatalogService {
  private catalog: PartCatalog | null = null;

  constructor(private readonly catalogUrl = '/data/catalog/parts.json') {}

  async load(): Promise<PartCatalog> {
    if (this.catalog) return this.catalog;
    const response = await fetch(this.catalogUrl);
    if (!response.ok) throw new Error(`Catalog load failed: ${response.status}`);
    const catalog = await response.json() as PartCatalog;
    this.catalog = catalog;
    return catalog;
  }

  async bundles(category?: CatalogCategory): Promise<CatalogBundle[]> {
    const catalog = await this.load();
    return category ? catalog.bundles.filter((bundle) => bundle.category === category) : [...catalog.bundles];
  }

  async bundle(id: string): Promise<CatalogBundle | null> {
    const catalog = await this.load();
    return catalog.bundles.find((bundle) => bundle.id === id) ?? null;
  }
}

export function canUseBundle(bundle: CatalogBundle, entitlements: EntitlementSnapshot | null): boolean {
  if (bundle.isFree) return true;
  return entitlements?.packIds.includes(bundle.packId) ?? false;
}

export function filterUsableBundles(
  bundles: CatalogBundle[],
  entitlements: EntitlementSnapshot | null,
): CatalogBundle[] {
  return bundles.filter((bundle) => canUseBundle(bundle, entitlements));
}
