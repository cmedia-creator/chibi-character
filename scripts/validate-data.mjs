import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHARACTER_DIR = path.join(ROOT, 'public', 'data', 'characters');
const MOTION_FILE = path.join(ROOT, 'public', 'data', 'motions', 'phase1.json');
const CATALOG_FILE = path.join(ROOT, 'public', 'data', 'catalog', 'parts.json');
const ROOM_CATALOG_FILE = path.join(ROOT, 'public', 'data', 'rooms', 'catalog.json');
const TRANSFORM_KEYS = ['rotation', 'x', 'y', 'scaleX', 'scaleY', 'alpha'];
const CATALOG_CATEGORIES = new Set(['face', 'eyes', 'hair', 'outfit', 'accessory']);
const FURNITURE_KINDS = new Set(['rug', 'sofa', 'table', 'plant', 'lamp', 'speaker']);

const errors = [];
const notes = [];

const fail = (scope, message) => errors.push(`${scope}: ${message}`);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validHex = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

async function loadJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    fail(path.relative(ROOT, file), `invalid JSON (${error.message})`);
    return null;
  }
}

function validateFrame(scope, frame) {
  if (!frame || typeof frame !== 'object') return;
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!finite(frame[key])) fail(scope, `frame.${key} must be a finite number`);
  }
  if (finite(frame.width) && frame.width <= 0) fail(scope, 'frame.width must be > 0');
  if (finite(frame.height) && frame.height <= 0) fail(scope, 'frame.height must be > 0');
}

function validateBoneHierarchy(scope, bones, boneNames) {
  const byName = new Map(bones.map((bone) => [bone.name, bone]));
  for (const [index, bone] of bones.entries()) {
    const boneScope = `${scope} bone[${index}]`;
    if (bone.parent !== undefined) {
      if (typeof bone.parent !== 'string' || !bone.parent) fail(boneScope, 'parent must be a non-empty bone name');
      else if (!boneNames.has(bone.parent)) fail(boneScope, `unknown parent bone ${bone.parent}`);
      else if (bone.parent === bone.name) fail(boneScope, 'bone cannot parent itself');
    }
  }
  for (const bone of bones) {
    const seen = new Set();
    let current = bone.name;
    while (current) {
      if (seen.has(current)) {
        fail(scope, `bone parent cycle detected at ${current}`);
        break;
      }
      seen.add(current);
      current = byName.get(current)?.parent;
    }
  }
}

function validateCharacter(fileName, data) {
  const scope = `character/${fileName}`;
  if (!data || typeof data !== 'object') return;
  if (typeof data.id !== 'string' || !data.id) fail(scope, 'id is required');
  if (!data.root || !finite(data.root.x) || !finite(data.root.y) || !finite(data.root.scale)) {
    fail(scope, 'root.x/root.y/root.scale must be finite numbers');
  }
  if (!Array.isArray(data.bones) || data.bones.length === 0) {
    fail(scope, 'bones must be a non-empty array');
    return;
  }

  const boneNames = new Set();
  for (const [index, bone] of data.bones.entries()) {
    const boneScope = `${scope} bone[${index}]`;
    if (typeof bone.name !== 'string' || !bone.name) fail(boneScope, 'name is required');
    if (boneNames.has(bone.name)) fail(boneScope, `duplicate bone name ${bone.name}`);
    boneNames.add(bone.name);
    for (const key of ['x', 'y', 'zIndex']) {
      if (!finite(bone[key])) fail(boneScope, `${key} must be a finite number`);
    }
  }
  validateBoneHierarchy(scope, data.bones, boneNames);

  if (!Array.isArray(data.parts) || data.parts.length === 0) {
    fail(scope, 'parts must be a non-empty array');
    return;
  }

  const slots = new Set();
  for (const [index, part] of data.parts.entries()) {
    const partScope = `${scope} part[${index}]`;
    if (typeof part.id !== 'string' || !part.id) fail(partScope, 'id is required');
    if (typeof part.slot !== 'string' || !part.slot) fail(partScope, 'slot is required');
    if (slots.has(part.slot)) fail(partScope, `duplicate slot ${part.slot}`);
    slots.add(part.slot);
    if (!boneNames.has(part.bone)) fail(partScope, `unknown bone ${String(part.bone)}`);
    if (typeof part.asset !== 'string' || !part.asset) fail(partScope, 'asset is required');
    for (const key of ['x', 'y', 'width', 'height', 'anchorX', 'anchorY', 'zIndex']) {
      if (!finite(part[key])) fail(partScope, `${key} must be a finite number`);
    }
    if (finite(part.width) && part.width <= 0) fail(partScope, 'width must be > 0');
    if (finite(part.height) && part.height <= 0) fail(partScope, 'height must be > 0');
    validateFrame(partScope, part.frame);
  }

  if (!slots.has('eyes_open') || !slots.has('eyes_closed')) {
    notes.push(`${scope}: blink slots are not both present; blink is optional for this rig`);
  }
}

function normalizeTracks(motion) {
  if (Array.isArray(motion.tracks)) return motion.tracks;
  if (motion.bone && Array.isArray(motion.keyframes)) return [{ bone: motion.bone, keyframes: motion.keyframes }];
  return [];
}

function validateMotionCatalog(data, knownBones) {
  const scope = 'motions/phase1.json';
  if (!data || !Array.isArray(data.motions)) {
    fail(scope, 'motions must be an array');
    return;
  }
  const ids = new Set();
  for (const [motionIndex, motion] of data.motions.entries()) {
    const motionScope = `${scope} motion[${motionIndex}]`;
    if (typeof motion.id !== 'string' || !motion.id) fail(motionScope, 'id is required');
    if (ids.has(motion.id)) fail(motionScope, `duplicate motion id ${motion.id}`);
    ids.add(motion.id);
    if (!finite(motion.duration) || motion.duration <= 0) fail(motionScope, 'duration must be > 0');
    const tracks = normalizeTracks(motion);
    if (tracks.length === 0) fail(motionScope, 'at least one motion track is required');
    for (const [trackIndex, track] of tracks.entries()) {
      const trackScope = `${motionScope} track[${trackIndex}]`;
      if (!knownBones.has(track.bone)) fail(trackScope, `unknown bone ${String(track.bone)}`);
      if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) {
        fail(trackScope, 'keyframes must be a non-empty array');
        continue;
      }
      let previousT = -Infinity;
      for (const [frameIndex, frame] of track.keyframes.entries()) {
        const frameScope = `${trackScope} keyframe[${frameIndex}]`;
        if (!finite(frame.t)) fail(frameScope, 't must be a finite number');
        if (finite(frame.t) && frame.t < previousT) fail(frameScope, 't must be monotonically increasing');
        if (finite(frame.t) && finite(motion.duration) && (frame.t < 0 || frame.t > motion.duration)) {
          fail(frameScope, `t must be within 0..${motion.duration}`);
        }
        if (finite(frame.t)) previousT = frame.t;
        if (!TRANSFORM_KEYS.some((key) => finite(frame[key]))) {
          fail(frameScope, `one of ${TRANSFORM_KEYS.join(', ')} is required`);
        }
      }
    }
  }
}

function validateCatalog(data) {
  const scope = 'catalog/parts.json';
  if (!data || !Array.isArray(data.bundles) || !Array.isArray(data.packs)) {
    fail(scope, 'bundles and packs must be arrays');
    return;
  }
  const packIds = new Set();
  for (const [index, pack] of data.packs.entries()) {
    const packScope = `${scope} pack[${index}]`;
    if (typeof pack.id !== 'string' || !pack.id) fail(packScope, 'id is required');
    if (packIds.has(pack.id)) fail(packScope, `duplicate pack id ${pack.id}`);
    packIds.add(pack.id);
    if (typeof pack.name !== 'string' || !pack.name) fail(packScope, 'name is required');
    if (!finite(pack.priceJpy) || pack.priceJpy < 0) fail(packScope, 'priceJpy must be >= 0');
    if (typeof pack.available !== 'boolean') fail(packScope, 'available must be boolean');
  }
  const bundleIds = new Set();
  for (const [index, bundle] of data.bundles.entries()) {
    const bundleScope = `${scope} bundle[${index}]`;
    if (typeof bundle.id !== 'string' || !bundle.id) fail(bundleScope, 'id is required');
    if (bundleIds.has(bundle.id)) fail(bundleScope, `duplicate bundle id ${bundle.id}`);
    bundleIds.add(bundle.id);
    if (!CATALOG_CATEGORIES.has(bundle.category)) fail(bundleScope, `unknown category ${String(bundle.category)}`);
    if (!packIds.has(bundle.packId)) fail(bundleScope, `unknown pack ${String(bundle.packId)}`);
    if (typeof bundle.isFree !== 'boolean') fail(bundleScope, 'isFree must be boolean');
    if (!bundle.sources || typeof bundle.sources !== 'object' || Array.isArray(bundle.sources)) {
      fail(bundleScope, 'sources must be an object');
      continue;
    }
    for (const [slot, source] of Object.entries(bundle.sources)) {
      const sourceScope = `${bundleScope} source/${slot}`;
      if (!source || typeof source.asset !== 'string' || !source.asset) fail(sourceScope, 'asset is required');
      validateFrame(sourceScope, source?.frame);
    }
  }
}

function validateRoomCatalog(data) {
  const scope = 'rooms/catalog.json';
  if (!data || !Array.isArray(data.themes) || !Array.isArray(data.furniture)) {
    fail(scope, 'themes and furniture must be arrays');
    return;
  }

  const themeIds = new Set();
  for (const [index, theme] of data.themes.entries()) {
    const themeScope = `${scope} theme[${index}]`;
    if (typeof theme.id !== 'string' || !theme.id) fail(themeScope, 'id is required');
    if (themeIds.has(theme.id)) fail(themeScope, `duplicate theme id ${theme.id}`);
    themeIds.add(theme.id);
    if (typeof theme.name !== 'string' || !theme.name) fail(themeScope, 'name is required');
    for (const key of ['wallColor', 'floorColor', 'accentColor', 'panelColor']) {
      if (!validHex(theme[key])) fail(themeScope, `${key} must be a 6-digit hex color`);
    }
  }

  const furnitureIds = new Set();
  for (const [index, item] of data.furniture.entries()) {
    const itemScope = `${scope} furniture[${index}]`;
    if (typeof item.id !== 'string' || !item.id) fail(itemScope, 'id is required');
    if (furnitureIds.has(item.id)) fail(itemScope, `duplicate furniture id ${item.id}`);
    furnitureIds.add(item.id);
    if (typeof item.name !== 'string' || !item.name) fail(itemScope, 'name is required');
    if (!FURNITURE_KINDS.has(item.kind)) fail(itemScope, `unknown kind ${String(item.kind)}`);
    for (const key of ['width', 'height', 'defaultX', 'defaultY', 'defaultScale']) {
      if (!finite(item[key])) fail(itemScope, `${key} must be a finite number`);
    }
    if (finite(item.width) && item.width <= 0) fail(itemScope, 'width must be > 0');
    if (finite(item.height) && item.height <= 0) fail(itemScope, 'height must be > 0');
    if (finite(item.defaultScale) && item.defaultScale <= 0) fail(itemScope, 'defaultScale must be > 0');
    for (const key of ['color', 'accentColor']) {
      if (!validHex(item[key])) fail(itemScope, `${key} must be a 6-digit hex color`);
    }
  }
}

const files = (await readdir(CHARACTER_DIR)).filter((name) => name.endsWith('.json')).sort();
const allBones = new Set();
for (const fileName of files) {
  const data = await loadJson(path.join(CHARACTER_DIR, fileName));
  validateCharacter(fileName, data);
  for (const bone of data?.bones ?? []) allBones.add(bone.name);
}

const motions = await loadJson(MOTION_FILE);
validateMotionCatalog(motions, allBones);
const catalog = await loadJson(CATALOG_FILE);
validateCatalog(catalog);
const roomCatalog = await loadJson(ROOM_CATALOG_FILE);
validateRoomCatalog(roomCatalog);

for (const note of notes) console.log(`NOTE ${note}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nData validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Validated ${files.length} character definition(s), ${motions?.motions?.length ?? 0} motion(s), ${catalog?.bundles?.length ?? 0} catalog bundle(s), ${catalog?.packs?.length ?? 0} pack(s), ${roomCatalog?.themes?.length ?? 0} room theme(s), and ${roomCatalog?.furniture?.length ?? 0} furniture item(s).`);
