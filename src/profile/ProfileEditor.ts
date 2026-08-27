import './profile.css';
import { DraftStore } from '../data/DraftStore';
import { createEmptyProfileDraft, type OshiProfileDraft, type Visibility } from '../data/models';
import { canvasToPngBlob, renderProfileCard } from '../share/ProfileCardRenderer';
import { shareFileOrDownload } from '../share/share';

type EditorOptions = {
  characterCanvas: HTMLCanvasElement | null;
  store?: DraftStore;
};

const FIELD_DEFS: Array<{
  key: keyof OshiProfileDraft;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
}> = [
  { key: 'displayName', label: 'NAME' },
  { key: 'oshiName', label: 'MY OSHI' },
  { key: 'oshiSince', label: '推し歴' },
  { key: 'favoriteSong', label: '好きな曲' },
  { key: 'favoritePoint', label: '好きなところ', type: 'textarea' },
  { key: 'doufanStance', label: '同担スタンス' },
  { key: 'participationHistory', label: '参戦歴', type: 'textarea' },
  { key: 'favoriteOutfit', label: '好きな衣装' },
  { key: 'message', label: '一言', type: 'textarea' },
  { key: 'bio', label: '自己紹介', type: 'textarea' },
  {
    key: 'themeId',
    label: 'THEME',
    type: 'select',
    options: [
      { value: 'simple', label: 'SIMPLE' },
      { value: 'y2k', label: 'Y2K' },
      { value: 'heisei', label: 'HEISEI' },
      { value: 'street', label: 'STREET' },
    ],
  },
  {
    key: 'visibility',
    label: '公開範囲',
    type: 'select',
    options: [
      { value: 'private', label: '非公開' },
      { value: 'unlisted', label: 'URLを知っている人のみ' },
      { value: 'public', label: '公開' },
    ],
  },
];

export async function mountProfileEditor(options: EditorOptions): Promise<() => void> {
  const store = options.store ?? new DraftStore();
  let draft = (await store.loadProfileDraft()) ?? createEmptyProfileDraft();
  let saveTimer: number | null = null;
  let latestCard: HTMLCanvasElement | null = null;

  const root = document.createElement('section');
  root.className = 'profile-lab';
  root.innerHTML = `
    <div class="profile-lab-head">
      <div>
        <p class="eyebrow">PHASE 2 / SHARE PROTOTYPE</p>
        <h2>OSHI PROFILE</h2>
      </div>
      <span class="badge">LOCAL DRAFT</span>
    </div>
    <div class="profile-lab-grid">
      <form class="profile-form" data-profile-form></form>
      <div class="profile-preview-wrap">
        <div class="profile-preview-empty" data-empty>プロフィールを入力すると共有カードを確認できます。</div>
        <div class="profile-preview" data-preview></div>
        <div class="profile-actions">
          <button type="button" data-preview-button>カードを更新</button>
          <button type="button" data-share-button>共有 / 保存</button>
        </div>
        <p class="profile-save-state" data-save-state>IndexedDBへ自動保存</p>
      </div>
    </div>
  `;

  document.querySelector('.app-shell')?.appendChild(root);

  const form = root.querySelector<HTMLFormElement>('[data-profile-form]')!;
  const preview = root.querySelector<HTMLDivElement>('[data-preview]')!;
  const empty = root.querySelector<HTMLDivElement>('[data-empty]')!;
  const previewButton = root.querySelector<HTMLButtonElement>('[data-preview-button]')!;
  const shareButton = root.querySelector<HTMLButtonElement>('[data-share-button]')!;
  const saveState = root.querySelector<HTMLElement>('[data-save-state]')!;

  const applyField = (key: keyof OshiProfileDraft, value: string): void => {
    if (key === 'visibility') {
      draft = { ...draft, visibility: value as Visibility };
      return;
    }
    if (key === 'schemaVersion' || key === 'updatedAt') return;
    draft = { ...draft, [key]: value };
  };

  const queueSave = (): void => {
    saveState.textContent = '保存中…';
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      await store.saveProfileDraft(draft);
      saveState.textContent = 'IndexedDBへ保存済み';
      saveTimer = null;
    }, 350);
  };

  for (const def of FIELD_DEFS) {
    const label = document.createElement('label');
    label.textContent = def.label;
    let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    if (def.type === 'textarea') {
      control = document.createElement('textarea');
      control.rows = 3;
    } else if (def.type === 'select') {
      const select = document.createElement('select');
      for (const optionDef of def.options ?? []) {
        const option = document.createElement('option');
        option.value = optionDef.value;
        option.textContent = optionDef.label;
        select.appendChild(option);
      }
      control = select;
    } else {
      control = document.createElement('input');
      control.type = 'text';
    }

    control.name = String(def.key);
    control.value = String(draft[def.key] ?? '');
    control.addEventListener('input', () => {
      applyField(def.key, control.value);
      queueSave();
    });
    label.appendChild(control);
    form.appendChild(label);
  }

  const updatePreview = (): HTMLCanvasElement => {
    latestCard = renderProfileCard(draft, options.characterCanvas, { themeId: draft.themeId });
    latestCard.className = 'profile-card-canvas';
    preview.replaceChildren(latestCard);
    empty.hidden = true;
    return latestCard;
  };

  previewButton.addEventListener('click', () => {
    updatePreview();
  });

  shareButton.addEventListener('click', async () => {
    const card = latestCard ?? updatePreview();
    const blob = await canvasToPngBlob(card);
    const result = await shareFileOrDownload({
      blob,
      filename: 'chibi-life-oshi-profile.png',
      title: 'OSHI PROFILE',
      text: draft.oshiName ? `${draft.oshiName} 推しプロフィール` : '推しプロフィール',
    });
    saveState.textContent = result === 'shared' ? '共有しました' : '画像を保存しました';
  });

  return () => {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    root.remove();
  };
}
