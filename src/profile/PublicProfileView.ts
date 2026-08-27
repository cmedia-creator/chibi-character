import './public-profile.css';
import { DraftStore } from '../data/DraftStore';
import { createEmptyProfileDraft } from '../data/models';

export async function mountPublicProfilePreview(options: {
  characterCanvas: HTMLCanvasElement;
  store?: DraftStore;
}): Promise<() => void> {
  const store = options.store ?? new DraftStore();
  const profile = (await store.loadProfileDraft()) ?? createEmptyProfileDraft();

  const root = document.createElement('section');
  root.className = `public-profile public-profile--${profile.themeId}`;
  root.innerHTML = `
    <div class="public-profile-badge">PUBLIC PROFILE PREVIEW</div>
    <div class="public-profile-hero">
      <div class="public-profile-character" data-character></div>
      <div class="public-profile-main">
        <p class="public-profile-kicker">OSHI PROFILE</p>
        <h2>${escapeHtml(profile.displayName || 'MY PROFILE')}</h2>
        <div class="public-profile-oshi">
          <span>MY OSHI</span>
          <strong>${escapeHtml(profile.oshiName || '—')}</strong>
        </div>
        <p>${escapeHtml(profile.message || '推し活をもっと楽しく。')}</p>
      </div>
    </div>
    <div class="public-profile-grid">
      ${field('推し歴', profile.oshiSince)}
      ${field('好きな曲', profile.favoriteSong)}
      ${field('好きなところ', profile.favoritePoint)}
      ${field('同担スタンス', profile.doufanStance)}
      ${field('参戦歴', profile.participationHistory)}
      ${field('好きな衣装', profile.favoriteOutfit)}
    </div>
    <div class="public-profile-bio">
      <span>ABOUT ME</span>
      <p>${escapeHtml(profile.bio || 'まだ自己紹介はありません。')}</p>
    </div>
    <div class="public-profile-cta">
      <div>
        <strong>自分だけの動くちびキャラを作ろう</strong>
        <span>K-POPアイドル風のオリジナルちびキャラ</span>
      </div>
      <a href="/?creator=1">私も作る</a>
    </div>
  `;

  const shell = document.querySelector('.app-shell');
  shell?.appendChild(root);

  const characterHost = root.querySelector<HTMLDivElement>('[data-character]')!;
  const preview = document.createElement('canvas');
  preview.width = options.characterCanvas.width;
  preview.height = options.characterCanvas.height;
  const ctx = preview.getContext('2d');
  ctx?.drawImage(options.characterCanvas, 0, 0);
  preview.className = 'public-profile-character-canvas';
  characterHost.appendChild(preview);

  return () => root.remove();
}

function field(label: string, value: string): string {
  return `
    <div class="public-profile-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '—')}</strong>
    </div>
  `;
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
