import './creator.css';
import { CatalogService } from '../catalog/CatalogService';
import type { CatalogBundle, CatalogCategory } from '../catalog/types';
import { DraftStore } from '../data/DraftStore';
import { createEmptyCharacterDraft, type CharacterDraft } from '../data/models';
import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import { applyBundleToDraft, applyCatalogBundle } from './CreatorConfigurator';

const EDITABLE_CATEGORIES: Array<{ category: CatalogCategory; label: string; hint: string }> = [
  { category: 'hair', label: 'HAIR', hint: '髪型' },
  { category: 'outfit', label: 'OUTFIT', hint: '衣装' },
];

export async function mountProductionCreator(options: {
  rig: AtlasCharacterRig;
  store?: DraftStore;
}): Promise<() => void> {
  const catalog = await new CatalogService('/data/catalog/rami-v1.json').load();
  const store = options.store ?? new DraftStore();
  let draft: CharacterDraft = (await store.loadCharacterDraft()) ?? createEmptyCharacterDraft();
  let busy = false;

  for (const group of EDITABLE_CATEGORIES) {
    const bundles = catalog.bundles.filter((bundle) => bundle.category === group.category);
    const selected = draft.appearance.parts[group.category];
    const bundle = bundles.find((item) => item.id === selected) ?? bundles[0];
    if (!bundle) continue;
    await applyCatalogBundle(options.rig, bundle, null);
    draft = applyBundleToDraft(draft, group.category, bundle);
  }

  if (draft.name === 'TEST CHARACTER 01' || draft.name === 'MY CHARACTER') {
    draft = { ...draft, name: 'RAMI CHIBI', updatedAt: Date.now() };
  }
  await store.saveCharacterDraft(draft);

  const appShell = document.querySelector<HTMLElement>('.app-shell');
  const controls = document.querySelector<HTMLElement>('.controls');
  appShell?.classList.add('is-creator-mode');

  const root = document.createElement('section');
  root.className = 'creator-lab creator-lab-compact';
  root.innerHTML = `
    <div class="creator-quick-head">
      <div>
        <p class="eyebrow">RAMI V1 / PRIVATE TIKTOK TOOL</p>
        <h2>STYLE</h2>
      </div>
      <span class="badge">FACE + BODY FIXED</span>
    </div>
    <p class="creator-save-line">顔と体は固定。髪型と衣装だけを差し替えます。</p>
    <div class="creator-style-groups" data-production-groups></div>
    <div class="creator-save-line" data-production-save>端末へ保存済み</div>
  `;

  if (controls) controls.after(root);
  else appShell?.appendChild(root);

  const groupsHost = root.querySelector<HTMLDivElement>('[data-production-groups]')!;
  const saveState = root.querySelector<HTMLElement>('[data-production-save]')!;

  const renderSelection = (category: CatalogCategory): void => {
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
    saveState.textContent = '変更中…';
    try {
      await applyCatalogBundle(options.rig, bundle, null);
      draft = applyBundleToDraft(draft, category, bundle);
      await store.saveCharacterDraft(draft);
      renderSelection(category);
      saveState.textContent = '端末へ保存済み';
    } catch (error) {
      console.error(error);
      saveState.textContent = '変更できませんでした';
    } finally {
      busy = false;
    }
  };

  for (const group of EDITABLE_CATEGORIES) {
    const section = document.createElement('section');
    section.className = 'creator-style-group';
    section.innerHTML = `<h4>${group.label}</h4><div class="creator-style-buttons"></div>`;
    const host = section.querySelector<HTMLDivElement>('.creator-style-buttons')!;
    const bundles = catalog.bundles.filter((bundle) => bundle.category === group.category);

    for (const bundle of bundles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'creator-style-button';
      button.dataset.bundleCategory = group.category;
      button.dataset.bundleId = bundle.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<strong>${escapeHtml(bundle.name)}</strong><small>${group.hint}</small>`;
      button.addEventListener('click', () => void selectBundle(group.category, bundle));
      host.appendChild(button);
    }

    groupsHost.appendChild(section);
    renderSelection(group.category);
  }

  return () => {
    appShell?.classList.remove('is-creator-mode');
    root.remove();
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[char] ?? char);
}
