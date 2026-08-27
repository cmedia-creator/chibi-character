import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CHARACTER_DIR = path.join(ROOT, 'public', 'data', 'characters');
const MOTION_FILE = path.join(ROOT, 'public', 'data', 'motions', 'phase1.json');
const TRANSFORM_KEYS = ['rotation', 'x', 'y', 'scaleX', 'scaleY', 'alpha'];

const errors = [];
const notes = [];

const fail = (scope, message) => errors.push(`${scope}: ${message}`);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

async function loadJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    fail(path.relative(ROOT, file), `invalid JSON (${error.message})`);
    return null;
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
    if (part.frame) {
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!finite(part.frame[key])) fail(partScope, `frame.${key} must be a finite number`);
      }
      if (finite(part.frame.width) && part.frame.width <= 0) fail(partScope, 'frame.width must be > 0');
      if (finite(part.frame.height) && part.frame.height <= 0) fail(partScope, 'frame.height must be > 0');
    }
  }

  if (!slots.has('eyes_open') || !slots.has('eyes_closed')) {
    notes.push(`${scope}: blink slots are not both present; blink is optional for this rig`);
  }
}

function normalizeTracks(motion) {
  if (Array.isArray(motion.tracks)) return motion.tracks;
  if (motion.bone && Array.isArray(motion.keyframes)) {
    return [{ bone: motion.bone, keyframes: motion.keyframes }];
  }
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

const files = (await readdir(CHARACTER_DIR)).filter((name) => name.endsWith('.json')).sort();
const allBones = new Set();
for (const fileName of files) {
  const data = await loadJson(path.join(CHARACTER_DIR, fileName));
  validateCharacter(fileName, data);
  for (const bone of data?.bones ?? []) allBones.add(bone.name);
}

const motions = await loadJson(MOTION_FILE);
validateMotionCatalog(motions, allBones);

for (const note of notes) console.log(`NOTE ${note}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nData validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Validated ${files.length} character definition(s) and ${motions?.motions?.length ?? 0} motion(s).`);
