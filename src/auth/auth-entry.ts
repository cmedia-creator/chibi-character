import { mountAuthPanel } from './AuthPanel';

const params = new URLSearchParams(window.location.search);
let unmount: (() => void) | null = null;

if (params.has('auth')) {
  try {
    unmount = await mountAuthPanel();
  } catch (error) {
    console.error('Auth panel could not be mounted.', error);
    const root = document.createElement('section');
    root.className = 'auth-panel';
    root.innerHTML = `<p class="auth-panel__result">認証パネルの起動に失敗しました。${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p>`;
    document.querySelector('.app-shell')?.appendChild(root);
  }
}

window.addEventListener('beforeunload', () => unmount?.());

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char] ?? char));
}
