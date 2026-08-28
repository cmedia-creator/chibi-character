import './auth-panel.css';
import { ApiClient } from '../api/ApiClient';
import { SyncService } from '../data/SyncService';
import { AuthApiClient } from './AuthApiClient';
import { createPasskey, getPasskey, isPasskeyAvailable } from './WebAuthnClient';

const TURNSTILE_SITE_KEY = '0x4AAAAAAEePSvgyVDcPtBaY';
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action?: string;
    theme?: 'auto' | 'light' | 'dark';
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
  }): string;
  reset(widgetId?: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export async function mountAuthPanel(): Promise<() => void> {
  const authApi = new AuthApiClient();
  const api = new ApiClient();
  const sync = new SyncService();
  let turnstileToken = '';
  let widgetId = '';
  let busy = false;

  const root = document.createElement('section');
  root.className = 'auth-panel';
  root.innerHTML = `
    <div class="auth-panel__head">
      <div>
        <p class="eyebrow">ACCOUNT / PASSKEY TEST</p>
        <h2>このキャラを保存する</h2>
      </div>
      <span class="badge" data-auth-badge>CHECKING</span>
    </div>
    <p class="auth-panel__status" data-auth-status>ログイン状態を確認中…</p>
    <div class="auth-panel__turnstile" data-turnstile></div>
    <div class="auth-panel__actions">
      <button type="button" data-register disabled>この端末にPasskeyを登録</button>
      <button type="button" data-login data-kind="secondary">Passkeyでログイン</button>
      <button type="button" data-save disabled>キャラをD1へ保存</button>
      <button type="button" data-logout data-kind="secondary" disabled>ログアウト</button>
    </div>
    <div class="auth-panel__result" data-result>未実行</div>
    <p class="auth-panel__note">通常の瞬き・移動・自律行動ではDB通信しません。保存ボタンを押した時だけD1へ送信します。</p>
  `;
  document.querySelector('.app-shell')?.appendChild(root);

  const badge = root.querySelector<HTMLElement>('[data-auth-badge]')!;
  const status = root.querySelector<HTMLElement>('[data-auth-status]')!;
  const result = root.querySelector<HTMLElement>('[data-result]')!;
  const turnstileHost = root.querySelector<HTMLElement>('[data-turnstile]')!;
  const registerButton = root.querySelector<HTMLButtonElement>('[data-register]')!;
  const loginButton = root.querySelector<HTMLButtonElement>('[data-login]')!;
  const saveButton = root.querySelector<HTMLButtonElement>('[data-save]')!;
  const logoutButton = root.querySelector<HTMLButtonElement>('[data-logout]')!;

  const setBusy = (value: boolean): void => {
    busy = value;
    registerButton.disabled = value || !turnstileToken || !isPasskeyAvailable();
    loginButton.disabled = value || !isPasskeyAvailable();
    saveButton.disabled = value || badge.dataset.authenticated !== 'true';
    logoutButton.disabled = value || badge.dataset.authenticated !== 'true';
  };

  const resetTurnstile = (): void => {
    turnstileToken = '';
    if (widgetId) window.turnstile?.reset(widgetId);
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const me = await api.getMe();
      badge.dataset.authenticated = me.authenticated ? 'true' : 'false';
      badge.textContent = me.authenticated ? 'SIGNED IN' : 'GUEST';
      status.textContent = me.authenticated
        ? `ログイン済み / user ${me.userId.slice(0, 8)}…`
        : '未ログイン。新規登録かPasskeyログインを実行してください。';
    } catch (error) {
      badge.dataset.authenticated = 'false';
      badge.textContent = 'API ERROR';
      status.textContent = error instanceof Error ? error.message : 'ログイン状態を取得できませんでした。';
    }
    setBusy(false);
  };

  if (!isPasskeyAvailable()) {
    result.textContent = 'このブラウザはPasskey/WebAuthnに対応していません。';
    registerButton.disabled = true;
    loginButton.disabled = true;
  } else {
    await loadTurnstile();
    if (!window.turnstile) throw new Error('Turnstile could not be loaded.');
    widgetId = window.turnstile.render(turnstileHost, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'passkey-register',
      theme: 'dark',
      callback: (token) => {
        turnstileToken = token;
        result.textContent = '人間確認OK。Passkey登録を開始できます。';
        setBusy(false);
      },
      'expired-callback': () => {
        turnstileToken = '';
        result.textContent = 'Turnstileの確認期限が切れました。再確認してください。';
        setBusy(false);
      },
      'error-callback': () => {
        turnstileToken = '';
        result.textContent = 'Turnstileの確認に失敗しました。';
        setBusy(false);
      },
    });
  }

  registerButton.addEventListener('click', async () => {
    if (busy || !turnstileToken) return;
    setBusy(true);
    result.textContent = '登録用challengeを取得中…';
    try {
      const start = await authApi.beginRegistration(turnstileToken);
      const credential = await createPasskey(start.options);
      const session = await authApi.finishRegistration(credential);
      result.textContent = `Passkey登録成功。session開始 / ${session.userId.slice(0, 8)}…`;
      await refreshSession();
    } catch (error) {
      console.error(error);
      result.textContent = error instanceof Error ? error.message : 'Passkey登録に失敗しました。';
    } finally {
      resetTurnstile();
      setBusy(false);
    }
  });

  loginButton.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    result.textContent = 'Passkeyログインを開始…';
    try {
      const start = await authApi.beginLogin();
      const credential = await getPasskey(start.options);
      const session = await authApi.finishLogin(credential);
      result.textContent = `ログイン成功 / ${session.userId.slice(0, 8)}…`;
      await refreshSession();
    } catch (error) {
      console.error(error);
      result.textContent = error instanceof Error ? error.message : 'ログインに失敗しました。';
      setBusy(false);
    }
  });

  saveButton.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    result.textContent = 'IndexedDBのキャラ下書きをD1へ保存中…';
    try {
      const saved = await sync.saveCharacter();
      result.textContent = `D1保存成功 / character ${saved.id.slice(0, 8)}…`;
    } catch (error) {
      console.error(error);
      result.textContent = error instanceof Error ? error.message : 'D1保存に失敗しました。';
    } finally {
      setBusy(false);
    }
  });

  logoutButton.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try {
      await authApi.logout();
      result.textContent = 'ログアウトしました。';
      await refreshSession();
    } catch (error) {
      console.error(error);
      result.textContent = error instanceof Error ? error.message : 'ログアウトに失敗しました。';
      setBusy(false);
    }
  });

  await refreshSession();
  return () => root.remove();
}

async function loadTurnstile(): Promise<void> {
  if (window.turnstile) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
  if (existing) {
    await waitForTurnstile();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Turnstile script could not be loaded.')), { once: true });
    document.head.appendChild(script);
  });
  await waitForTurnstile();
}

async function waitForTurnstile(): Promise<void> {
  const timeoutAt = Date.now() + 8000;
  while (!window.turnstile && Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!window.turnstile) throw new Error('Turnstile initialization timed out.');
}
