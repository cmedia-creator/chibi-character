import './share-studio.css';
import { chibiCardToPng, renderChibiCard, type ChibiShareTheme, type ShareAspect } from './ChibiCardRenderer';
import { recordChibiVideo } from './CanvasVideoRecorder';
import { shareFileOrDownload } from './share';

type ShareStudioOptions = {
  characterCanvas: HTMLCanvasElement;
  playMotion: (id: string, options?: { interrupt?: boolean }) => Promise<void>;
};

type AnimationChoice = 'photo' | 'wave' | 'curious' | 'sway';

const MOTION_BY_ANIMATION: Record<Exclude<AnimationChoice, 'photo'>, string> = {
  wave: 'motion.wave.001',
  curious: 'motion.curious.001',
  sway: 'motion.sway.001',
};

export function mountShareStudio(options: ShareStudioOptions): () => void {
  let aspect: ShareAspect = '4:5';
  let theme: ChibiShareTheme = 'simple';
  let animation: AnimationChoice = 'photo';
  let previewCanvas: HTMLCanvasElement | null = null;
  let busy = false;

  const root = document.createElement('section');
  root.className = 'share-studio';
  root.innerHTML = `
    <div class="share-studio-head">
      <div>
        <p class="eyebrow">PHASE 2 / CLIENT EXPORT</p>
        <h2>SHARE STUDIO</h2>
      </div>
      <span class="badge">NO SERVER RENDER</span>
    </div>
    <div class="share-studio-grid">
      <div class="share-options">
        <fieldset>
          <legend>SIZE</legend>
          <div class="share-segments" data-aspect></div>
        </fieldset>
        <fieldset>
          <legend>STYLE</legend>
          <div class="share-segments" data-theme></div>
        </fieldset>
        <fieldset>
          <legend>ANIMATION</legend>
          <div class="share-segments" data-animation></div>
        </fieldset>
        <label class="share-text-field">TITLE<input type="text" data-title value="MY CHIBI" /></label>
        <label class="share-text-field">SUBTITLE<input type="text" data-subtitle value="K-POP IDOL STYLE" /></label>
        <p class="share-status" data-status>端末内で生成します。</p>
      </div>
      <div class="share-output">
        <div class="share-preview" data-preview></div>
        <div class="share-actions">
          <button type="button" data-refresh>プレビュー更新</button>
          <button type="button" data-export>共有 / 保存</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('.app-shell')?.appendChild(root);

  const aspectHost = root.querySelector<HTMLDivElement>('[data-aspect]')!;
  const themeHost = root.querySelector<HTMLDivElement>('[data-theme]')!;
  const animationHost = root.querySelector<HTMLDivElement>('[data-animation]')!;
  const titleInput = root.querySelector<HTMLInputElement>('[data-title]')!;
  const subtitleInput = root.querySelector<HTMLInputElement>('[data-subtitle]')!;
  const preview = root.querySelector<HTMLDivElement>('[data-preview]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const refreshButton = root.querySelector<HTMLButtonElement>('[data-refresh]')!;
  const exportButton = root.querySelector<HTMLButtonElement>('[data-export]')!;

  const makeButtons = <T extends string>(
    host: HTMLElement,
    values: Array<{ value: T; label: string }>,
    current: () => T,
    set: (value: T) => void,
  ): void => {
    for (const item of values) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.dataset.value = item.value;
      button.addEventListener('click', () => {
        set(item.value);
        for (const child of host.querySelectorAll('button')) {
          child.classList.toggle('is-active', (child as HTMLButtonElement).dataset.value === current());
        }
        updatePreview();
      });
      host.appendChild(button);
    }
    for (const child of host.querySelectorAll('button')) {
      child.classList.toggle('is-active', (child as HTMLButtonElement).dataset.value === current());
    }
  };

  makeButtons<ShareAspect>(
    aspectHost,
    [
      { value: '1:1', label: '1:1' },
      { value: '4:5', label: '4:5' },
      { value: '9:16', label: '9:16' },
    ],
    () => aspect,
    (value) => { aspect = value; },
  );

  makeButtons<ChibiShareTheme>(
    themeHost,
    [
      { value: 'simple', label: 'SIMPLE' },
      { value: 'y2k', label: 'Y2K' },
      { value: 'heisei', label: 'HEISEI' },
      { value: 'street', label: 'STREET' },
    ],
    () => theme,
    (value) => { theme = value; },
  );

  makeButtons<AnimationChoice>(
    animationHost,
    [
      { value: 'photo', label: 'PHOTO' },
      { value: 'wave', label: 'WAVE' },
      { value: 'curious', label: 'CURIOUS' },
      { value: 'sway', label: 'SWAY' },
    ],
    () => animation,
    (value) => { animation = value; },
  );

  const cardOptions = () => ({
    aspect,
    theme,
    title: titleInput.value.trim() || 'MY CHIBI',
    subtitle: subtitleInput.value.trim() || 'K-POP IDOL STYLE',
  });

  const updatePreview = (): HTMLCanvasElement => {
    previewCanvas = renderChibiCard(options.characterCanvas, cardOptions());
    previewCanvas.className = 'share-preview-canvas';
    preview.replaceChildren(previewCanvas);
    return previewCanvas;
  };

  const setBusy = (next: boolean): void => {
    busy = next;
    refreshButton.disabled = next;
    exportButton.disabled = next;
  };

  const exportCurrent = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (animation === 'photo') {
        status.textContent = 'PNGを生成中…';
        const card = updatePreview();
        const blob = await chibiCardToPng(card);
        const result = await shareFileOrDownload({
          blob,
          filename: `chibi-life-${aspect.replace(':', 'x')}.png`,
          title: 'MY CHIBI',
          text: 'K-POPアイドル風のちびキャラ',
        });
        status.textContent = result === 'shared' ? '共有しました' : '画像を保存しました';
        return;
      }

      status.textContent = '短尺動画を端末内で生成中…';
      const motionId = MOTION_BY_ANIMATION[animation];
      const recorded = await recordChibiVideo(options.characterCanvas, {
        durationMs: 4_000,
        fps: 30,
        card: cardOptions(),
        onStart: () => options.playMotion(motionId, { interrupt: true }),
      });
      const result = await shareFileOrDownload({
        blob: recorded.blob,
        filename: `chibi-life-${animation}.${recorded.extension}`,
        title: 'MY CHIBI',
        text: '動くちびキャラ',
      });
      status.textContent = result === 'shared' ? '動画を共有しました' : '動画を保存しました';
    } catch (error) {
      console.error(error);
      status.textContent = error instanceof Error
        ? `生成できませんでした: ${error.message}`
        : '生成できませんでした。';
    } finally {
      setBusy(false);
    }
  };

  titleInput.addEventListener('input', updatePreview);
  subtitleInput.addEventListener('input', updatePreview);
  refreshButton.addEventListener('click', updatePreview);
  exportButton.addEventListener('click', () => void exportCurrent());

  updatePreview();
  return () => root.remove();
}
