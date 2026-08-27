import { Container, Graphics } from 'pixi.js';
import type { RoomState } from '../data/models';
import type { FurnitureDefinition, FurnitureKind, RoomCatalog, RoomThemeDefinition } from './types';

const ROOM_SIZE = 1024;
const FLOOR_Y = 710;

export class RoomRenderer {
  readonly container = new Container();
  private catalog: RoomCatalog | null = null;

  constructor() {
    this.container.label = 'my-room';
    this.container.sortableChildren = true;
    this.container.zIndex = -100;
  }

  setCatalog(catalog: RoomCatalog): void {
    this.catalog = catalog;
  }

  render(state: RoomState): void {
    const catalog = this.catalog;
    if (!catalog) throw new Error('Room catalog has not been loaded.');
    const theme = catalog.themes.find((item) => item.id === state.themeId) ?? catalog.themes[0];
    if (!theme) throw new Error('Room theme is unavailable.');

    this.container.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.container.addChild(this.drawRoom(theme));

    for (const placed of state.furniture) {
      const definition = catalog.furniture.find((item) => item.id === placed.id);
      if (!definition) continue;
      const item = this.drawFurniture(definition);
      item.position.set(placed.x, placed.y);
      item.scale.set(placed.scale);
      item.zIndex = definition.kind === 'rug' ? 5 : 20 + placed.y / ROOM_SIZE;
      this.container.addChild(item);
    }

    this.container.sortChildren();
  }

  private drawRoom(theme: RoomThemeDefinition): Graphics {
    const g = new Graphics();
    g.label = 'room-background';
    g.zIndex = 0;

    g.rect(0, 0, ROOM_SIZE, FLOOR_Y).fill(hex(theme.wallColor));
    g.rect(0, FLOOR_Y, ROOM_SIZE, ROOM_SIZE - FLOOR_Y).fill(hex(theme.floorColor));

    g.rect(64, 72, 360, 250)
      .fill(hex(theme.panelColor))
      .stroke({ width: 8, color: hex(theme.accentColor), alpha: 0.25 });
    g.rect(82, 90, 154, 214).fill({ color: hex(theme.accentColor), alpha: 0.08 });
    g.rect(252, 90, 154, 214).fill({ color: hex(theme.accentColor), alpha: 0.12 });

    g.rect(650, 94, 270, 22).fill({ color: hex(theme.accentColor), alpha: 0.35 });
    g.rect(692, 136, 186, 130)
      .fill({ color: hex(theme.panelColor), alpha: 0.95 })
      .stroke({ width: 5, color: hex(theme.accentColor), alpha: 0.22 });

    g.rect(0, FLOOR_Y - 8, ROOM_SIZE, 8).fill({ color: hex(theme.accentColor), alpha: 0.18 });
    for (let x = -160; x < ROOM_SIZE + 160; x += 170) {
      g.moveTo(x, ROOM_SIZE).lineTo(x + 160, FLOOR_Y).stroke({ width: 2, color: 0xffffff, alpha: 0.08 });
    }
    return g;
  }

  private drawFurniture(definition: FurnitureDefinition): Container {
    const item = new Container();
    item.label = definition.id;
    const g = new Graphics();
    const w = definition.width;
    const h = definition.height;
    const color = hex(definition.color);
    const accent = hex(definition.accentColor);

    this.drawFurnitureShape(g, definition.kind, w, h, color, accent);
    item.addChild(g);
    return item;
  }

  private drawFurnitureShape(
    g: Graphics,
    kind: FurnitureKind,
    width: number,
    height: number,
    color: number,
    accent: number,
  ): void {
    if (kind === 'rug') {
      g.ellipse(0, 0, width / 2, height / 2).fill({ color, alpha: 0.62 });
      g.ellipse(0, 0, width * 0.39, height * 0.34).stroke({ width: 8, color: accent, alpha: 0.35 });
      return;
    }

    if (kind === 'sofa') {
      g.roundRect(-width / 2, -height, width, height * 0.63, 34).fill(color);
      g.roundRect(-width / 2 - 20, -height * 0.58, width + 40, height * 0.42, 30).fill({ color: accent, alpha: 0.9 });
      g.roundRect(-width * 0.42, -height * 0.62, width * 0.38, height * 0.28, 18).fill({ color: 0xffffff, alpha: 0.3 });
      g.roundRect(width * 0.04, -height * 0.62, width * 0.38, height * 0.28, 18).fill({ color: 0xffffff, alpha: 0.3 });
      return;
    }

    if (kind === 'table') {
      g.roundRect(-width / 2, -height, width, height * 0.22, 16).fill(color);
      g.rect(-width * 0.34, -height * 0.78, 18, height * 0.78).fill(accent);
      g.rect(width * 0.34 - 18, -height * 0.78, 18, height * 0.78).fill(accent);
      return;
    }

    if (kind === 'plant') {
      g.roundRect(-width * 0.34, -height * 0.34, width * 0.68, height * 0.34, 18).fill({ color: accent, alpha: 0.9 });
      g.rect(-5, -height * 0.76, 10, height * 0.48).fill(accent);
      g.ellipse(-width * 0.18, -height * 0.72, width * 0.24, height * 0.25).fill(color);
      g.ellipse(width * 0.2, -height * 0.67, width * 0.26, height * 0.24).fill({ color, alpha: 0.9 });
      g.ellipse(0, -height * 0.91, width * 0.24, height * 0.24).fill({ color, alpha: 0.82 });
      return;
    }

    if (kind === 'lamp') {
      g.rect(-5, -height * 0.74, 10, height * 0.74).fill(accent);
      g.ellipse(0, 0, width * 0.42, 15).fill(accent);
      g.moveTo(-width / 2, -height * 0.78)
        .lineTo(-width * 0.28, -height)
        .lineTo(width * 0.28, -height)
        .lineTo(width / 2, -height * 0.78)
        .closePath()
        .fill({ color, alpha: 0.96 });
      return;
    }

    g.roundRect(-width / 2, -height, width, height, 14).fill(color);
    g.circle(0, -height * 0.67, width * 0.24).fill({ color: accent, alpha: 0.92 });
    g.circle(0, -height * 0.29, width * 0.32).stroke({ width: 8, color: accent, alpha: 0.85 });
    g.circle(0, -height * 0.29, width * 0.1).fill({ color: accent, alpha: 0.65 });
  }
}

function hex(value: string): number {
  const normalized = value.replace('#', '');
  return Number.parseInt(normalized, 16);
}
