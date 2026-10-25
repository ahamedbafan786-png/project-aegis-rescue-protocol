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

export interface ReplanShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export type SectorTheme = 'training' | 'facility' | 'canyon' | 'maze' | 'presentation';

export class AegisRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private tileSize: number = 42;
  private offsetX: number = 0;
  private offsetY: number = 0;

  private particles: RenderParticle[] = [];
  private trailPoints: TrailPoint[] = [];
  private pulsePhase: number = 0;

  // Replanning visual storytelling
  private shockwaves: ReplanShockwave[] = [];
  private invalidatedPath: GridCoord[] = [];
  private invalidatedAlpha: number = 0;
  private scannerCenter: { x: number; y: number } | null = null;
  private scannerRadius: number = 0;
  private scannerMaxRadius: number = 0;

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

    const pad = width < 600 || height < 500 ? 10 : 20;
    const availW = Math.max(width - pad * 2, 40);
    const availH = Math.max(height - pad * 2, 40);
    const tileW = Math.floor(availW / cols);
    const tileH = Math.floor(availH / rows);
    this.tileSize = Math.max(10, Math.min(68, Math.min(tileW, tileH)));

    this.offsetX = Math.max(0, Math.floor((width - cols * this.tileSize) / 2));
    this.offsetY = Math.max(0, Math.floor((height - rows * this.tileSize) / 2));
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

  public addDustParticles(r: number, c: number, count: number = 10): void {
    const cx = this.offsetX + c * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + r * this.tileSize + this.tileSize / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 55 + 25;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 1.5,
        color: Math.random() > 0.4 ? '#FF9B83' : '#F5CF79',
        alpha: 0.95,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.35,
      });
    }
  }

  public addArrivalBurst(r: number, c: number): void {
    const cx = this.offsetX + c * this.tileSize + this.tileSize / 2;
    const cy = this.offsetY + r * this.tileSize + this.tileSize / 2;

    const colors = ['#66DAD5', '#86E3B4', '#F5CF79', '#A695F2', '#6FAFFF'];
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 120 + 60;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: colors[i % colors.length],
        alpha: 1.0,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.4,
      });
    }
  }

  /**
   * Triggers the multi-stage dynamic replanning storytelling sequence
   */
  public triggerBlockageVisual(
    blockedCoord: GridCoord,
    previousPath: GridCoord[],
    robotLogical?: GridCoord
  ): void {
    const bx = this.offsetX + blockedCoord.c * this.tileSize + this.tileSize / 2;
    const by = this.offsetY + blockedCoord.r * this.tileSize + this.tileSize / 2;

    // 1. Red warning shockwave at blockage cell
    this.shockwaves.push({
      x: bx,
      y: by,
      radius: 4,
      maxRadius: this.tileSize * 2.8,
      alpha: 1.0,
    });

    // 2. Preserve invalidated remainder of previous route
    if (previousPath && previousPath.length > 0) {
      this.invalidatedPath = [...previousPath];
      this.invalidatedAlpha = 1.0;
    }

    // 3. Initiate outward radar scanning wave from robot position
    if (robotLogical) {
      const rx = this.offsetX + robotLogical.c * this.tileSize + this.tileSize / 2;
      const ry = this.offsetY + robotLogical.r * this.tileSize + this.tileSize / 2;
      this.scannerCenter = { x: rx, y: ry };
      this.scannerRadius = 4;
      this.scannerMaxRadius = this.tileSize * 14;
    }
  }

  /**
   * Resets all visual effects, shockwaves, invalidated path, and particles on simulation reset.
   */
  public resetVisualEffects(): void {
    this.particles = [];
    this.trailPoints = [];
    this.shockwaves = [];
    this.invalidatedPath = [];
    this.invalidatedAlpha = 0;
    this.scannerCenter = null;
    this.scannerRadius = 0;
    this.scannerMaxRadius = 0;
    this.highlightedExplored.clear();
    this.highlightedOpen.clear();
  }

  public render(
    gridModel: GridModel,
    robot: RobotController,
    activePath: GridCoord[],
    deltaSec: number,
    theme: SectorTheme = 'training'
  ): void {
    const { ctx } = this;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    this.pulsePhase += deltaSec * 3.2;

    // 1. Sector Backdrop
    this.renderEnvironmentBackdrop(width, height, theme);

    const { rows, cols } = gridModel;
    const boardW = cols * this.tileSize;
    const boardH = rows * this.tileSize;

    // 2. Elevated Simulation Deck Plate
    ctx.save();
    ctx.fillStyle = theme === 'facility' ? '#121A2B' : theme === 'canyon' ? '#181427' : '#141D33';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 14);
    ctx.fill();

    // Outer metal border bevel with theme accent
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle =
      theme === 'facility'
        ? '#3A4E73'
        : theme === 'canyon'
        ? '#4E3A6B'
        : theme === 'maze'
        ? '#33486E'
        : '#2B3B5B';
    ctx.lineWidth = 2.5;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 14);
    ctx.stroke();
    ctx.restore();

    // 3. Render Floor Tiles with Inset Grid & Sector Identity
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.offsetX + c * this.tileSize;
        const y = this.offsetY + r * this.tileSize;
        const tileType = gridModel.tiles[r][c];
        const key = `${r},${c}`;

        this.renderTile(x, y, tileType, key, theme);
      }
    }

    // 4. Render Wall Shadows for 2.5D Depth
    this.renderWallShadows(gridModel);

    // 5. Replanning Storytelling: Invalidate Old Path
    if (this.invalidatedAlpha > 0 && this.invalidatedPath.length > 1) {
      this.renderInvalidatedPath(deltaSec);
    }

    // 6. Replanning Storytelling: Outward Scanning Wave
    if (this.scannerCenter) {
      this.renderScannerWave(deltaSec);
    }

    // 7. Render Active Confirmed Path Laser Ribbon
    if (activePath.length > 1) {
      this.renderPathRibbon(activePath);
    }

    // 8. Replanning Storytelling: Blockage Shockwave Rings
    this.updateAndRenderShockwaves(deltaSec);

    // 9. Render Hover Cell Indicator
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

    // 10. Render Start Pad & Cryo-Stasis Rescue Pod
    this.renderStartPad(gridModel.start, theme);
    this.renderRescuePod(gridModel.target, robot);

    // Dynamic arrival sparkles when survivor is secured
    if (robot.state === 'ARRIVED' && Math.random() < 0.28) {
      const tcx = this.offsetX + gridModel.target.c * this.tileSize + this.tileSize / 2;
      const tcy = this.offsetY + gridModel.target.r * this.tileSize + this.tileSize / 2;
      this.particles.push({
        x: tcx + (Math.random() - 0.5) * this.tileSize * 0.7,
        y: tcy + (Math.random() - 0.5) * this.tileSize * 0.7,
        vx: (Math.random() - 0.5) * 18,
        vy: -Math.random() * 36 - 16,
        size: Math.random() * 2.8 + 1.2,
        color: '#86E3B4',
        alpha: 0.95,
        life: 0,
        maxLife: 0.8,
      });
    }

    // Ambient sector atmosphere particles (crystal dust, sparks, or cyber motes)
    if (this.particles.length < 24 && Math.random() < 0.12) {
      const px = this.offsetX + Math.random() * (gridModel.cols * this.tileSize);
      const py = this.offsetY + Math.random() * (gridModel.rows * this.tileSize);
      if (theme === 'canyon') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 12 - 4,
          size: Math.random() * 2.2 + 0.8,
          color: Math.random() > 0.5 ? '#A695F2' : '#C7BAFF',
          alpha: 0.65,
          life: 0,
          maxLife: 1.8,
        });
      } else if (theme === 'facility') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 14,
          vy: Math.random() * 22 + 8,
          size: Math.random() * 1.8 + 0.8,
          color: Math.random() > 0.6 ? '#F5CF79' : '#FF9B83',
          alpha: 0.75,
          life: 0,
          maxLife: 0.9,
        });
      } else if (theme === 'maze') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 10 - 2,
          size: Math.random() * 1.8 + 0.8,
          color: '#66DAD5',
          alpha: 0.55,
          life: 0,
          maxLife: 1.5,
        });
      }
    }

    // 11. Update & Render Robot Motion Trail
    this.updateAndRenderTrail(robot, deltaSec);

    // 12. Render Hero Robot Character ("Aegis-1")
    this.renderRobot(robot);

    // 13. Update & Render Particle Systems
    this.updateAndRenderParticles(deltaSec);
  }

  private renderEnvironmentBackdrop(w: number, h: number, theme: SectorTheme): void {
    const { ctx } = this;
    ctx.save();

    // Deep theme-specific room tone
    const bgFill =
      theme === 'facility'
        ? '#131926'
        : theme === 'canyon'
        ? '#191526'
        : theme === 'maze'
        ? '#0D1524'
        : '#151F36';
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, w, h);

    if (theme === 'training') {
      // High-tech training proving ground grid with laser guides
      ctx.strokeStyle = 'rgba(102, 218, 213, 0.08)';
      ctx.lineWidth = 1;
      const step = 42;
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
      // Proving ground corner calibration marks
      ctx.strokeStyle = 'rgba(111, 175, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, 32, 32);
      ctx.strokeRect(w - 48, 16, 32, 32);
      ctx.strokeRect(16, h - 48, 32, 32);
      ctx.strokeRect(w - 48, h - 48, 32, 32);
    } else if (theme === 'facility') {
      // Collapsed facility: structural sub-grid & amber caution gridlines
      ctx.strokeStyle = 'rgba(245, 207, 121, 0.07)';
      ctx.lineWidth = 1;
      const step = 48;
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
      // Diagonal hazard stripes on upper/lower perimeter
      ctx.fillStyle = 'rgba(245, 207, 121, 0.05)';
      for (let x = -h; x < w + h; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 12, 0);
        ctx.lineTo(x + 12 - 20, 20);
        ctx.lineTo(x - 20, 20);
        ctx.closePath();
        ctx.fill();
      }
    } else if (theme === 'canyon') {
      // Amethyst mineral canyon: organic geological strata bands
      ctx.strokeStyle = 'rgba(166, 149, 242, 0.08)';
      ctx.lineWidth = 1.2;
      for (let y = 30; y < h; y += 54) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y - 12, w * 0.7, y + 14, w, y);
        ctx.stroke();
      }
    } else if (theme === 'maze') {
      // Mainframe labyrinth: pulsing cybernetic data bus traces
      ctx.strokeStyle = 'rgba(111, 175, 255, 0.09)';
      ctx.lineWidth = 1;
      const step = 36;
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
      // Glowing data bus junction circles
      ctx.fillStyle = 'rgba(102, 218, 213, 0.14)';
      for (let x = step * 2; x < w; x += step * 4) {
        for (let y = step * 2; y < h; y += step * 4) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Default / presentation grid
      ctx.strokeStyle = 'rgba(102, 218, 213, 0.07)';
      ctx.lineWidth = 1;
      const step = 48;
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
    }

    ctx.restore();
  }

  private renderTile(
    x: number,
    y: number,
    tileType: TileType,
    key: string,
    theme: SectorTheme
  ): void {
    const { ctx, tileSize } = this;
    const pad = 1.5;
    const tw = tileSize - pad * 2;
    const th = tileSize - pad * 2;

    ctx.save();

    // Base floor cell styling
    let fill =
      theme === 'facility'
        ? '#192236'
        : theme === 'canyon'
        ? '#211C33'
        : theme === 'maze'
        ? '#162238'
        : '#1D2A45';
    let stroke =
      theme === 'facility'
        ? 'rgba(58, 78, 115, 0.6)'
        : theme === 'canyon'
        ? 'rgba(78, 58, 107, 0.6)'
        : 'rgba(43, 59, 91, 0.6)';

    // Search exploration highlights
    if (this.highlightedExplored.has(key)) {
      fill = 'rgba(166, 149, 242, 0.28)';
      stroke = 'rgba(166, 149, 242, 0.65)';
    } else if (this.highlightedOpen.has(key)) {
      fill = 'rgba(102, 218, 213, 0.3)';
      stroke = 'rgba(102, 218, 213, 0.8)';
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    this.roundRect(x + pad, y + pad, tw, th, 4);
    ctx.fill();
    ctx.stroke();

    // Theme-specific decorative floor accents
    if (theme === 'facility') {
      // Corner rivet dots
      ctx.fillStyle = 'rgba(161, 173, 199, 0.35)';
      ctx.fillRect(x + pad + 2, y + pad + 2, 2, 2);
      ctx.fillRect(x + pad + tw - 4, y + pad + 2, 2, 2);
      ctx.fillRect(x + pad + 2, y + pad + th - 4, 2, 2);
      ctx.fillRect(x + pad + tw - 4, y + pad + th - 4, 2, 2);
    } else if (theme === 'maze') {
      // Micro circuit connector cross
      ctx.fillStyle = 'rgba(102, 218, 213, 0.15)';
      ctx.fillRect(x + pad + tw / 2 - 1, y + pad + th / 2 - 1, 2, 2);
    }

    // Specific Tile Overlays
    if (tileType === 'WALL') {
      // Reinforced Solid Bulkhead Obstacle
      ctx.fillStyle = '#0F1624';
      this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 4);
      ctx.fill();

      // Top raised face
      const grad = ctx.createLinearGradient(x, y, x, y + th);
      if (theme === 'canyon') {
        grad.addColorStop(0, '#423359');
        grad.addColorStop(0.5, '#2D2340');
        grad.addColorStop(1, '#1A1426');
      } else if (theme === 'facility') {
        grad.addColorStop(0, '#364966');
        grad.addColorStop(0.5, '#25344D');
        grad.addColorStop(1, '#172233');
      } else {
        grad.addColorStop(0, '#3A507A');
        grad.addColorStop(0.5, '#2B3C5C');
        grad.addColorStop(1, '#1E2A42');
      }

      ctx.fillStyle = grad;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
      ctx.fill();

      // Top edge metallic specular rim
      ctx.strokeStyle = theme === 'canyon' ? '#6E5594' : '#5A75A8';
      ctx.lineWidth = 1;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
      ctx.stroke();

      // Hazard stripe or crystal vein indicator
      if (theme === 'facility') {
        ctx.fillStyle = 'rgba(245, 207, 121, 0.85)';
        ctx.fillRect(x + tw / 2 - 5, y + th / 2 - 4, 10, 3);
      } else if (theme === 'canyon') {
        ctx.fillStyle = '#A695F2';
        ctx.shadowColor = '#A695F2';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x + tw / 2, y + th / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255, 155, 131, 0.85)';
        ctx.fillRect(x + tw / 2 - 5, y + th / 2 - 4, 10, 3);
      }
    } else if (tileType === 'DEBRIS') {
      // Interactive Collapsed Debris (Destructible via Emergency Repair Charges)
      ctx.fillStyle = '#111724';
      this.roundRect(x + pad + 1, y + pad + 3, tw - 2, th - 2, 3);
      ctx.fill();

      // Fractured rubble chunks
      const rubbleGrad = ctx.createLinearGradient(x, y, x + tw, y + th);
      rubbleGrad.addColorStop(0, '#5A463B');
      rubbleGrad.addColorStop(0.5, '#3D2F28');
      rubbleGrad.addColorStop(1, '#241B16');
      ctx.fillStyle = rubbleGrad;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 4, 3);
      ctx.fill();

      // Jagged fracture cracks
      ctx.strokeStyle = 'rgba(245, 207, 121, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + pad + 3, y + pad + th * 0.4);
      ctx.lineTo(x + pad + tw * 0.45, y + pad + th * 0.55);
      ctx.lineTo(x + pad + tw * 0.55, y + pad + th * 0.35);
      ctx.lineTo(x + pad + tw - 3, y + pad + th * 0.65);
      ctx.stroke();

      // Exposed structural rebar studs
      ctx.fillStyle = '#FF9B83';
      ctx.fillRect(x + pad + 5, y + pad + 5, 3, 3);
      ctx.fillRect(x + pad + tw - 8, y + pad + th - 8, 3, 3);

      // Interactive demolition target crosshair indicator (pulse)
      const debrisPulse = (Math.sin(this.pulsePhase * 3.5) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 155, 131, ${0.4 + debrisPulse * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cx = x + tw / 2;
      const cy = y + th / 2;
      ctx.arc(cx, cy, Math.max(2, tw * 0.22), 0, Math.PI * 2);
      ctx.stroke();
    } else if (tileType === 'ROUGH_TERRAIN') {
      // High-friction crystalline field
      ctx.fillStyle =
        theme === 'canyon' ? 'rgba(166, 149, 242, 0.22)' : 'rgba(245, 207, 121, 0.2)';
      this.roundRect(x + pad, y + pad, tw, th, 4);
      ctx.fill();

      // Glowing crystal shards
      ctx.fillStyle = theme === 'canyon' ? '#A695F2' : '#F5CF79';
      ctx.shadowColor = theme === 'canyon' ? 'rgba(166, 149, 242, 0.6)' : 'rgba(245, 207, 121, 0.6)';
      ctx.shadowBlur = 5;

      // Draw cluster of 3 crystal shard spikes
      ctx.beginPath();
      ctx.moveTo(x + tw * 0.45, y + th * 0.18);
      ctx.lineTo(x + tw * 0.65, y + th * 0.72);
      ctx.lineTo(x + tw * 0.25, y + th * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + tw * 0.72, y + th * 0.35);
      ctx.lineTo(x + tw * 0.88, y + th * 0.75);
      ctx.lineTo(x + tw * 0.58, y + th * 0.75);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gridModel.tiles[r][c] === 'WALL' || gridModel.tiles[r][c] === 'DEBRIS') {
          // Cast shadow onto tile below if open
          if (r + 1 < rows && gridModel.tiles[r + 1][c] !== 'WALL') {
            const sx = this.offsetX + c * tileSize;
            const sy = this.offsetY + (r + 1) * tileSize;
            ctx.fillRect(sx + 2, sy + 1, tileSize - 4, 7);
          }
        }
      }
    }
    ctx.restore();
  }

  private renderInvalidatedPath(deltaSec: number): void {
    const { ctx, tileSize } = this;
    ctx.save();

    ctx.strokeStyle = `rgba(255, 110, 90, ${this.invalidatedAlpha * 0.75})`;
    ctx.lineWidth = Math.max(3, tileSize * 0.12);
    ctx.setLineDash([6, 5]);
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < this.invalidatedPath.length; i++) {
      const px = this.offsetX + this.invalidatedPath[i].c * tileSize + tileSize / 2;
      const py = this.offsetY + this.invalidatedPath[i].r * tileSize + tileSize / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw red cancellation crosses on invalidated waypoints
    ctx.strokeStyle = `rgba(255, 90, 70, ${this.invalidatedAlpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    for (const pt of this.invalidatedPath) {
      const px = this.offsetX + pt.c * tileSize + tileSize / 2;
      const py = this.offsetY + pt.r * tileSize + tileSize / 2;
      const crossSize = 3.5;
      ctx.beginPath();
      ctx.moveTo(px - crossSize, py - crossSize);
      ctx.lineTo(px + crossSize, py + crossSize);
      ctx.moveTo(px + crossSize, py - crossSize);
      ctx.lineTo(px - crossSize, py + crossSize);
      ctx.stroke();
    }

    this.invalidatedAlpha = Math.max(0, this.invalidatedAlpha - deltaSec * 0.45);
    ctx.restore();
  }

  private renderScannerWave(deltaSec: number): void {
    if (!this.scannerCenter) return;
    const { ctx } = this;

    this.scannerRadius += deltaSec * 320;
    if (this.scannerRadius >= this.scannerMaxRadius) {
      this.scannerCenter = null;
      return;
    }

    const progress = this.scannerRadius / this.scannerMaxRadius;
    const alpha = Math.max(0, 1.0 - progress);

    ctx.save();
    ctx.strokeStyle = `rgba(102, 218, 213, ${alpha * 0.7})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.scannerCenter.x, this.scannerCenter.y, Math.max(0.1, this.scannerRadius), 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(245, 207, 121, ${alpha * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.scannerCenter.x, this.scannerCenter.y, Math.max(0.1, this.scannerRadius * 0.65), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private updateAndRenderShockwaves(deltaSec: number): void {
    const { ctx } = this;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += deltaSec * 85;
      sw.alpha -= deltaSec * 0.7;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = `rgba(255, 120, 100, ${sw.alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(0.1, sw.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderPathRibbon(path: GridCoord[]): void {
    const { ctx, tileSize } = this;
    ctx.save();

    // Outer soft laser bloom
    ctx.strokeStyle = 'rgba(102, 218, 213, 0.32)';
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
    ctx.lineDashOffset = -this.pulsePhase * 20;
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

  private renderStartPad(coord: GridCoord, theme: SectorTheme): void {
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

  private renderRescuePod(coord: GridCoord, robot: RobotController): void {
    const { ctx, tileSize } = this;
    const cx = this.offsetX + coord.c * tileSize + tileSize / 2;
    const cy = this.offsetY + coord.r * tileSize + tileSize / 2;
    const isArrived = robot.state === 'ARRIVED';
    const pulse = (Math.sin(this.pulsePhase * 2.5) + 1) * 0.5;

    ctx.save();

    // 1. Expanding radar distress transmission pulses
    const maxR = Math.max(1, tileSize * 0.7);
    const curR = Math.max(0.1, (Math.abs(this.pulsePhase) * 12) % maxR);
    ctx.strokeStyle = isArrived
      ? `rgba(134, 227, 180, ${Math.max(0, 0.8 * (1 - curR / maxR))})`
      : `rgba(255, 155, 131, ${Math.max(0, 0.75 * (1 - curR / maxR))})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, curR, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Pod Base Docking Mount (Hexagonal metal plate)
    const baseR = Math.max(4, tileSize * 0.38);
    ctx.fillStyle = '#0F1626';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const bx = cx + Math.cos(angle) * baseR;
      const by = cy + Math.sin(angle) * baseR;
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = isArrived ? '#86E3B4' : '#FF9B83';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Stasis Chamber Capsule (Vertical Pill Silhouette)
    const podW = Math.max(6, tileSize * 0.38);
    const podH = Math.max(10, tileSize * 0.56);
    const podX = cx - podW / 2;
    const podY = cy - podH / 2;

    // Outer Armored Shell
    ctx.fillStyle = '#1B263B';
    this.roundRect(podX, podY, podW, podH, podW * 0.45);
    ctx.fill();
    ctx.strokeStyle = isArrived ? '#86E3B4' : '#6FAFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner Glass Cryo-Chamber
    const glassW = podW * 0.72;
    const glassH = podH * 0.68;
    const glassX = cx - glassW / 2;
    const glassY = cy - glassH / 2 - 1;

    const chamberGrad = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    if (isArrived) {
      chamberGrad.addColorStop(0, '#10382B');
      chamberGrad.addColorStop(0.5, '#1A5944');
      chamberGrad.addColorStop(1, '#0D2B21');
    } else {
      chamberGrad.addColorStop(0, '#122538');
      chamberGrad.addColorStop(0.5, '#183652');
      chamberGrad.addColorStop(1, '#0C1A29');
    }
    ctx.fillStyle = chamberGrad;
    this.roundRect(glassX, glassY, glassW, glassH, glassW * 0.45);
    ctx.fill();

    // 4. Survivor Silhouette & Heartbeat ECG Waveform
    ctx.save();
    ctx.beginPath();
    this.roundRect(glassX, glassY, glassW, glassH, glassW * 0.45);
    ctx.clip();

    // Humanoid silhouette in stasis
    ctx.fillStyle = isArrived ? 'rgba(134, 227, 180, 0.55)' : 'rgba(102, 218, 213, 0.4)';
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - podH * 0.16, Math.max(0.1, podW * 0.16), 0, Math.PI * 2);
    ctx.fill();
    // Torso
    ctx.beginPath();
    ctx.moveTo(cx - podW * 0.22, cy + podH * 0.2);
    ctx.lineTo(cx + podW * 0.22, cy + podH * 0.2);
    ctx.lineTo(cx + podW * 0.14, cy - podH * 0.05);
    ctx.lineTo(cx - podW * 0.14, cy - podH * 0.05);
    ctx.closePath();
    ctx.fill();

    // Heartbeat ECG line across the glass
    const ecgY = cy + podH * 0.05;
    const ecgColor = isArrived ? '#86E3B4' : '#66DAD5';
    ctx.strokeStyle = ecgColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = ecgColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    const ecgW = glassW * 0.9;
    const startX = cx - ecgW / 2;
    ctx.moveTo(startX, ecgY);
    ctx.lineTo(startX + ecgW * 0.35, ecgY);
    ctx.lineTo(startX + ecgW * 0.42, ecgY - 4);
    ctx.lineTo(startX + ecgW * 0.52, ecgY + 5);
    ctx.lineTo(startX + ecgW * 0.6, ecgY - 2);
    ctx.lineTo(startX + ecgW * 0.68, ecgY);
    ctx.lineTo(startX + ecgW, ecgY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Glass reflection specular highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx - podW * 0.2, cy - podH * 0.18, Math.max(0.1, podW * 0.22), -Math.PI * 0.6, -Math.PI * 0.1);
    ctx.stroke();

    // 5. Emergency Beacon Antenna Mast atop Pod
    const mastTopY = podY - podH * 0.22;
    ctx.strokeStyle = '#6FAFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, podY);
    ctx.lineTo(cx, mastTopY);
    ctx.stroke();

    // Strobe Beacon Bulb
    const beaconColor = isArrived ? '#86E3B4' : '#FF9B83';
    ctx.fillStyle = beaconColor;
    ctx.shadowColor = beaconColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, mastTopY, Math.max(1, 2.5 + pulse * 1.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Rescue Arrival Sequence (Containment Beam & Medical Stabilization)
    if (isArrived) {
      // Connective containment laser beam between robot and cryo-pod
      const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
      const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;

      ctx.save();
      ctx.strokeStyle = 'rgba(134, 227, 180, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.strokeStyle = '#86E3B4';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.pulsePhase * 16;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Floating Medical Cross Icon rising above pod
      const badgeY = mastTopY - 14 - Math.sin(this.pulsePhase * 3) * 3;
      ctx.save();
      ctx.fillStyle = '#86E3B4';
      ctx.shadowColor = 'rgba(134, 227, 180, 0.9)';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✚', cx, badgeY);

      // Status banner: +1 SURVIVOR SECURED
      ctx.font = 'bold 10px monospace';
      ctx.fillText('+1 SURVIVOR SECURED', cx, badgeY - 11);
      ctx.restore();

      // Pulsing docking energy ring on deck plate
      ctx.strokeStyle = `rgba(134, 227, 180, ${Math.max(0, 0.35 + Math.sin(this.pulsePhase * 4) * 0.25)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR + 6 + Math.sin(this.pulsePhase * 3) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private updateAndRenderTrail(robot: RobotController, deltaSec: number): void {
    const { ctx, tileSize } = this;
    const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
    const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;

    if (robot.state === 'MOVING') {
      this.trailPoints.push({ x: rx, y: ry, alpha: 0.55 });
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
      ctx.arc(pt.x, pt.y, Math.max(0.1, tileSize * 0.22 * pt.alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Hero character rendering for Aegis-1
   * Hexagonal armored silhouette, cycling tread tracks, sweeping scanner eye,
   * dual volumetric headlights, and ion thruster particle exhaust.
   */
  private renderRobot(robot: RobotController): void {
    const { ctx, tileSize } = this;
    const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
    const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;
    const radius = tileSize * 0.38;

    // Idle breathing animation
    const breathScale =
      robot.state === 'IDLE' || robot.state === 'CONFIRMED'
        ? 1.0 + Math.sin(this.pulsePhase * 2.5) * 0.03
        : 1.0;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(robot.visualAngle);
    ctx.scale(breathScale, breathScale);

    // 1. Dual Forward Volumetric Headlight Beams (Left & Right Fender Projectors)
    if (robot.state === 'MOVING' || robot.state === 'CONFIRMED' || robot.state === 'BLOCKED') {
      const headlightLength = Math.max(0.1, tileSize * 1.7);
      const isBlocked = robot.state === 'BLOCKED';
      const beamColor = isBlocked ? 'rgba(255, 155, 131, ' : 'rgba(102, 218, 213, ';

      // Top/Left Headlight Cone
      const lightGradLeft = ctx.createRadialGradient(
        radius * 0.7, -radius * 0.75, 2,
        radius * 1.5, -radius * 0.75, headlightLength
      );
      lightGradLeft.addColorStop(0, beamColor + '0.45)');
      lightGradLeft.addColorStop(0.6, beamColor + '0.12)');
      lightGradLeft.addColorStop(1, beamColor + '0.0)');
      ctx.fillStyle = lightGradLeft;
      ctx.beginPath();
      ctx.moveTo(radius * 0.7, -radius * 0.75);
      ctx.arc(radius * 0.7, -radius * 0.75, headlightLength, -Math.PI * 0.16, Math.PI * 0.12);
      ctx.closePath();
      ctx.fill();

      // Bottom/Right Headlight Cone
      const lightGradRight = ctx.createRadialGradient(
        radius * 0.7, radius * 0.75, 2,
        radius * 1.5, radius * 0.75, headlightLength
      );
      lightGradRight.addColorStop(0, beamColor + '0.45)');
      lightGradRight.addColorStop(0.6, beamColor + '0.12)');
      lightGradRight.addColorStop(1, beamColor + '0.0)');
      ctx.fillStyle = lightGradRight;
      ctx.beginPath();
      ctx.moveTo(radius * 0.7, radius * 0.75);
      ctx.arc(radius * 0.7, radius * 0.75, headlightLength, -Math.PI * 0.12, Math.PI * 0.16);
      ctx.closePath();
      ctx.fill();

      // Headlight Lamp Bulbs
      ctx.fillStyle = isBlocked ? '#FF9B83' : '#66DAD5';
      ctx.shadowColor = isBlocked ? '#FF9B83' : '#66DAD5';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(radius * 0.7, -radius * 0.75, 2.5, 0, Math.PI * 2);
      ctx.arc(radius * 0.7, radius * 0.75, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 2. Dual Ion Thruster Particles
    if (robot.state === 'MOVING' && Math.random() < 0.75) {
      this.particles.push({
        x: rx - Math.cos(robot.visualAngle) * (radius * 0.85),
        y: ry - Math.sin(robot.visualAngle) * (radius * 0.85),
        vx: -Math.cos(robot.visualAngle + (Math.random() - 0.5) * 0.35) * 44,
        vy: -Math.sin(robot.visualAngle + (Math.random() - 0.5) * 0.35) * 44,
        size: Math.random() * 2.8 + 1.2,
        color: '#66DAD5',
        alpha: 0.95,
        life: 0,
        maxLife: 0.28,
      });
    }

    // 3. Articulated Side Tread Pods with Animated Track Teeth & Bogie Rollers
    ctx.fillStyle = '#141D2E';
    this.roundRect(-radius * 0.95, -radius * 0.95, radius * 1.9, radius * 0.36, 3);
    this.roundRect(-radius * 0.95, radius * 0.6, radius * 1.9, radius * 0.36, 3);
    ctx.fill();

    // Tread teeth cycling animation
    ctx.fillStyle = '#2B3B5B';
    const treadShift = (this.pulsePhase * 8) % 5;
    for (let ti = 0; ti < 5; ti++) {
      const toothX = -radius * 0.8 + ti * (radius * 0.38) + (robot.state === 'MOVING' ? treadShift * 0.6 : 0);
      if (toothX > -radius * 0.85 && toothX < radius * 0.75) {
        ctx.fillRect(toothX, -radius * 0.93, 2, radius * 0.32);
        ctx.fillRect(toothX, radius * 0.62, 2, radius * 0.32);
      }
    }

    // Mechanical bogie roller hubcaps
    ctx.fillStyle = '#1E2C48';
    for (let bi = 0; bi < 3; bi++) {
      const bx = -radius * 0.55 + bi * (radius * 0.55);
      ctx.beginPath();
      ctx.arc(bx, -radius * 0.77, 2.2, 0, Math.PI * 2);
      ctx.arc(bx, radius * 0.78, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Hexagonal Armored Silhouette Chassis
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    const hullGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    hullGrad.addColorStop(0, '#526C9E');
    hullGrad.addColorStop(0.45, '#31446B');
    hullGrad.addColorStop(1, '#1D2A42');
    ctx.fillStyle = hullGrad;

    this.roundRect(-radius, -radius * 0.72, radius * 2, radius * 1.44, radius * 0.42);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Metal chassis rim specular
    ctx.strokeStyle = '#6FAFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Front Bumper Notch
    ctx.fillStyle = '#18243A';
    this.roundRect(radius * 0.7, -radius * 0.4, radius * 0.32, radius * 0.8, 2);
    ctx.fill();

    // 5. Directional Front Visor & Sweeping Sensor Eye
    const visorGrad = ctx.createLinearGradient(0, -radius * 0.45, radius * 0.85, radius * 0.45);
    visorGrad.addColorStop(0, '#0B1320');
    visorGrad.addColorStop(1, '#16243D');
    ctx.fillStyle = visorGrad;
    this.roundRect(radius * 0.08, -radius * 0.45, radius * 0.8, radius * 0.9, 4);
    ctx.fill();

    // Sweeping Scanner Eye Beam
    const eyeColor = robot.state === 'BLOCKED' ? '#FF9B83' : '#66DAD5';
    const sweepY = Math.sin(this.pulsePhase * 4) * (radius * 0.22);

    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(radius * 0.55, sweepY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Central Concentric Energy Core
    const corePulse = (Math.sin(this.pulsePhase * 3.0) + 1) * 0.5;
    ctx.strokeStyle = 'rgba(102, 218, 213, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, Math.max(0.1, 5 + corePulse * 1.5), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#66DAD5';
    ctx.shadowColor = '#66DAD5';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, Math.max(0.1, 3.0 + corePulse * 1.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // 7. Tactical Warning Exclamation Ping when Blocked
    if (robot.state === 'BLOCKED' || robot.state === 'REPLANNING') {
      ctx.save();
      const badgeY = ry - radius - 16;
      ctx.fillStyle = '#FF9B83';
      ctx.shadowColor = 'rgba(255, 155, 131, 0.9)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(rx, badgeY, 10, 0, Math.PI * 2);
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
    w = Math.max(0, w);
    h = Math.max(0, h);
    r = Math.max(0, r);
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    r = Math.max(0, r);
    if (r <= 0) {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.closePath();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
