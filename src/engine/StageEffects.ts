import { Container, Graphics } from 'pixi.js';

type Particle = {
  view: Graphics;
  age: number;
  lifetime: number;
  vx: number;
  vy: number;
  gravity: number;
  spin: number;
};

export class StageEffects {
  readonly container = new Container();
  private readonly particles: Particle[] = [];

  constructor() {
    this.container.label = 'idol-effects';
    this.container.zIndex = 500;
    this.container.eventMode = 'none';
  }

  heartBurst(x = 512, y = 330): void {
    const colors = [0xff5d9e, 0xff8fc1, 0xffffff, 0x8fe9ff];
    for (let index = 0; index < 14; index += 1) {
      const angle = (-Math.PI * 0.85) + (Math.PI * 0.7 * index) / 13;
      const speed = 115 + Math.random() * 105;
      const size = 9 + Math.random() * 10;
      const view = this.drawHeart(colors[index % colors.length], size);
      view.position.set(x + (Math.random() - 0.5) * 70, y + Math.random() * 45);
      view.rotation = (Math.random() - 0.5) * 0.55;
      this.container.addChild(view);
      this.particles.push({
        view,
        age: 0,
        lifetime: 950 + Math.random() * 650,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        gravity: 105,
        spin: (Math.random() - 0.5) * 1.8,
      });
    }
    this.addRing(x, y + 35, 0xff8fc1);
  }

  sparkleBurst(x = 512, y = 360): void {
    const colors = [0xffffff, 0x9cecff, 0xffd5ea];
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const speed = 80 + Math.random() * 75;
      const view = this.drawSparkle(colors[index % colors.length], 7 + Math.random() * 8);
      view.position.set(x, y);
      this.container.addChild(view);
      this.particles.push({
        view,
        age: 0,
        lifetime: 650 + Math.random() * 400,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 10,
        spin: 2.4,
      });
    }
  }

  update(deltaMS: number): void {
    const seconds = deltaMS / 1000;
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += deltaMS;
      const progress = Math.min(1, particle.age / particle.lifetime);
      particle.vy += particle.gravity * seconds;
      particle.view.x += particle.vx * seconds;
      particle.view.y += particle.vy * seconds;
      particle.view.rotation += particle.spin * seconds;
      particle.view.alpha = progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28;
      const scale = 0.72 + Math.sin(progress * Math.PI) * 0.38;
      particle.view.scale.set(scale);
      if (progress >= 1) {
        particle.view.destroy();
        this.particles.splice(index, 1);
      }
    }
  }

  destroy(): void {
    this.particles.length = 0;
    this.container.destroy({ children: true });
  }

  private addRing(x: number, y: number, color: number): void {
    const view = new Graphics().circle(0, 0, 42).stroke({ color, width: 5, alpha: 0.8 });
    view.position.set(x, y);
    this.container.addChild(view);
    this.particles.push({
      view,
      age: 0,
      lifetime: 620,
      vx: 0,
      vy: 0,
      gravity: 0,
      spin: 0,
    });
  }

  private drawHeart(color: number, size: number): Graphics {
    return new Graphics()
      .moveTo(0, size * 0.82)
      .bezierCurveTo(-size * 1.25, size * 0.05, -size * 0.9, -size, 0, -size * 0.38)
      .bezierCurveTo(size * 0.9, -size, size * 1.25, size * 0.05, 0, size * 0.82)
      .fill({ color, alpha: 0.96 });
  }

  private drawSparkle(color: number, size: number): Graphics {
    return new Graphics()
      .moveTo(0, -size)
      .lineTo(size * 0.3, -size * 0.3)
      .lineTo(size, 0)
      .lineTo(size * 0.3, size * 0.3)
      .lineTo(0, size)
      .lineTo(-size * 0.3, size * 0.3)
      .lineTo(-size, 0)
      .lineTo(-size * 0.3, -size * 0.3)
      .closePath()
      .fill({ color, alpha: 0.95 });
  }
}
