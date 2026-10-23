import { GridCoord, RobotState, TileType } from '../algorithms/types';
import { GridModel } from './gridModel';
import { RobotController } from './robotController';

export interface RenderParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export class AegisRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private tileSize: number = 42;
  private offsetX: number = 0;
  private offsetY: number = 0;

  private particles: RenderParticle[] = [];
  private trailPoints: TrailPoint[] = [];
  private pulsePhase: number = 0;

  public hoverCoord: GridCoord | null = null;
  public highlightedExplored: Set<string> = new Set();
  public highlightedOpen: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  public resize(width: number, height: number, rows: number, cols: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    const pad = 24;
    const availW = width - pad * 2;
    const availH = height - pad * 2;
    const tileW = Math.floor(availW / cols);
    const tileH = Math.floor(availH / rows);
    this.tileSize = Math.max(22, Math.min(68, Math.min(tileW, tileH)));

    this.offsetX = Math.floor((width - cols * this.tileSize) / 2);
    this.offsetY = Math.floor((height - rows * this.tileSize) / 2);
  }

  public screenToGrid(screenX: number, screenY: number, rows: number, cols: number): GridCoord | null {
    const relX = screenX - this.offsetX;
    const relY = screenY - this.offsetY;

    const c = Math.floor(relX / this.tileSize);
    const r = Math.floor(relY / this.tileSize);

    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      return { r, c };
    }
    return null;
  }

  public addDustParticles(r: number, c: number, count: number = 8): void {
    const cx = this.offsetX + c * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + r * this.tileSize + this.tileSize / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 45 + 25;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 1.5,
        color: Math.random() > 0.5 ? '#66DAD5' : '#FF9B83',
        alpha: 0.9,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }

  public addArrivalBurst(r: number, c: number): void {
    const cx = this.offsetX + c * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + r * this.tileSize + this.tileSize / 2;

    const colors = ['#66DAD5', '#86E3B4', '#F5CF79', '#A695F2', '#6FAFFF'];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 100 + 60;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: colors[i % colors.length],
        alpha: 1.0,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
      });
    }
  }

  public render(
    gridModel: GridModel,
    robot: RobotController,
    activePath: GridCoord[],
    deltaSec: number
  ): void {
    const { ctx } = this;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.pulsePhase += deltaSec * 3.2;

    // 1. Deep space background
    ctx.fillStyle = '#17233D';
    ctx.fillRect(0, 0, width, height);

    this.renderEnvironmentBackdrop(width, height);

    const { rows, cols } = gridModel;
    const boardW = cols * this.tileSize;
    const boardH = rows * this.tileSize;

    // 2. Board Frame with Elevated Plate & Inset Glow
    ctx.save();
    // Shadow under the entire board
    ctx.fillStyle = '#131C31';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 12);
    ctx.fill();

    // Outer metal border bevel
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#2B3B5B';
    ctx.lineWidth = 2;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 12);
    ctx.stroke();
    ctx.restore();

    // 3. Render Floor Tiles with Inset Grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.offsetX + c * this.tileSize;
        const y = this.offsetY + r * this.tileSize;
        const tileType = gridModel.tiles[r][c];
        const key = `${r},${c}`;

        this.renderTile(x, y, tileType, key);
      }
    }

    // 4. Render Wall Drop Shadows for 2.5D Depth
    this.renderWallShadows(gridModel);

    // 5. Render Confirmed Path Ribbon
    if (activePath.length > 1) {
      this.renderPathRibbon(activePath);
    }

    // 6. Render Hover Cell Indicator
    if (this.hoverCoord) {
      const hx = this.offsetX + this.hoverCoord.c * this.tileSize;
      const hy = this.offsetY + this.hoverCoord.r * this.tileSize;
      ctx.save();
      ctx.strokeStyle = '#66DAD5';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(102, 218, 213, 0.16)';
      this.roundRect(hx + 2, hy + 2, this.tileSize - 4, this.tileSize - 4, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 7. Render Start Pad & Target Distress Beacon
    this.renderStartPad(gridModel.start);
    this.renderTargetBeacon(gridModel.target);

    // 8. Update & Render Robot Motion Trail
    this.updateAndRenderTrail(robot, deltaSec);

    // 9. Render Robot Character ("Aegis-1")
    this.renderRobot(robot);

    // 10. Update & Render Particle Systems
    this.updateAndRenderParticles(deltaSec);
  }

  private renderEnvironmentBackdrop(w: number, h: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(43, 59, 91, 0.2)';
    ctx.lineWidth = 1;

    const step = 44;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderTile(
    x: number,
    y: number,
    tileType: TileType,
    key: string
  ): void {
    const { ctx, tileSize } = this;
    const pad = 1.5;
    const tw = tileSize - pad * 2;
    const th = tileSize - pad * 2;

    ctx.save();

    // Base floor cell styling
    let fill = '#1F2C47';
    let stroke = 'rgba(43, 59, 91, 0.5)';

    // Search exploration highlights
    if (this.highlightedExplored.has(key)) {
      fill = 'rgba(166, 149, 242, 0.25)';
      stroke = 'rgba(166, 149, 242, 0.55)';
    } else if (this.highlightedOpen.has(key)) {
      fill = 'rgba(102, 218, 213, 0.28)';
      stroke = 'rgba(102, 218, 213, 0.75)';
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    this.roundRect(x + pad, y + pad, tw, th, 4);
    ctx.fill();
    ctx.stroke();

    // Specific Tile Overlays
    if (tileType === 'WALL' || tileType === 'DEBRIS') {
      // 3D Beveled Obstacle Block
      // Bottom shadow / base plate
      ctx.fillStyle = '#141D2E';
      this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 4);
      ctx.fill();

      // Top raised face
      const grad = ctx.createLinearGradient(x, y, x, y + th);
      grad.addColorStop(0, '#3A507A');
      grad.addColorStop(0.5, '#2B3C5C');
      grad.addColorStop(1, '#1E2A42');
      ctx.fillStyle = grad;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
      ctx.fill();

      // Top edge metallic specular rim
      ctx.strokeStyle = '#5A75A8';
      ctx.lineWidth = 1;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
      ctx.stroke();

      // Hazard hazard stripe indicator in center
      ctx.fillStyle = 'rgba(255, 155, 131, 0.8)';
      ctx.fillRect(x + tw / 2 - 4, y + th / 2 - 3, 8, 3);
    } else if (tileType === 'ROUGH_TERRAIN') {
      // High-friction crystalline field
      ctx.fillStyle = 'rgba(245, 207, 121, 0.18)';
      this.roundRect(x + pad, y + pad, tw, th, 4);
      ctx.fill();

      // Glowing crystal shard polygons
      ctx.fillStyle = '#F5CF79';
      ctx.shadowColor = 'rgba(245, 207, 121, 0.4)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(x + tw * 0.5, y + th * 0.2);
      ctx.lineTo(x + tw * 0.75, y + th * 0.7);
      ctx.lineTo(x + tw * 0.25, y + th * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private renderWallShadows(gridModel: GridModel): void {
    const { ctx, tileSize } = this;
    const { rows, cols } = gridModel;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gridModel.tiles[r][c] === 'WALL' || gridModel.tiles[r][c] === 'DEBRIS') {
          // Cast shadow onto tile below if it is open
          if (r + 1 < rows && gridModel.tiles[r + 1][c] !== 'WALL') {
            const sx = this.offsetX + c * tileSize;
            const sy = this.offsetY + (r + 1) * tileSize;
            ctx.fillRect(sx + 2, sy + 1, tileSize - 4, 6);
          }
        }
      }
    }
    ctx.restore();
  }

  private renderPathRibbon(path: GridCoord[]): void {
    const { ctx, tileSize } = this;
    ctx.save();

    // Outer soft glow
    ctx.strokeStyle = 'rgba(102, 218, 213, 0.28)';
    ctx.lineWidth = Math.max(6, tileSize * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = this.offsetX + path[i].c * tileSize + tileSize / 2;
      const py = this.offsetY + path[i].r * tileSize + tileSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Inner bright laser ribbon with forward pulse
    ctx.strokeStyle = '#66DAD5';
    ctx.lineWidth = Math.max(2.5, tileSize * 0.1);
    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = -this.pulsePhase * 18;
    ctx.stroke();

    // Waypoint connection nodes
    ctx.setLineDash([]);
    ctx.fillStyle = '#F5F7FF';
    for (let i = 1; i < path.length - 1; i++) {
      const px = this.offsetX + path[i].c * tileSize + tileSize / 2;
      const py = this.offsetY + path[i].r * tileSize + tileSize / 2;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderStartPad(coord: GridCoord): void {
    const { ctx, tileSize } = this;
    const cx = this.offsetX + coord.c * tileSize + tileSize / 2;
    const cy = this.offsetY + coord.r * tileSize + tileSize / 2;
    const r = Math.max(1, tileSize * 0.35);

    ctx.save();
    // Glowing base ring
    ctx.strokeStyle = '#6FAFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating launch brackets
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.pulsePhase * 0.6);
    ctx.strokeStyle = 'rgba(111, 175, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 0.4);
    ctx.arc(0, 0, r + 4, Math.PI, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private renderTargetBeacon(coord: GridCoord): void {
    const { ctx, tileSize } = this;
    const cx = this.offsetX + coord.c * tileSize + tileSize / 2;
    const cy = this.offsetY + coord.r * tileSize + tileSize / 2;
    const pulse = (Math.sin(this.pulsePhase) + 1) * 0.5;

    ctx.save();
    // Expanding radar waves
    const maxR = Math.max(1, tileSize * 0.52);
    const curR = Math.max(0.1, (Math.abs(this.pulsePhase) * 9) % maxR);
    ctx.strokeStyle = `rgba(134, 227, 180, ${Math.max(0, 1 - curR / maxR)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, curR, 0, Math.PI * 2);
    ctx.stroke();

    // Core holographic distress beacon
    ctx.fillStyle = '#86E3B4';
    ctx.shadowColor = 'rgba(134, 227, 180, 0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, 6 + pulse * 2.5), 0, Math.PI * 2);
    ctx.fill();

    // Tactical crosshairs
    ctx.strokeStyle = 'rgba(134, 227, 180, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    ctx.restore();
  }

  private updateAndRenderTrail(robot: RobotController, deltaSec: number): void {
    const { ctx, tileSize } = this;
    const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
    const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;

    if (robot.state === 'MOVING') {
      this.trailPoints.push({ x: rx, y: ry, alpha: 0.5 });
    }

    ctx.save();
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      const pt = this.trailPoints[i];
      pt.alpha -= deltaSec * 1.5;
      if (pt.alpha <= 0) {
        this.trailPoints.splice(i, 1);
        continue;
      }

      ctx.fillStyle = '#66DAD5';
      ctx.globalAlpha = Math.max(0, pt.alpha * 0.35);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, tileSize * 0.22 * pt.alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderRobot(robot: RobotController): void {
    const { ctx, tileSize } = this;
    const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
    const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;
    const radius = tileSize * 0.38;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(robot.visualAngle);

    // 1. Directional Forward Sensor Beam Cone
    if (robot.state === 'MOVING' || robot.state === 'SCANNING' || robot.state === 'CONFIRMED') {
      const coneGrad = ctx.createRadialGradient(0, 0, 4, tileSize * 0.8, 0, tileSize * 1.5);
      coneGrad.addColorStop(0, 'rgba(102, 218, 213, 0.4)');
      coneGrad.addColorStop(1, 'rgba(102, 218, 213, 0.0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(0.1, tileSize * 1.5), -Math.PI * 0.22, Math.PI * 0.22);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Thruster Particle Exhaust Emitter
    if (robot.state === 'MOVING' && Math.random() < 0.65) {
      this.particles.push({
        x: rx - Math.cos(robot.visualAngle) * (radius * 0.85),
        y: ry - Math.sin(robot.visualAngle) * (radius * 0.85),
        vx: -Math.cos(robot.visualAngle + (Math.random() - 0.5) * 0.4) * 38,
        vy: -Math.sin(robot.visualAngle + (Math.random() - 0.5) * 0.4) * 38,
        size: Math.random() * 2.8 + 1.2,
        color: '#66DAD5',
        alpha: 0.95,
        life: 0,
        maxLife: 0.26,
      });
    }

    // 3. Side Tread Pods
    ctx.fillStyle = '#18243A';
    this.roundRect(-radius * 0.95, -radius * 0.95, radius * 1.9, radius * 0.35, 3);
    this.roundRect(-radius * 0.95, radius * 0.6, radius * 1.9, radius * 0.35, 3);
    ctx.fill();

    // 4. Rounded Mechanical Chassis
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    const hullGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    hullGrad.addColorStop(0, '#4B6291');
    hullGrad.addColorStop(0.5, '#2D3E61');
    hullGrad.addColorStop(1, '#1E2B45');
    ctx.fillStyle = hullGrad;

    this.roundRect(-radius, -radius * 0.75, radius * 2, radius * 1.5, radius * 0.45);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Metal rim highlight
    ctx.strokeStyle = '#6FAFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5. Directional Front Visor & Cyan Sensor Eye
    const visorGrad = ctx.createLinearGradient(0, -radius * 0.5, radius * 0.9, radius * 0.5);
    visorGrad.addColorStop(0, '#0F1A2C');
    visorGrad.addColorStop(1, '#1A2944');
    ctx.fillStyle = visorGrad;
    this.roundRect(radius * 0.1, -radius * 0.5, radius * 0.8, radius * 1.0, 4);
    ctx.fill();

    const eyeColor = robot.state === 'BLOCKED' ? '#FF9B83' : '#66DAD5';
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(radius * 0.55, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Center Energy Core
    const corePulse = (Math.sin(this.pulsePhase * 2.5) + 1) * 0.5;
    ctx.fillStyle = '#66DAD5';
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, Math.max(0.1, 3.2 + corePulse * 1.6), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 7. Alert Badge when Blocked / Replanning
    if (robot.state === 'BLOCKED' || robot.state === 'REPLANNING') {
      ctx.save();
      const badgeY = ry - radius - 16;
      ctx.fillStyle = '#FF9B83';
      ctx.shadowColor = 'rgba(255, 155, 131, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(rx, badgeY, 9.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#17233D';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', rx, badgeY);
      ctx.restore();
    }
  }

  private updateAndRenderParticles(deltaSec: number): void {
    const { ctx } = this;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaSec;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * deltaSec;
      p.y += p.vy * deltaSec;
      const progress = p.life / p.maxLife;
      const alpha = p.alpha * (1 - progress);

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
