import './room.css';
import { DraftStore } from '../data/DraftStore';
import { createEmptyCharacterDraft, type CharacterDraft } from '../data/models';
import { RoomCatalogService } from './RoomCatalogService';
import { RoomRenderer } from './RoomRenderer';
import type { FurnitureDefinition, RoomCatalog } from './types';

export async function mountRoomEditor(options: {
  renderer: RoomRenderer;
  catalog?: RoomCatalogService;
  store?: DraftStore;
}): Promise<() => void> {
  const catalogService = options.catalog ?? new RoomCatalogService();
  const store = options.store ?? new DraftStore();
  const catalog = await catalogService.load();
  options.renderer.setCatalog(catalog);

  let draft: CharacterDraft = (await store.loadCharacterDraft()) ?? createEmptyCharacterDraft();
  if (!catalog.themes.some((theme) => theme.id === draft.room.themeId)) {
    draft = { ...draft, room: { ...draft.room, themeId: catalog.themes[0]?.id ?? 'room.default' } };
  }
  let selectedFurnitureId = draft.room.furniture[0]?.id ?? catalog.furniture[0]?.id ?? '';
  let saveTimer: number | null = null;

  if (draft.room.furniture.length === 0) {
    const rug = catalog.furniture.find((item) => item.kind === 'rug');
    if (rug) {
      draft = {
        ...draft,
        room: {
          ...draft.room,
          furniture: [{ id: rug.id, x: rug.defaultX, y: rug.defaultY, scale: rug.defaultScale }],
        },
      };
    }
  }

  options.renderer.render(draft.room);

  const root = document.createElement('section');
  root.className = 'room-lab';
  root.innerHTML = `
    <div class="room-head">
      <div>
        <p class="eyebrow">PHASE 2 / LIVE SPACE</p>
        <h2>MY ROOM</h2>
      </div>
      <span class="badge">CLIENT SIDE</span>
    </div>
    <div class="room-editor-grid">
      <div class="room-panel">
        <label class="room-field">ROOM THEME<select data-theme></select></label>
        <div class="room-section">
          <div class="room-section-title"><strong>FURNITURE</strong><span>タップで追加 / 削除</span></div>
          <div class="room-furniture-grid" data-furniture></div>
        </div>
        <div class="room-section room-position" data-position>
          <div class="room-section-title"><strong>POSITION</strong><span data-selected-name>選択なし</span></div>
          <label>X<input type="range" min="70" max="954" step="1" data-x /></label>
          <label>Y<input type="range" min="420" max="930" step="1" data-y /></label>
          <label>SCALE<input type="range" min="0.5" max="1.5" step="0.05" data-scale /></label>
        </div>
        <p class="room-save-state" data-save-state>IndexedDBへ保存</p>
      </div>
      <div class="room-note">
        <strong>MY ROOM FOUNDATION</strong>
        <p>背景・家具はPixiJSで端末内描画。配置変更は下書きとしてIndexedDBへ保存し、明示的な本番保存時だけD1へ送る設計です。</p>
      </div>
    </div>
  `;

  document.querySelector('.app-shell')?.appendChild(root);

  const themeSelect = root.querySelector<HTMLSelectElement>('[data-theme]')!;
  const furnitureHost = root.querySelector<HTMLDivElement>('[data-furniture]')!;
  const selectedName = root.querySelector<HTMLElement>('[data-selected-name]')!;
  const xInput = root.querySelector<HTMLInputElement>('[data-x]')!;
  const yInput = root.querySelector<HTMLInputElement>('[data-y]')!;
  const scaleInput = root.querySelector<HTMLInputElement>('[data-scale]')!;
  const saveState = root.querySelector<HTMLElement>('[data-save-state]')!;

  for (const theme of catalog.themes) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  }
  themeSelect.value = draft.room.themeId;

  const placed = (id: string) => draft.room.furniture.find((item) => item.id === id);
  const definition = (id: string) => catalog.furniture.find((item) => item.id === id);

  const queueSave = (): void => {
    saveState.textContent = '保存中…';
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      draft = { ...draft, updatedAt: Date.now() };
      await store.saveCharacterDraft(draft);
      saveState.textContent = 'IndexedDBへ保存済み';
      saveTimer = null;
    }, 320);
  };

  const rerender = (): void => {
    options.renderer.render(draft.room);
    queueSave();
  };

  const refreshPosition = (): void => {
    const item = placed(selectedFurnitureId);
    const def = definition(selectedFurnitureId);
    const disabled = !item;
    xInput.disabled = disabled;
    yInput.disabled = disabled;
    scaleInput.disabled = disabled;
    selectedName.textContent = item && def ? def.name : '家具を追加して選択';
    if (!item) return;
    xInput.value = String(item.x);
    yInput.value = String(item.y);
    scaleInput.value = String(item.scale);
  };

  const refreshFurnitureButtons = (): void => {
    furnitureHost.replaceChildren();
    for (const def of catalog.furniture) {
      const item = placed(def.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `room-furniture${item ? ' is-placed' : ''}${selectedFurnitureId === def.id ? ' is-selected' : ''}`;
      button.innerHTML = `<span>${escapeHtml(def.name)}</span><small>${item ? 'IN ROOM' : 'ADD'}</small>`;
      button.addEventListener('click', () => toggleFurniture(def, Boolean(item)));
      furnitureHost.appendChild(button);
    }
    refreshPosition();
  };

  const toggleFurniture = (def: FurnitureDefinition, isPlaced: boolean): void => {
    selectedFurnitureId = def.id;
    if (isPlaced) {
      draft = {
        ...draft,
        room: { ...draft.room, furniture: draft.room.furniture.filter((item) => item.id !== def.id) },
      };
    } else {
      draft = {
        ...draft,
        room: {
          ...draft.room,
          furniture: [
            ...draft.room.furniture,
            { id: def.id, x: def.defaultX, y: def.defaultY, scale: def.defaultScale },
          ],
        },
      };
    }
    rerender();
    refreshFurnitureButtons();
  };

  const updatePlaced = (patch: Partial<{ x: number; y: number; scale: number }>): void => {
    const current = placed(selectedFurnitureId);
    if (!current) return;
    draft = {
      ...draft,
      room: {
        ...draft.room,
        furniture: draft.room.furniture.map((item) => item.id === current.id ? { ...item, ...patch } : item),
      },
    };
    rerender();
  };

  themeSelect.addEventListener('change', () => {
    draft = { ...draft, room: { ...draft.room, themeId: themeSelect.value } };
    rerender();
  });
  xInput.addEventListener('input', () => updatePlaced({ x: Number(xInput.value) }));
  yInput.addEventListener('input', () => updatePlaced({ y: Number(yInput.value) }));
  scaleInput.addEventListener('input', () => updatePlaced({ scale: Number(scaleInput.value) }));

  refreshFurnitureButtons();

  return () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    root.remove();
  };
}

export function defaultRoomState(catalog: RoomCatalog): CharacterDraft['room'] {
  return {
    themeId: catalog.themes[0]?.id ?? 'room.default',
    furniture: catalog.furniture
      .filter((item) => item.kind === 'rug')
      .slice(0, 1)
      .map((item) => ({ id: item.id, x: item.defaultX, y: item.defaultY, scale: item.defaultScale })),
  };
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
