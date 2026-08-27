export type ShareAspect = '1:1' | '4:5' | '9:16';
export type ChibiShareTheme = 'simple' | 'y2k' | 'heisei' | 'street';

export interface ChibiCardOptions {
  aspect: ShareAspect;
  theme: ChibiShareTheme;
  title?: string;
  subtitle?: string;
}

type Theme = {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  glow: string;
};

const SIZES: Record<ShareAspect, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

const THEMES: Record<ChibiShareTheme, Theme> = {
  simple: {
    background: '#f5f2f8',
    foreground: '#221d28',
    muted: '#766d80',
    accent: '#9a79b7',
    glow: '#e8d8f7',
  },
  y2k: {
    background: '#dff8ff',
    foreground: '#2b1c3d',
    muted: '#71688c',
    accent: '#ff73be',
    glow: '#b9eeff',
  },
  heisei: {
    background: '#fff1c8',
    foreground: '#38251a',
    muted: '#816a59',
    accent: '#f05c8d',
    glow: '#ffd9ef',
  },
  street: {
    background: '#151518',
    foreground: '#fafafa',
    muted: '#b2b2bc',
    accent: '#c9ff45',
    glow: '#35353d',
  },
};

export function getChibiCardSize(aspect: ShareAspect): { width: number; height: number } {
  return { ...SIZES[aspect] };
}

export function renderChibiCard(
  source: HTMLCanvasElement,
  options: ChibiCardOptions,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const size = SIZES[options.aspect];
  const theme = THEMES[options.theme];
  const canvas = target ?? document.createElement('canvas');
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  ctx.clearRect(0, 0, size.width, size.height);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, size.width, size.height);

  drawGlow(ctx, theme, size.width, size.height);

  const headerHeight = Math.round(size.height * 0.14);
  const footerHeight = Math.round(size.height * 0.11);
  const artX = Math.round(size.width * 0.07);
  const artY = headerHeight;
  const artW = size.width - artX * 2;
  const artH = size.height - headerHeight - footerHeight;

  drawRoundedRect(ctx, artX, artY, artW, artH, 44, hexWithAlpha(theme.foreground, 0.045));
  drawContained(ctx, source, artX + 32, artY + 32, artW - 64, artH - 64);

  ctx.fillStyle = theme.foreground;
  ctx.font = '800 48px system-ui, sans-serif';
  ctx.fillText(options.title || 'MY CHIBI', artX, Math.round(headerHeight * 0.66));

  ctx.fillStyle = theme.muted;
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText(options.subtitle || 'K-POP IDOL STYLE', artX, Math.round(headerHeight * 0.66) + 40);

  ctx.fillStyle = theme.accent;
  ctx.font = '800 23px system-ui, sans-serif';
  ctx.fillText('CHIBI LIFE', artX, size.height - Math.round(footerHeight * 0.45));
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.muted;
  ctx.font = '550 21px system-ui, sans-serif';
  ctx.fillText(options.aspect, size.width - artX, size.height - Math.round(footerHeight * 0.45));
  ctx.textAlign = 'left';

  return canvas;
}

export async function chibiCardToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed.'));
    }, 'image/png');
  });
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (source.width <= 0 || source.height <= 0) return;
  const scale = Math.min(width / source.width, height / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  ctx.drawImage(source, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
}

function drawGlow(ctx: CanvasRenderingContext2D, theme: Theme, width: number, height: number): void {
  const top = ctx.createRadialGradient(width * 0.72, height * 0.15, 0, width * 0.72, height * 0.15, width * 0.7);
  top.addColorStop(0, theme.glow);
  top.addColorStop(1, hexWithAlpha(theme.glow, 0));
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawRoundedRect(
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

function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
