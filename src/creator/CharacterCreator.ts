import './creator.css';
import { CatalogService } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';
import { DraftStore } from '../data/DraftStore';
import { createEmptyCharacterDraft, type CharacterDraft } from '../data/models';
import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import { applyBundleToDraft, applyCatalogBundle } from './CreatorConfigurator';

const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  face: 'FACE',
  eyes: 'EYES',
  hair: 'HAIR',
  outfit: 'OUTFIT',
  accessory: 'ACCESSORY',
};

export async function mountCharacterCreator(options: {
  rig: AtlasCharacterRig;
  catalog?: CatalogService;
  store?: DraftStore;
}): Promise<() => void> {
  const catalogService = options.catalog ?? new CatalogService();
  const store = options.store ?? new DraftStore();
  const catalog = await catalogService.load();
  const entitlements = await store.loadEntitlementsCache();
  let draft: CharacterDraft = (await store.loadCharacterDraft()) ?? createEmptyCharacterDraft();
  let busy = false;

  const root = document.createElement('section');
  root.className = 'creator-lab';
  root.innerHTML = `
    <div class="creator-head">
      <div>
        <p class="eyebrow">PHASE 2 / CHARACTER CREATE</p>
        <h2>CREATE MY CHIBI</h2>
      </div>
      <span class="badge">LOCAL DRAFT</span>
    </div>
    <div class="creator-name-row">
      <label>CHARACTER NAME<input type="text" data-name maxlength="30" /></label>
      <p data-save-state>IndexedDBへ保存</p>
    </div>
    <div class="creator-categories" data-categories></div>
    <div class="creator-shop-preview">
      <div>
        <p class="eyebrow">PART PACKS</p>
        <h3>STYLE PACK</h3>
      </div>
      <div class="creator-pack-grid" data-packs></div>
    </div>
  `;

  document.querySelector('.app-shell')?.appendChild(root);

  const nameInput = root.querySelector<HTMLInputElement>('[data-name]')!;
  const saveState = root.querySelector<HTMLElement>('[data-save-state]')!;
  const categoriesHost = root.querySelector<HTMLDivElement>('[data-categories]')!;
  const packsHost = root.querySelector<HTMLDivElement>('[data-packs]')!;
  nameInput.value = draft.name;

  const saveDraft = async (): Promise<void> => {
    saveState.textContent = '保存中…';
    await store.saveCharacterDraft(draft);
    saveState.textContent = 'IndexedDBへ保存済み';
  };

  nameInput.addEventListener('change', () => {
    draft = { ...draft, name: nameInput.value.trim() || 'MY CHARACTER', updatedAt: Date.now() };
    void saveDraft();
  });

  const renderCategory = (category: CatalogCategory): void => {
    const section = document.createElement('section');
    section.className = 'creator-category';
    const bundles = catalog.bundles.filter((bundle) => bundle.category === category);
    section.innerHTML = `<h3>${CATEGORY_LABELS[category]}</h3><div class="creator-bundle-grid"></div>`;
    const grid = section.querySelector<HTMLDivElement>('.creator-bundle-grid')!;

    for (const bundle of bundles) {
      grid.appendChild(makeBundleButton(category, bundle));
    }
    categoriesHost.appendChild(section);
  };

  const makeBundleButton = (category: CatalogCategory, bundle: CatalogBundle): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    const owned = bundle.isFree || (entitlements?.packIds.includes(bundle.packId) ?? false);
    const selected = draft.appearance.parts[category] === bundle.id;
    button.className = `creator-bundle${selected ? ' is-selected' : ''}${owned ? '' : ' is-locked'}`;
    button.innerHTML = `
      <span>${escapeHtml(bundle.name)}</span>
      <small>${owned ? (bundle.isFree ? 'FREE' : 'OWNED') : 'LOCKED'}</small>
      <em>${escapeHtml(bundle.description)}</em>
    `;
    button.disabled = !owned;
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      saveState.textContent = 'パーツを変更中…';
      try {
        await applyCatalogBundle(options.rig, bundle, entitlements);
        draft = applyBundleToDraft(draft, category, bundle);
        await saveDraft();
        for (const other of categoriesHost.querySelectorAll(`.creator-category:nth-child(${categoryIndex(category)}) .creator-bundle`)) {
          other.classList.remove('is-selected');
        }
        button.classList.add('is-selected');
      } catch (error) {
        console.error(error);
        saveState.textContent = error instanceof Error ? error.message : '変更できませんでした';
      } finally {
        busy = false;
      }
    });
    return button;
  };

  for (const category of Object.keys(CATEGORY_LABELS) as CatalogCategory[]) renderCategory(category);

  for (const pack of catalog.packs) {
    const card = document.createElement('article');
    card.className = `creator-pack${pack.available ? '' : ' is-coming'}`;
    card.innerHTML = `
      <div><strong>${escapeHtml(pack.name)}</strong><span>${pack.priceJpy === 0 ? 'FREE' : `¥${pack.priceJpy.toLocaleString('ja-JP')}`}</span></div>
      <p>${escapeHtml(pack.description)}</p>
      <small>${pack.available ? 'AVAILABLE' : 'COMING SOON'}</small>
    `;
    packsHost.appendChild(card);
  }

  return () => root.remove();
}

function categoryIndex(category: CatalogCategory): number {
  return (Object.keys(CATEGORY_LABELS) as CatalogCategory[]).indexOf(category) + 1;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === "'") return '&#39;';
    return '&quot;';
  });
}
