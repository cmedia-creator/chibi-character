import './creator.css';
import { CatalogService, canUseBundle } from '../catalog/CatalogService';
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

const QUICK_STYLE_GROUPS: Array<{ category: CatalogCategory; label: string }> = [
  { category: 'hair', label: 'HAIR STYLE' },
  { category: 'eyes', label: 'EYE STYLE' },
  { category: 'accessory', label: 'ACCESSORY' },
];

type ColorKey = 'hair' | 'eyes' | 'outfit';

type ColorOption = {
  id: string;
  label: string;
  value: string;
};

type ColorGroup = {
  key: ColorKey;
  label: string;
  slots: string[];
  options: ColorOption[];
};

const COLOR_GROUPS: ColorGroup[] = [
  {
    key: 'hair',
    label: 'HAIR',
    slots: ['hair_back', 'hair_front'],
    options: [
      { id: 'original', label: 'Original', value: '#ffffff' },
      { id: 'cocoa', label: 'Cocoa', value: '#d7b7b0' },
      { id: 'rose', label: 'Rose', value: '#ffc2d7' },
      { id: 'lavender', label: 'Lavender', value: '#d7c5ff' },
      { id: 'ice', label: 'Ice', value: '#c5e2ff' },
    ],
  },
  {
    key: 'eyes',
    label: 'EYES',
    slots: ['eyes_open', 'eyes_closed'],
    options: [
      { id: 'original', label: 'Violet', value: '#ffffff' },
      { id: 'pink', label: 'Pink', value: '#ffd0e3' },
      { id: 'blue', label: 'Blue', value: '#c3ddff' },
      { id: 'mint', label: 'Mint', value: '#c9f3e5' },
      { id: 'amber', label: 'Amber', value: '#ffe0a6' },
    ],
  },
  {
    key: 'outfit',
    label: 'OUTFIT',
    // The current arm/leg sprites contain skin, so tint only the torso until
    // clothing and skin are split into independent production slots.
    slots: ['torso'],
    options: [
      { id: 'original', label: 'Original', value: '#ffffff' },
      { id: 'pink', label: 'Pink', value: '#ffd2e6' },
      { id: 'violet', label: 'Violet', value: '#ded3ff' },
      { id: 'blue', label: 'Blue', value: '#d0e5ff' },
      { id: 'silver', label: 'Silver', value: '#e5e8ee' },
    ],
  },
];

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

  const categories = Object.keys(CATEGORY_LABELS) as CatalogCategory[];
  for (const category of categories) {
    if (draft.appearance.parts[category]) continue;
    const firstUsable = catalog.bundles.find(
      (bundle) => bundle.category === category && canUseBundle(bundle, entitlements),
    );
    if (firstUsable) draft = applyBundleToDraft(draft, category, firstUsable);
  }

  // Restore the actual visual state from the saved part IDs before the editor mounts.
  for (const category of categories) {
    const bundleId = draft.appearance.parts[category];
    const bundle = catalog.bundles.find((item) => item.id === bundleId);
    if (bundle && canUseBundle(bundle, entitlements)) {
      await applyCatalogBundle(options.rig, bundle, entitlements);
    }
  }

  const appShell = document.querySelector<HTMLElement>('.app-shell');
  const controls = document.querySelector<HTMLElement>('.controls');
  appShell?.classList.add('is-creator-mode');

  const root = document.createElement('section');
  root.className = 'creator-lab creator-lab-compact';
  root.innerHTML = `
    <div class="creator-quick-head">
      <div>
        <p class="eyebrow">CREATE / QUICK EDIT</p>
        <h2>LOOK</h2>
      </div>
      <button type="button" class="creator-randomize" data-randomize>おまかせ</button>
    </div>
    <div class="creator-style-groups" data-style-groups></div>
    <div class="creator-color-groups" data-colors></div>
    <div class="creator-save-line" data-save-state>端末へ自動保存</div>
    <details class="creator-details">
      <summary>名前・パーツ・パックを設定</summary>
      <div class="creator-details-body">
        <div class="creator-name-row">
          <label>CHARACTER NAME<input type="text" data-name maxlength="30" /></label>
        </div>
        <div class="creator-categories" data-categories></div>
        <div class="creator-shop-preview">
          <div>
            <p class="eyebrow">PART PACKS</p>
            <h3>STYLE PACK</h3>
          </div>
          <div class="creator-pack-grid" data-packs></div>
        </div>
      </div>
    </details>
  `;

  if (controls) controls.after(root);
  else appShell?.appendChild(root);

  const nameInput = root.querySelector<HTMLInputElement>('[data-name]')!;
  const saveState = root.querySelector<HTMLElement>('[data-save-state]')!;
  const categoriesHost = root.querySelector<HTMLDivElement>('[data-categories]')!;
  const colorsHost = root.querySelector<HTMLDivElement>('[data-colors]')!;
  const styleGroupsHost = root.querySelector<HTMLDivElement>('[data-style-groups]')!;
  const packsHost = root.querySelector<HTMLDivElement>('[data-packs]')!;
  const randomizeButton = root.querySelector<HTMLButtonElement>('[data-randomize]')!;
  nameInput.value = draft.name === 'TEST CHARACTER 01' ? 'MY CHIBI' : draft.name;
  if (draft.name === 'TEST CHARACTER 01') {
    draft = { ...draft, name: 'MY CHIBI', updatedAt: Date.now() };
  }

  const saveDraft = async (): Promise<void> => {
    saveState.textContent = '保存中…';
    await store.saveCharacterDraft(draft);
    saveState.textContent = '端末へ保存済み';
  };

  const applyColor = (group: ColorGroup, value: string): void => {
    const tint = hexToNumber(value);
    for (const slot of group.slots) options.rig.setPartTint(slot, tint);
  };

  const setColor = async (group: ColorGroup, color: ColorOption): Promise<void> => {
    applyColor(group, color.value);
    draft = {
      ...draft,
      appearance: {
        ...draft.appearance,
        colors: {
          ...draft.appearance.colors,
          [group.key]: color.value,
        },
      },
      updatedAt: Date.now(),
    };
    await saveDraft();
    renderColorSelection(group.key);
  };

  const renderColorSelection = (key: ColorKey): void => {
    const selected = draft.appearance.colors[key] ?? '#ffffff';
    for (const button of colorsHost.querySelectorAll<HTMLButtonElement>(`[data-color-key="${key}"]`)) {
      const active = button.dataset.colorValue === selected;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  };

  const renderBundleSelection = (category: CatalogCategory): void => {
    const selected = draft.appearance.parts[category] ?? '';
    for (const button of root.querySelectorAll<HTMLButtonElement>(`[data-bundle-category="${category}"]`)) {
      const active = button.dataset.bundleId === selected;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  };

  const selectBundle = async (category: CatalogCategory, bundle: CatalogBundle): Promise<void> => {
    if (busy) return;
    busy = true;
    saveState.textContent = 'パーツを変更中…';
    try {
      await applyCatalogBundle(options.rig, bundle, entitlements);
      draft = applyBundleToDraft(draft, category, bundle);
      await saveDraft();
      renderBundleSelection(category);
    } catch (error) {
      console.error(error);
      saveState.textContent = error instanceof Error ? error.message : '変更できませんでした';
    } finally {
      busy = false;
    }
  };

  const quickBundles = new Map<CatalogCategory, CatalogBundle[]>();
  for (const group of QUICK_STYLE_GROUPS) {
    const bundles = catalog.bundles.filter(
      (bundle) => bundle.category === group.category && canUseBundle(bundle, entitlements),
    );
    quickBundles.set(group.category, bundles);

    const section = document.createElement('section');
    section.className = 'creator-style-group';
    section.innerHTML = `<h4>${group.label}</h4><div class="creator-style-buttons"></div>`;
    const host = section.querySelector<HTMLDivElement>('.creator-style-buttons')!;

    for (const bundle of bundles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'creator-style-button';
      button.dataset.bundleCategory = group.category;
      button.dataset.bundleId = bundle.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<strong>${escapeHtml(bundle.name)}</strong><small>${escapeHtml(styleHint(bundle))}</small>`;
      button.addEventListener('click', () => void selectBundle(group.category, bundle));
      host.appendChild(button);
    }

    styleGroupsHost.appendChild(section);
  }

  for (const group of COLOR_GROUPS) {
    const current = draft.appearance.colors[group.key] ?? '#ffffff';
    applyColor(group, current);

    const section = document.createElement('section');
    section.className = 'creator-color-group';
    section.innerHTML = `<h4>${group.label}</h4><div class="creator-swatches"></div>`;
    const swatches = section.querySelector<HTMLDivElement>('.creator-swatches')!;

    for (const color of group.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `creator-swatch${current === color.value ? ' is-selected' : ''}`;
      button.dataset.colorKey = group.key;
      button.dataset.colorValue = color.value;
      button.setAttribute('aria-label', `${group.label}: ${color.label}`);
      button.setAttribute('aria-pressed', current === color.value ? 'true' : 'false');
      button.innerHTML = `<span style="--swatch:${color.value}"></span><small>${color.label}</small>`;
      button.addEventListener('click', () => {
        if (busy) return;
        void setColor(group, color);
      });
      swatches.appendChild(button);
    }

    colorsHost.appendChild(section);
  }

  nameInput.addEventListener('change', () => {
    draft = { ...draft, name: nameInput.value.trim() || 'MY CHIBI', updatedAt: Date.now() };
    void saveDraft();
  });

  const renderCategory = (category: CatalogCategory): void => {
    const section = document.createElement('section');
    section.className = 'creator-category';
    const bundles = catalog.bundles.filter((bundle) => bundle.category === category);
    section.innerHTML = `<h3>${CATEGORY_LABELS[category]}</h3><div class="creator-bundle-grid"></div>`;
    const grid = section.querySelector<HTMLDivElement>('.creator-bundle-grid')!;

    for (const bundle of bundles) grid.appendChild(makeBundleButton(category, bundle));
    categoriesHost.appendChild(section);
  };

  const makeBundleButton = (category: CatalogCategory, bundle: CatalogBundle): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    const owned = bundle.isFree || (entitlements?.packIds.includes(bundle.packId) ?? false);
    button.className = `creator-bundle${owned ? '' : ' is-locked'}`;
    button.dataset.bundleCategory = category;
    button.dataset.bundleId = bundle.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `
      <span>${escapeHtml(bundle.name)}</span>
      <small>${owned ? (bundle.isFree ? 'FREE' : 'OWNED') : 'LOCKED'}</small>
      <em>${escapeHtml(bundle.description)}</em>
    `;
    button.disabled = !owned;
    button.addEventListener('click', () => void selectBundle(category, bundle));
    return button;
  };

  for (const category of categories) renderCategory(category);
  for (const category of categories) renderBundleSelection(category);

  randomizeButton.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    randomizeButton.disabled = true;
    saveState.textContent = 'おまかせ作成中…';
    try {
      for (const group of QUICK_STYLE_GROUPS) {
        const bundles = quickBundles.get(group.category) ?? [];
        if (bundles.length === 0) continue;
        const bundle = bundles[Math.floor(Math.random() * bundles.length)];
        await applyCatalogBundle(options.rig, bundle, entitlements);
        draft = applyBundleToDraft(draft, group.category, bundle);
        renderBundleSelection(group.category);
      }

      for (const group of COLOR_GROUPS) {
        const color = group.options[Math.floor(Math.random() * group.options.length)];
        applyColor(group, color.value);
        draft = {
          ...draft,
          appearance: {
            ...draft.appearance,
            colors: { ...draft.appearance.colors, [group.key]: color.value },
          },
          updatedAt: Date.now(),
        };
        renderColorSelection(group.key);
      }
      await saveDraft();
    } finally {
      busy = false;
      randomizeButton.disabled = false;
    }
  });

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

  await saveDraft();
  return () => {
    appShell?.classList.remove('is-creator-mode');
    root.remove();
  };
}

function styleHint(bundle: CatalogBundle): string {
  if (bundle.tags.includes('long')) return 'LONG';
  if (bundle.tags.includes('medium')) return 'MID';
  if (bundle.tags.includes('bob')) return 'SHORT';
  if (bundle.tags.includes('sharp')) return 'COOL';
  if (bundle.tags.includes('round')) return 'ROUND';
  if (bundle.tags.includes('heart')) return 'CUTE';
  if (bundle.tags.includes('star')) return 'COOL';
  if (bundle.tags.includes('none')) return 'OFF';
  if (bundle.tags.includes('idol')) return 'IDOL';
  return 'STYLE';
}

function hexToNumber(value: string): number {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 0xffffff;
  return Number.parseInt(normalized, 16);
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
