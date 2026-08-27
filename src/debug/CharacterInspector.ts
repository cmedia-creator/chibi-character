import type { AtlasCharacterRig } from '../engine/AtlasCharacterRig';
import type { PartDebugState } from '../engine/types';

type NumericKey = 'x' | 'y' | 'width' | 'height' | 'rotation';

export function mountCharacterInspector(rig: AtlasCharacterRig): () => void {
  const root = document.createElement('aside');
  root.className = 'character-inspector';
  root.innerHTML = `
    <div class="inspector-head">
      <div>
        <small>DEV TOOL</small>
        <strong>Character Inspector</strong>
      </div>
      <button type="button" data-close aria-label="閉じる">×</button>
    </div>
    <label>Part<select data-slot></select></label>
    <div class="inspector-grid" data-fields></div>
    <label class="inspector-check"><input type="checkbox" data-visible /> visible</label>
    <div class="inspector-actions">
      <button type="button" data-reset>Reset part</button>
      <button type="button" data-copy>Copy JSON</button>
    </div>
    <textarea data-output readonly aria-label="current part values"></textarea>
  `;
  document.body.appendChild(root);

  const slotSelect = root.querySelector<HTMLSelectElement>('[data-slot]')!;
  const fields = root.querySelector<HTMLDivElement>('[data-fields]')!;
  const visible = root.querySelector<HTMLInputElement>('[data-visible]')!;
  const output = root.querySelector<HTMLTextAreaElement>('[data-output]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const copyButton = root.querySelector<HTMLButtonElement>('[data-copy]')!;
  const closeButton = root.querySelector<HTMLButtonElement>('[data-close]')!;

  const numericKeys: NumericKey[] = ['x', 'y', 'width', 'height', 'rotation'];
  const inputs = new Map<NumericKey, HTMLInputElement>();

  for (const key of numericKeys) {
    const label = document.createElement('label');
    label.textContent = key;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = key === 'rotation' ? '0.5' : '1';
    input.dataset.key = key;
    label.appendChild(input);
    fields.appendChild(label);
    inputs.set(key, input);
  }

  const refreshSlots = (): void => {
    const states = rig.getPartDebugStates();
    const selected = slotSelect.value || states[0]?.slot || '';
    slotSelect.replaceChildren(
      ...states.map((state) => {
        const option = document.createElement('option');
        option.value = state.slot;
        option.textContent = state.slot;
        return option;
      }),
    );
    if (states.some((state) => state.slot === selected)) slotSelect.value = selected;
    refreshSelected();
  };

  const selectedState = (): PartDebugState | undefined =>
    rig.getPartDebugStates().find((state) => state.slot === slotSelect.value);

  const refreshSelected = (): void => {
    const state = selectedState();
    if (!state) return;
    for (const key of numericKeys) inputs.get(key)!.value = String(state[key]);
    visible.checked = state.visible;
    output.value = JSON.stringify(state, null, 2);
  };

  const applyNumeric = (key: NumericKey, value: string): void => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    rig.setPartDebugState(slotSelect.value, { [key]: parsed });
    refreshSelected();
  };

  for (const [key, input] of inputs) {
    input.addEventListener('input', () => applyNumeric(key, input.value));
  }

  visible.addEventListener('change', () => {
    rig.setPartDebugState(slotSelect.value, { visible: visible.checked });
    refreshSelected();
  });

  slotSelect.addEventListener('change', refreshSelected);
  resetButton.addEventListener('click', () => {
    rig.resetPartDebugState(slotSelect.value);
    refreshSelected();
  });
  copyButton.addEventListener('click', async () => {
    const state = selectedState();
    if (!state) return;
    const text = JSON.stringify(state, null, 2);
    output.value = text;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => { copyButton.textContent = 'Copy JSON'; }, 900);
    } catch {
      output.focus();
      output.select();
    }
  });
  closeButton.addEventListener('click', () => root.remove());

  refreshSlots();
  return () => root.remove();
}
