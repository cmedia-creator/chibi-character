import { Application } from 'pixi.js';
import './style.css';
import { CharacterRig } from './engine/CharacterRig';

const stageHost = document.querySelector<HTMLDivElement>('#pixi-stage');
const engineStatus = document.querySelector<HTMLSpanElement>('#engine-status');
const actionStatus = document.querySelector<HTMLElement>('#action-status');
const waveButton = document.querySelector<HTMLButtonElement>('#wave-button');

if (!stageHost || !engineStatus || !actionStatus || !waveButton) {
  throw new Error('Required DOM elements are missing.');
}

const app = new Application();
await app.init({
  width: 1024,
  height: 1024,
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
});
stageHost.appendChild(app.canvas);

const rig = await CharacterRig.create(
  '/data/characters/debug-rig-01.json',
  '/data/motions/phase1.json',
);
app.stage.addChild(rig.root);

const setStatus = (message: string): void => {
  actionStatus.textContent = message;
};

const wave = async (): Promise<void> => {
  setStatus('WAVE TEST');
  await rig.play('motion.wave.001');
  setStatus('IDLE / BLINK ACTIVE');
};

rig.onTap(() => {
  void wave();
});
waveButton.addEventListener('click', () => {
  void wave();
});

app.ticker.add((ticker: { deltaMS: number }) => {
  rig.update(ticker.deltaMS);
});

engineStatus.textContent = 'ENGINE READY';
setStatus('IDLE / BLINK ACTIVE');

window.addEventListener('beforeunload', () => {
  rig.destroy();
  app.destroy(true);
});
