import './auth-panel.css';
import { ApiClient } from '../api/ApiClient';
import { SyncService } from '../data/SyncService';
import { PasswordAuthApiClient, PasswordAuthApiError } from './PasswordAuthApiClient';

const TURNSTILE_SITE_KEY = '0x4AAAAAAEePSvgyVDcPtBaY';
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type AuthMode = 'login' | 'register' | 'recover';

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
  const authApi = new PasswordAuthApiClient();
  const api = new ApiClient();
  const sync = new SyncService();
  let mode: AuthMode = 'login';
  let turnstileToken = '';
  let widgetId = '';
  let busy = false;
  let authenticated = false;

  const root = document.createElement('section');
  root.className = 'auth-panel';
  root.innerHTML = `
    <div class="auth-panel__head">
      <div>
        <p class="eyebrow">ACCOUNT / SAVE</p>
        <h2>このキャラを保存する</h2>
      </div>
      <span class="badge" data-auth-badge>CHECKING</span>
    </div>
    <p class="auth-panel__status" data-auth-status>ログイン状態を確認中…</p>

    <div class="auth-panel__guest" data-guest>
      <div class="auth-panel__tabs" role="tablist" aria-label="アカウント操作">
        <button type="button" data-mode="login" class="is-active">ログイン</button>
        <button type="button" data-mode="register" data-kind="secondary">新規登録</button>
        <button type="button" data-mode="recover" data-kind="secondary">復旧</button>
      </div>

      <div class="auth-panel__form">
        <label>
          <span>ユーザーID</span>
          <input type="text" data-login-id minlength="4" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="例: chibi1234" />
        </label>
        <label data-password-row>
          <span data-password-label>パスワード</span>
          <input type="password" data-password minlength="8" maxlength="128" autocomplete="current-password" placeholder="8文字以上" />
        </label>
        <label data-confirm-row hidden>
          <span>パスワード確認</span>
          <input type="password" data-confirm-password minlength="8" maxlength="128" autocomplete="new-password" placeholder="もう一度入力" />
        </label>
        <label data-recovery-row hidden>
          <span>復旧コード</span>
          <input type="text" data-recovery-code maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />
        </label>
      </div>

      <div class="auth-panel__turnstile" data-turnstile></div>
      <button type="button" class="auth-panel__primary" data-submit disabled>ログイン</button>
    </div>

    <div class="auth-panel__recovery-output" data-recovery-output hidden>
      <p class="eyebrow">RECOVERY CODE</p>
      <strong>この復旧コードを保存してください</strong>
      <code data-recovery-value></code>
      <button type="button" data-copy-code data-kind="secondary">復旧コードをコピー</button>
      <p>パスワードを忘れた時に必要です。このコード自体はサーバーに平文保存しません。</p>
    </div>

    <div class="auth-panel__member" data-member hidden>
      <button type="button" data-save>キャラをD1へ保存</button>
      <button type="button" data-logout data-kind="secondary">ログアウト</button>
    </div>

    <div class="auth-panel__result" data-result>未実行</div>
    <p class="auth-panel__note">キャラ作成や自律行動は端末内で処理します。D1へ書き込むのは、アカウント操作と明示的な保存操作だけです。</p>
  `;
  document.querySelector('.app-shell')?.appendChild(root);

  const badge = root.querySelector<HTMLElement>('[data-auth-badge]')!;
  const status = root.querySelector<HTMLElement>('[data-auth-status]')!;
  const result = root.querySelector<HTMLElement>('[data-result]')!;
  const guest = root.querySelector<HTMLElement>('[data-guest]')!;
  const member = root.querySelector<HTMLElement>('[data-member]')!;
  const turnstileHost = root.querySelector<HTMLElement>('[data-turnstile]')!;
  const loginIdInput = root.querySelector<HTMLInputElement>('[data-login-id]')!;
  const passwordInput = root.querySelector<HTMLInputElement>('[data-password]')!;
  const passwordLabel = root.querySelector<HTMLElement>('[data-password-label]')!;
  const confirmRow = root.querySelector<HTMLElement>('[data-confirm-row]')!;
  const confirmPasswordInput = root.querySelector<HTMLInputElement>('[data-confirm-password]')!;
  const recoveryRow = root.querySelector<HTMLElement>('[data-recovery-row]')!;
  const recoveryCodeInput = root.querySelector<HTMLInputElement>('[data-recovery-code]')!;
  const submitButton = root.querySelector<HTMLButtonElement>('[data-submit]')!;
  const saveButton = root.querySelector<HTMLButtonElement>('[data-save]')!;
  const logoutButton = root.querySelector<HTMLButtonElement>('[data-logout]')!;
  const recoveryOutput = root.querySelector<HTMLElement>('[data-recovery-output]')!;
  const recoveryValue = root.querySelector<HTMLElement>('[data-recovery-value]')!;
  const copyCodeButton = root.querySelector<HTMLButtonElement>('[data-copy-code]')!;
  const modeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];

  const updateControls = (): void => {
    submitButton.disabled = busy || authenticated || !turnstileToken;
    saveButton.disabled = busy || !authenticated;
    logoutButton.disabled = busy || !authenticated;
    for (const button of modeButtons) button.disabled = busy || authenticated;
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    updateControls();
  };

  const resetTurnstile = (): void => {
    turnstileToken = '';
    if (widgetId) window.turnstile?.reset(widgetId);
    updateControls();
  };

  const applyMode = (nextMode: AuthMode): void => {
    mode = nextMode;
    for (const button of modeButtons) {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-active', active);
      button.dataset.kind = active ? '' : 'secondary';
    }

    const registering = mode === 'register';
    const recovering = mode === 'recover';
    confirmRow.hidden = !registering && !recovering;
    recoveryRow.hidden = !recovering;
    passwordLabel.textContent = recovering ? '新しいパスワード' : 'パスワード';
    passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    submitButton.textContent = mode === 'login'
      ? 'ログイン'
      : mode === 'register'
        ? 'このIDでアカウントを作る'
        : 'パスワードを再設定';
    result.textContent = mode === 'login'
      ? 'ユーザーIDとパスワードでログインします。'
      : mode === 'register'
        ? '好きなユーザーIDと8文字以上のパスワードを設定してください。'
        : 'ユーザーID、復旧コード、新しいパスワードを入力してください。';
  };

  const renderSession = (isAuthenticated: boolean, userId = ''): void => {
    authenticated = isAuthenticated;
    badge.dataset.authenticated = isAuthenticated ? 'true' : 'false';
    badge.textContent = isAuthenticated ? 'SIGNED IN' : 'GUEST';
    status.textContent = isAuthenticated
      ? `ログイン済み / user ${userId.slice(0, 8)}…`
      : '未ログイン。ユーザーIDとパスワードでログインできます。';
    guest.hidden = isAuthenticated;
    member.hidden = !isAuthenticated;
    updateControls();
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const me = await api.getMe();
      renderSession(me.authenticated, me.userId);
      if (!me.authenticated) await ensureTurnstile();
    } catch (error) {
      authenticated = false;
      badge.textContent = 'API ERROR';
      status.textContent = friendlyError(error);
      guest.hidden = false;
      member.hidden = true;
      updateControls();
    }
  };

  const showRecoveryCode = (code: string): void => {
    recoveryValue.textContent = code;
    recoveryOutput.hidden = false;
  };

  const ensureTurnstile = async (): Promise<void> => {
    if (widgetId) return;
    await loadTurnstile();
    if (!window.turnstile) throw new Error('Turnstile could not be loaded.');
    widgetId = window.turnstile.render(turnstileHost, {
      sitekey: TURNSTILE_SITE_KEY,
      action: 'password-auth',
      theme: 'dark',
      callback: (token) => {
        turnstileToken = token;
        updateControls();
      },
      'expired-callback': () => {
        turnstileToken = '';
        result.textContent = 'セキュリティ確認の期限が切れました。再確認します。';
        updateControls();
      },
      'error-callback': () => {
        turnstileToken = '';
        result.textContent = 'セキュリティ確認に失敗しました。通信状態を確認してください。';
        updateControls();
      },
    });
  };

  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.mode as AuthMode | undefined;
      if (!nextMode || busy) return;
      recoveryOutput.hidden = true;
      applyMode(nextMode);
    });
  }

  submitButton.addEventListener('click', async () => {
    if (busy || !turnstileToken) return;
    const loginId = loginIdInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if ((mode === 'register' || mode === 'recover') && password !== confirmPassword) {
      result.textContent = 'パスワード確認が一致していません。';
      return;
    }

    setBusy(true);
    recoveryOutput.hidden = true;
    result.textContent = mode === 'login' ? 'ログイン中…' : mode === 'register' ? 'アカウント作成中…' : '再設定中…';

    try {
      if (mode === 'login') {
        const session = await authApi.login({ loginId, password, turnstileToken });
        result.textContent = 'ログインしました。';
        renderSession(true, session.userId);
      } else if (mode === 'register') {
        const session = await authApi.register({ loginId, password, turnstileToken });
        showRecoveryCode(session.recoveryCode);
        result.textContent = 'アカウントを作成しました。復旧コードを必ず保存してください。';
        renderSession(true, session.userId);
      } else {
        const session = await authApi.recover({
          loginId,
          recoveryCode: recoveryCodeInput.value,
          newPassword: password,
          turnstileToken,
        });
        showRecoveryCode(session.recoveryCode);
        result.textContent = 'パスワードを再設定しました。復旧コードも新しくなりました。';
        renderSession(true, session.userId);
      }
    } catch (error) {
      console.error(error);
      result.textContent = friendlyError(error);
    } finally {
      resetTurnstile();
      setBusy(false);
    }
  });

  copyCodeButton.addEventListener('click', async () => {
    const code = recoveryValue.textContent ?? '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      result.textContent = '復旧コードをコピーしました。安全な場所へ保存してください。';
    } catch {
      result.textContent = 'コピーできませんでした。復旧コードを長押しして保存してください。';
    }
  });

  saveButton.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    result.textContent = '端末内のキャラ下書きをD1へ保存中…';
    try {
      const saved = await sync.saveCharacter();
      result.textContent = `D1保存成功 / character ${saved.id.slice(0, 8)}…`;
    } catch (error) {
      console.error(error);
      result.textContent = friendlyError(error);
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
      renderSession(false);
      await ensureTurnstile();
      resetTurnstile();
    } catch (error) {
      console.error(error);
      result.textContent = friendlyError(error);
    } finally {
      setBusy(false);
    }
  });

  applyMode('login');
  await refreshSession();
  return () => root.remove();
}

function friendlyError(error: unknown): string {
  if (error instanceof PasswordAuthApiError) {
    if (error.status === 401) return 'ユーザーID・パスワード、または復旧コードが正しくありません。';
    if (error.status === 409) return 'そのユーザーIDはすでに使われています。';
    if (error.status === 403) return 'セキュリティ確認に失敗しました。もう一度試してください。';
    if (error.status === 400) return error.message;
  }
  if (error instanceof Error) {
    if (error.message === 'Character draft does not exist.') {
      return '保存するキャラ下書きがまだありません。先にCREATE画面でキャラを作成してください。';
    }
    return error.message;
  }
  return '処理に失敗しました。';
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
