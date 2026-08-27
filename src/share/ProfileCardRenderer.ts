import type { OshiProfileDraft } from '../data/models';

type ShareTheme = {
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
};

const THEMES: Record<string, ShareTheme> = {
  simple: {
    background: '#f7f4fa',
    panel: '#ffffff',
    text: '#211b28',
    muted: '#72687d',
    accent: '#8d6aa9',
  },
  y2k: {
    background: '#dff7ff',
    panel: '#fef6ff',
    text: '#271d3a',
    muted: '#6c6684',
    accent: '#ff72bd',
  },
  heisei: {
    background: '#fff2c8',
    panel: '#fffdf4',
    text: '#352318',
    muted: '#7b6659',
    accent: '#ef5e8c',
  },
  street: {
    background: '#17171a',
    panel: '#242429',
    text: '#f7f7f7',
    muted: '#adadb5',
    accent: '#c7ff45',
  },
};

export interface ProfileCardOptions {
  width?: number;
  height?: number;
  themeId?: string;
}

export function renderProfileCard(
  profile: OshiProfileDraft,
  characterCanvas: CanvasImageSource | null,
  options: ProfileCardOptions = {},
): HTMLCanvasElement {
  const width = options.width ?? 1080;
  const height = options.height ?? 1350;
  const theme = THEMES[options.themeId ?? profile.themeId] ?? THEMES.simple;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  drawAccent(ctx, theme.accent, width, height);
  drawRoundedPanel(ctx, 54, 54, width - 108, height - 108, 44, theme.panel);

  ctx.fillStyle = theme.muted;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('CHIBI LIFE / OSHI PROFILE', 100, 120);

  ctx.fillStyle = theme.text;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText(profile.displayName || 'MY PROFILE', 100, 190);

  const characterX = 100;
  const characterY = 240;
  const characterW = 390;
  const characterH = 560;
  drawRoundedPanel(ctx, characterX, characterY, characterW, characterH, 32, theme.background);
  if (characterCanvas) {
    drawContainedImage(ctx, characterCanvas, characterX + 24, characterY + 24, characterW - 48, characterH - 48);
  } else {
    ctx.fillStyle = theme.muted;
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MY CHIBI', characterX + characterW / 2, characterY + characterH / 2);
    ctx.textAlign = 'left';
  }

  const fieldX = 540;
  let fieldY = 255;
  fieldY = drawField(ctx, theme, 'MY OSHI', profile.oshiName, fieldX, fieldY, 430);
  fieldY = drawField(ctx, theme, '推し歴', profile.oshiSince, fieldX, fieldY, 430);
  fieldY = drawField(ctx, theme, '好きな曲', profile.favoriteSong, fieldX, fieldY, 430);
  fieldY = drawField(ctx, theme, '好きなところ', profile.favoritePoint, fieldX, fieldY, 430);
  fieldY = drawField(ctx, theme, '同担スタンス', profile.doufanStance, fieldX, fieldY, 430);

  const lowerY = 850;
  drawRoundedPanel(ctx, 100, lowerY, width - 200, 360, 30, theme.background);
  ctx.fillStyle = theme.accent;
  ctx.font = '800 25px system-ui, sans-serif';
  ctx.fillText('MESSAGE', 138, lowerY + 58);
  ctx.fillStyle = theme.text;
  ctx.font = '650 31px system-ui, sans-serif';
  drawWrappedText(ctx, profile.message || profile.bio || '推し活をもっと楽しく。', 138, lowerY + 108, width - 276, 44, 4);

  ctx.fillStyle = theme.muted;
  ctx.font = '500 21px system-ui, sans-serif';
  ctx.fillText('Made with CHIBI LIFE', 100, height - 82);
  ctx.textAlign = 'right';
  ctx.fillText('K-POP IDOL STYLE CHIBI', width - 100, height - 82);
  ctx.textAlign = 'left';

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed.'));
    }, 'image/png');
  });
}

function drawField(
  ctx: CanvasRenderingContext2D,
  theme: ShareTheme,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  ctx.fillStyle = theme.accent;
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = theme.text;
  ctx.font = '650 30px system-ui, sans-serif';
  const lines = wrapLines(ctx, value || '—', maxWidth, 2);
  lines.forEach((line, index) => ctx.fillText(line, x, y + 42 + index * 38));
  return y + 42 + lines.length * 38 + 28;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  wrapLines(ctx, text, maxWidth, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = [...text.trim()];
  const lines: string[] = [];
  let current = '';

  for (const char of chars) {
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && chars.join('') !== lines.join('')) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(0, lines[last].length - 1))}…`;
  }
  return lines.length ? lines : ['—'];
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceWidth = 'videoWidth' in image ? image.videoWidth : 'naturalWidth' in image ? image.naturalWidth : image.width;
  const sourceHeight = 'videoHeight' in image ? image.videoHeight : 'naturalHeight' in image ? image.naturalHeight : image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawRoundedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawAccent(ctx: CanvasRenderingContext2D, accent: string, width: number, height: number): void {
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(width * 0.88, height * 0.08, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.08, height * 0.92, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
