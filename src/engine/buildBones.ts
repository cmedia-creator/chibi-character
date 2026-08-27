import { Container } from 'pixi.js';
import type { BoneDefinition } from './types';

export function buildBones(root: Container, definitions: BoneDefinition[]): Map<string, Container> {
  const bones = new Map<string, Container>();
  const definitionsByName = new Map(definitions.map((definition) => [definition.name, definition]));

  for (const definition of definitions) {
    if (bones.has(definition.name)) throw new Error(`Duplicate bone: ${definition.name}`);
    const bone = new Container();
    bone.label = definition.name;
    bone.position.set(definition.x, definition.y);
    bone.zIndex = definition.zIndex;
    bone.sortableChildren = true;
    bones.set(definition.name, bone);
  }

  for (const definition of definitions) {
    assertNoParentCycle(definition.name, definitionsByName);
    const bone = bones.get(definition.name)!;
    if (definition.parent) {
      const parent = bones.get(definition.parent);
      if (!parent) throw new Error(`Parent bone missing: ${definition.parent}`);
      parent.addChild(bone);
    } else {
      root.addChild(bone);
    }
  }

  for (const bone of bones.values()) bone.sortChildren();
  root.sortChildren();
  return bones;
}

function assertNoParentCycle(name: string, definitions: Map<string, BoneDefinition>): void {
  const visited = new Set<string>();
  let current: string | undefined = name;
  while (current) {
    if (visited.has(current)) throw new Error(`Bone parent cycle detected at ${current}`);
    visited.add(current);
    current = definitions.get(current)?.parent;
  }
}
