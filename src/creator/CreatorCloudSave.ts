import './creator-cloud-save.css';
import { ApiClient } from '../api/ApiClient';
import type { SavedCharacter } from '../api/contracts';
import { SyncService } from '../data/SyncService';

export async function mountCreatorCloudSave(): Promise<() => void> {
  const api = new ApiClient();
  const sync = new SyncService();

  const root = document.createElement('section');
  root.className = 'creator-cloud-save';
  root.innerHTML = `
    <div class="creator-cloud-save__copy">
      <p class="eyebrow">CLOUD SAVE</p>
      <strong data-cloud-title>ログイン状態を確認中…</strong>
      <span data-cloud-status>編集内容は端末には自動保存されています。</span>
    </div>
    <button type="button" data-cloud-save disabled>確認中…</button>
  `;

  const controls = document.querySelector<HTMLElement>('.controls');
  if (controls) controls.after(root);
  else document.querySelector('.app-shell')?.appendChild(root);

  const title = root.querySelector<HTMLElement>('[data-cloud-title]')!;
  const status = root.querySelector<HTMLElement>('[data-cloud-status]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-cloud-save]')!;
  let busy = false;
  let authenticated = false;

  const publishCharacterSource = (character: SavedCharacter): void => {
    window.dispatchEvent(new CustomEvent('chibi:character-source', {
      detail: {
        id: character.id,
        name: character.name,
        updatedAt: character.updatedAt,
        source: 'saved',
      },
    }));
  };

  const render = (): void => {
    if (!authenticated) {
      title.textContent = 'クラウド保存はログイン後に利用できます';
      status.textContent = 'いまの編集内容はこの端末には残っています。';
      button.textContent = '未ログイン';
      button.disabled = true;
      return;
    }

    title.textContent = 'この見た目をD1へ保存';
    status.textContent = '同じキャラ1体を更新保存します。';
    button.textContent = busy ? '保存中…' : 'この見た目を保存';
    button.disabled = busy;
  };

  try {
    const me = await api.getMe();
    authenticated = me.authenticated;
    render();
  } catch (error) {
    console.error('Creator cloud save session check failed.', error);
    authenticated = false;
    title.textContent = 'クラウド保存の確認に失敗しました';
    status.textContent = error instanceof Error ? error.message : 'API error';
    button.textContent = '利用不可';
    button.disabled = true;
  }

  button.addEventListener('click', async () => {
    if (busy || !authenticated) return;
    busy = true;
    render();
    try {
      const saved = await sync.saveCharacter();
      publishCharacterSource(saved);
      title.textContent = '保存しました';
      status.textContent = `character ${saved.id.slice(0, 8)}… / D1更新済み`;
    } catch (error) {
      console.error('Creator cloud save failed.', error);
      title.textContent = '保存に失敗しました';
      status.textContent = error instanceof Error ? error.message : '保存処理に失敗しました。';
    } finally {
      busy = false;
      button.textContent = 'この見た目を保存';
      button.disabled = false;
    }
  });

  return () => root.remove();
}
