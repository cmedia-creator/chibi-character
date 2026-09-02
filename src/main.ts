import { Application, Container } from 'pixi.js';
import './style.css';
import { AtlasCharacterRig } from './engine/AtlasCharacterRig';
import { BehaviorController, type BehaviorState } from './engine/BehaviorController';
import { CharacterRig } from './engine/CharacterRig';
import { mountCharacterInspector } from './debug/CharacterInspector';
import { mountCharacterCreator } from './creator/CharacterCreator';
import { mountProductionCreator } from './creator/ProductionCreator';
import { mountProfileEditor } from './profile/ProfileEditor';
import { mountPublicProfilePreview } from './profile/PublicProfileView';
import { mountRoomEditor } from './room/RoomEditor';
import { RoomRenderer } from './room/RoomRenderer';
import { mountShareStudio } from './share/ShareStudio';

const WORLD_SIZE = 1024;
const params = new URLSearchParams(window.location.search);
const activeMode = params.has('creator')
  ? 'creator'
  : params.has('profile')
    ? 'profile'
    : params.has('share')
      ? 'share'
      : 'live';

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav]')) {
  const active = link.dataset.nav === activeMode;
  link.classList.toggle('is-active', active);
  if (active) link.setAttribute('aria-current', 'page');
}

const stageHost = document.querySelector<HTMLDivElement>('#pixi-stage');
const engineStatus = document.querySelector<HTMLSpanElement>('#engine-status');
const actionStatus = document.querySelector<HTMLElement>('#action-status');
const characterSource = document.querySelector<HTMLElement>('#character-source');
const blinkButton = document.querySelector<HTMLButtonElement>('#blink-button');
const waveButton = document.querySelector<HTMLButtonElement>('#wave-button');
const heartButton = document.querySelector<HTMLButtonElement>('#heart-button');
const walkButton = document.querySelector<HTMLButtonElement>('#walk-button');
const sitButton = document.querySelector<HTMLButtonElement>('#sit-button');

if (
  !stageHost || !engineStatus || !actionStatus || !characterSource || !blinkButton || !waveButton ||
  !heartButton || !walkButton || !sitButton
) {
  throw new Error('Required DOM elements are missing.');
}

const app = new Application();
await app.init({
  width: WORLD_SIZE,
  height: WORLD_SIZE,
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
});

app.canvas.style.display = 'block';
app.canvas.style.width = '100%';
app.canvas.style.height = '100%';
app.canvas.style.touchAction = 'manipulation';
stageHost.appendChild(app.canvas);

const world = new Container();
app.stage.addChild(world);

let roomRenderer: RoomRenderer | null = null;
if (params.has('room')) {
  roomRenderer = new RoomRenderer();
  world.addChild(roomRenderer.container);
}

let isProductionPreview = false;
let isTestCharacter = true;
let rig: AtlasCharacterRig | CharacterRig;

try {
  if (params.get('base') !== 'test') {
    isProductionPreview = true;
    rig = await AtlasCharacterRig.create(
      '/data/characters/production-base-v1.json',
      '/data/motions/idol-base-v2.json',
    );
  } else {
    rig = await AtlasCharacterRig.create(
      '/data/characters/test-character-01.json',
      '/data/motions/phase1.json',
    );
  }
} catch (error) {
  console.warn('Character atlas is not available. Falling back to DEBUG RIG.', error);
  isProductionPreview = false;
  isTestCharacter = false;
  rig = await CharacterRig.create(
    '/data/characters/debug-rig-01.json',
    '/data/motions/phase1.json',
  );
}

world.addChild(rig.root);

const fitWorldToStage = (): void => {
  const width = Math.max(1, stageHost.clientWidth);
  const height = Math.max(1, stageHost.clientHeight);
  app.renderer.resize(width, height);
  const scale = Math.min(width / WORLD_SIZE, height / WORLD_SIZE);
  world.scale.set(scale);
  world.position.set(
    (width - WORLD_SIZE * scale) / 2,
    (height - WORLD_SIZE * scale) / 2,
  );
};

fitWorldToStage();
const resizeObserver = new ResizeObserver(fitWorldToStage);
resizeObserver.observe(stageHost);

const readyLabel = (): string => {
  if (isProductionPreview) return 'IDOL BASE V2 OUTFIT PREVIEW';
  return isTestCharacter ? 'TEST CHARACTER ACTIVE' : 'DEBUG RIG FALLBACK';
};
const setStatus = (message: string): void => {
  actionStatus.textContent = message;
};

type CharacterSourceDetail = {
  id: string;
  name: string;
  updatedAt: number;
  source: 'saved' | 'restored';
};

const onCharacterSource = (event: Event): void => {
  const detail = (event as CustomEvent<CharacterSourceDetail>).detail;
  if (!detail?.id || !detail.name) return;
  const sourceLabel = detail.source === 'restored' ? 'D1 RESTORED' : 'D1 SAVED';
  characterSource.textContent = `${detail.name} / ${sourceLabel}`;
  setStatus(`${sourceLabel} ${detail.id.slice(0, 8)}…`);
};
window.addEventListener('chibi:character-source', onCharacterSource);

const behaviorLabel = (state: BehaviorState): string => {
  if (state === 'look') return 'LOOK AROUND';
  if (state === 'sway') return 'IDLE SWAY';
  if (state === 'greet') return 'WAVE / GREET';
  if (state === 'curious') return 'CURIOUS';
  if (state === 'walk') return 'WALK';
  if (state === 'sit') return 'SIT';
  if (state === 'heart') return 'HEART';
  return readyLabel();
};

const behavior = new BehaviorController(rig, (state) => setStatus(behaviorLabel(state)));
if (params.get('auto') === '0') behavior.setEnabled(false);

const blink = async (): Promise<void> => {
  if (isProductionPreview) return;
  setStatus('BLINK');
  await rig.blinkNow();
  setStatus(readyLabel());
};

const playMotion = async (id: string, label: string): Promise<void> => {
  if (!rig.canPlay(id)) {
    setStatus(`${label} NOT AVAILABLE`);
    return;
  }
  setStatus(label);
  await rig.play(id, { interrupt: true });
  setStatus(readyLabel());
};

rig.onTap(() => {
  void behavior.onTap();
});
blinkButton.addEventListener('click', () => void blink());
waveButton.addEventListener('click', () => {
  void behavior.onTap();
});
heartButton.addEventListener('click', () => void playMotion('motion.heart.001', 'HEART'));
walkButton.addEventListener('click', () => void playMotion('motion.walk.inplace.001', 'WALK'));
sitButton.addEventListener('click', () => void playMotion('motion.sit.001', 'SIT'));

blinkButton.disabled = isProductionPreview;
heartButton.disabled = !rig.canPlay('motion.heart.001');
walkButton.disabled = !rig.canPlay('motion.walk.inplace.001');
sitButton.disabled = !rig.canPlay('motion.sit.001');

let hiddenAt: number | null = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt !== null) {
    const away = Date.now() - hiddenAt;
    hiddenAt = null;
    void behavior.greetAfterAbsence(away);
  }
});

app.ticker.add((ticker: { deltaMS: number }) => {
  rig.update(ticker.deltaMS);
  behavior.update(ticker.deltaMS);
});

engineStatus.textContent = 'ENGINE READY';
setStatus(readyLabel());
if (isProductionPreview) {
  characterSource.textContent = 'IDOL BASE V2 / FIXED IDENTITY + POSE';
  waveButton.textContent = '挨拶';
  heartButton.textContent = 'ファンサ';
  walkButton.textContent = 'ダンス';
  sitButton.textContent = 'ポーズ';
}

let unmountInspector: (() => void) | null = null;
if (params.has('inspect') && rig instanceof AtlasCharacterRig && !isProductionPreview) {
  unmountInspector = mountCharacterInspector(rig);
}

let unmountCreator: (() => void) | null = null;
if (params.has('creator') && rig instanceof AtlasCharacterRig) {
  unmountCreator = isProductionPreview
    ? await mountProductionCreator({ rig })
    : await mountCharacterCreator({ rig });
}

let unmountRoom: (() => void) | null = null;
if (roomRenderer) {
  unmountRoom = await mountRoomEditor({ renderer: roomRenderer });
}

let unmountProfile: (() => void) | null = null;
if (params.has('profile')) {
  unmountProfile = await mountProfileEditor({ characterCanvas: app.canvas });
}

let unmountShareStudio: (() => void) | null = null;
if (params.has('share')) {
  unmountShareStudio = mountShareStudio({
    characterCanvas: app.canvas,
    playMotion: (id, options) => rig.play(id, options),
  });
}

let unmountPublicProfile: (() => void) | null = null;
if (params.has('public')) {
  unmountPublicProfile = await mountPublicProfilePreview({ characterCanvas: app.canvas });
}

window.addEventListener('beforeunload', () => {
  window.removeEventListener('chibi:character-source', onCharacterSource);
  resizeObserver.disconnect();
  unmountInspector?.();
  unmountCreator?.();
  unmountRoom?.();
  unmountProfile?.();
  unmountShareStudio?.();
  unmountPublicProfile?.();
  rig.destroy();
  roomRenderer?.container.destroy({ children: true });
  app.destroy(true);
});
