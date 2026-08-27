import { Application, Container } from 'pixi.js';
import './style.css';
import { AtlasCharacterRig } from './engine/AtlasCharacterRig';
import { BehaviorController, type BehaviorState } from './engine/BehaviorController';
import { CharacterRig } from './engine/CharacterRig';
import { mountCharacterInspector } from './debug/CharacterInspector';
import { mountProfileEditor } from './profile/ProfileEditor';

const WORLD_SIZE = 1024;

const stageHost = document.querySelector<HTMLDivElement>('#pixi-stage');
const engineStatus = document.querySelector<HTMLSpanElement>('#engine-status');
const actionStatus = document.querySelector<HTMLElement>('#action-status');
const blinkButton = document.querySelector<HTMLButtonElement>('#blink-button');
const waveButton = document.querySelector<HTMLButtonElement>('#wave-button');

if (!stageHost || !engineStatus || !actionStatus || !blinkButton || !waveButton) {
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

let isTestCharacter = true;
let rig: AtlasCharacterRig | CharacterRig;

try {
  rig = await AtlasCharacterRig.create(
    '/data/characters/test-character-01.json',
    '/data/motions/phase1.json',
  );
} catch (error) {
  console.warn('Test character atlas is not available yet. Falling back to DEBUG RIG.', error);
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

const readyLabel = (): string => isTestCharacter ? 'TEST CHARACTER ACTIVE' : 'DEBUG RIG FALLBACK';
const setStatus = (message: string): void => {
  actionStatus.textContent = message;
};

const behaviorLabel = (state: BehaviorState): string => {
  if (state === 'look') return 'LOOK AROUND';
  if (state === 'sway') return 'IDLE SWAY';
  if (state === 'greet') return 'WAVE / GREET';
  if (state === 'curious') return 'CURIOUS';
  return readyLabel();
};

const behavior = new BehaviorController(rig, (state) => setStatus(behaviorLabel(state)));
const params = new URLSearchParams(window.location.search);
if (params.get('auto') === '0') behavior.setEnabled(false);

const blink = async (): Promise<void> => {
  setStatus('BLINK TEST');
  await rig.blinkNow();
  setStatus(readyLabel());
};

const wave = async (): Promise<void> => {
  await behavior.onTap();
};

rig.onTap(() => {
  void behavior.onTap();
});
blinkButton.addEventListener('click', () => {
  void blink();
});
waveButton.addEventListener('click', () => {
  void wave();
});

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

let unmountInspector: (() => void) | null = null;
if (params.has('inspect') && rig instanceof AtlasCharacterRig) {
  unmountInspector = mountCharacterInspector(rig);
}

let unmountProfile: (() => void) | null = null;
if (params.has('profile')) {
  unmountProfile = await mountProfileEditor({ characterCanvas: app.canvas });
}

window.addEventListener('beforeunload', () => {
  resizeObserver.disconnect();
  unmountInspector?.();
  unmountProfile?.();
  rig.destroy();
  app.destroy(true);
});
