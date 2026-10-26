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

  // Static background caching layer
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private cachedTheme: SectorTheme | null = null;
  private cachedW: number = 0;
  private cachedH: number = 0;

  private particles: RenderParticle[] = [];
  private maxParticles: number = 75;
  private trailPoints: TrailPoint[] = [];
  private pulsePhase: number = 0;
  private treadTravelDist: number = 0;

  // Replanning visual storytelling
  private shockwaves: ReplanShockwave[] = [];
  private invalidatedPath: GridCoord[] = [];
  private invalidatedAlpha: number = 0;
  private scannerCenter: { x: number; y: number } | null = null;
  private scannerRadius: number = 0;
  private scannerMaxRadius: number = 0;

  // Cinematic Rescue Sequence State
  public rescueActive: boolean = false;
  public rescueProgress: number = 0; // 0.0 to 1.0
  public rescueTargetCoord: GridCoord | null = null;
  private rescueCompleteNotified: boolean = false;

  public hoverCoord: GridCoord | null = null;
  public highlightedExplored: Set<string> = new Set();
  public highlightedOpen: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  public resize(width: number, height: number, rows: number, cols: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    // Invalidate cached background on resize
    this.cachedW = 0;
    this.cachedH = 0;
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
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
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
    for (let i = 0; i < 40; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      const angle = (i / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = Math.random() * 110 + 50;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 1.8,
        color: colors[i % colors.length],
        alpha: 1.0,
        life: 0,
        maxLife: 0.85 + Math.random() * 0.35,
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
   * Begins the satisfying cinematic rescue sequence when Aegis-1 reaches the survivor
   */
  public triggerRescueSequence(target: GridCoord): void {
    this.rescueActive = true;
    this.rescueProgress = 0;
    this.rescueTargetCoord = { ...target };
    this.rescueCompleteNotified = false;
  }

  public triggerCelebrationBurst(r: number, c: number): void {
    this.addArrivalBurst(r, c);
  }

  public skipRescueSequence(): void {
    this.rescueProgress = 1.0;
    this.rescueActive = false;
  }

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
    this.rescueActive = false;
    this.rescueProgress = 0;
    this.rescueTargetCoord = null;
    this.rescueCompleteNotified = false;
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
    if (robot.state === 'MOVING') {
      this.treadTravelDist += deltaSec * 16;
    }

    // Update Rescue Sequence progress if active (5.2s total duration)
    if (this.rescueActive) {
      this.rescueProgress = Math.min(1.0, this.rescueProgress + deltaSec / 5.2);
    }

    // 1. Sector Backdrop
    this.renderEnvironmentBackdrop(width, height, theme);

    const { rows, cols } = gridModel;
    const boardW = cols * this.tileSize;
    const boardH = rows * this.tileSize;

    // 2. Elevated Simulation Deck Plate
    ctx.save();
    const deckFill =
      theme === 'facility'
        ? '#121A2B'
        : theme === 'canyon'
        ? '#19132B'
        : theme === 'maze'
        ? '#0D1525'
        : '#131D33';
    ctx.fillStyle = deckFill;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 16;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 14);
    ctx.fill();

    // Outer metal border bevel with theme accent
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle =
      theme === 'facility'
        ? '#41577F'
        : theme === 'canyon'
        ? '#573F7A'
        : theme === 'maze'
        ? '#3A5480'
        : '#33486E';
    ctx.lineWidth = 2.5;
    this.roundRect(this.offsetX - 8, this.offsetY - 8, boardW + 16, boardH + 16, 14);
    ctx.stroke();

    // Inner subtle glow border
    ctx.strokeStyle =
      theme === 'canyon'
        ? 'rgba(166, 149, 242, 0.22)'
        : theme === 'facility'
        ? 'rgba(245, 207, 121, 0.18)'
        : 'rgba(102, 218, 213, 0.2)';
    ctx.lineWidth = 1;
    this.roundRect(this.offsetX - 6, this.offsetY - 6, boardW + 12, boardH + 12, 12);
    ctx.stroke();
    ctx.restore();

    // 3. Render Floor Tiles with Inset Grid & Sector Identity
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.offsetX + c * this.tileSize;
        const y = this.offsetY + r * this.tileSize;
        const tileType = gridModel.tiles[r][c];
        const key = `${r},${c}`;

        this.renderTile(x, y, tileType, key, theme, r, c);
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
    this.renderRescuePod(gridModel.target, robot, theme);

    // Ambient sector atmosphere particles (crystal dust, sparks, or cyber motes)
    if (this.particles.length < 28 && Math.random() < 0.15) {
      const px = this.offsetX + Math.random() * (gridModel.cols * this.tileSize);
      const py = this.offsetY + Math.random() * (gridModel.rows * this.tileSize);
      if (theme === 'canyon') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 14 - 4,
          size: Math.random() * 2.4 + 0.8,
          color: Math.random() > 0.5 ? '#A695F2' : '#C7BAFF',
          alpha: 0.65,
          life: 0,
          maxLife: 2.0,
        });
      } else if (theme === 'facility') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 12,
          vy: Math.random() * 20 + 6,
          size: Math.random() * 2.0 + 0.8,
          color: Math.random() > 0.6 ? '#F5CF79' : '#FF9B83',
          alpha: 0.75,
          life: 0,
          maxLife: 1.1,
        });
      } else if (theme === 'maze') {
        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 12 - 2,
          size: Math.random() * 2.0 + 0.8,
          color: '#66DAD5',
          alpha: 0.6,
          life: 0,
          maxLife: 1.6,
        });
      }
    }

    // 11. Update & Render Robot Motion Trail
    this.updateAndRenderTrail(robot, deltaSec);

    // 12. Render Hero Robot Character ("Aegis-1")
    const onRough = gridModel.tiles[robot.logicalPos.r]?.[robot.logicalPos.c] === 'ROUGH_TERRAIN';
    this.renderRobot(robot, theme, onRough);

    // 13. Update & Render Particle Systems
    this.updateAndRenderParticles(deltaSec);
  }

  private renderEnvironmentBackdrop(w: number, h: number, theme: SectorTheme): void {
    const { ctx } = this;

    // Check if cached static background needs recreation
    if (this.cachedW !== w || this.cachedH !== h || this.cachedTheme !== theme || !this.bgCanvas) {
      if (!this.bgCanvas) {
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
      }
      this.bgCanvas.width = w;
      this.bgCanvas.height = h;
      this.cachedW = w;
      this.cachedH = h;
      this.cachedTheme = theme;
      if (this.bgCtx) {
        this.drawStaticBackdrop(this.bgCtx, w, h, theme);
      }
    }

    if (this.bgCanvas) {
      ctx.drawImage(this.bgCanvas, 0, 0);
    }

    // Dynamic environmental lighting & beacons
    ctx.save();
    if (theme === 'facility') {
      // Dynamic pulsing emergency ceiling beacon
      const emPulse = (Math.sin(this.pulsePhase * 3.5) + 1) * 0.5;
      const bColor = `rgba(245, 207, 121, ${0.1 + emPulse * 0.16})`;
      ctx.fillStyle = bColor;
      ctx.beginPath();
      ctx.arc(w * 0.2, 24, 45, 0, Math.PI * 2);
      ctx.arc(w * 0.8, 24, 45, 0, Math.PI * 2);
      ctx.fill();

      // Red hazard strobe fixture on bottom truss
      const rPulse = (Math.sin(this.pulsePhase * 4.2 + 1) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 110, 90, ${0.08 + rPulse * 0.14})`;
      ctx.beginPath();
      ctx.arc(w * 0.5, h - 30, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'canyon') {
      // Pulsing amethyst geode cavern glow
      const pulse = (Math.sin(this.pulsePhase * 1.5) + 1) * 0.5;
      ctx.fillStyle = `rgba(166, 149, 242, ${0.07 + pulse * 0.08})`;
      ctx.beginPath();
      ctx.arc(w * 0.15, h * 0.25, 50, 0, Math.PI * 2);
      ctx.arc(w * 0.85, h * 0.75, 60, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'maze') {
      // Pulsing data bus packet glow
      const busPulse = (Math.sin(this.pulsePhase * 3.0) + 1) * 0.5;
      ctx.fillStyle = `rgba(102, 218, 213, ${0.12 + busPulse * 0.14})`;
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.5, 30, 0, Math.PI * 2);
      ctx.arc(w * 0.7, h * 0.5, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawStaticBackdrop(bCtx: CanvasRenderingContext2D, w: number, h: number, theme: SectorTheme): void {
    bCtx.save();

    // Deep theme-specific room tone
    const bgFill =
      theme === 'facility'
        ? '#0D131F'
        : theme === 'canyon'
        ? '#120E22'
        : theme === 'maze'
        ? '#080E1B'
        : '#0E1626';
    bCtx.fillStyle = bgFill;
    bCtx.fillRect(0, 0, w, h);

    // Center ambient soft spotlight
    const grad = bCtx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.7);
    if (theme === 'canyon') {
      grad.addColorStop(0, 'rgba(166, 149, 242, 0.12)');
      grad.addColorStop(1, 'rgba(18, 14, 34, 0)');
    } else if (theme === 'facility') {
      grad.addColorStop(0, 'rgba(245, 207, 121, 0.08)');
      grad.addColorStop(1, 'rgba(13, 19, 31, 0)');
    } else if (theme === 'maze') {
      grad.addColorStop(0, 'rgba(111, 175, 255, 0.1)');
      grad.addColorStop(1, 'rgba(8, 14, 27, 0)');
    } else {
      grad.addColorStop(0, 'rgba(102, 218, 213, 0.1)');
      grad.addColorStop(1, 'rgba(14, 22, 38, 0)');
    }
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, w, h);

    if (theme === 'training') {
      // High-tech training proving ground grid with laser guides & station markers
      bCtx.strokeStyle = 'rgba(102, 218, 213, 0.07)';
      bCtx.lineWidth = 1;
      const step = 44;
      for (let x = 0; x < w; x += step) {
        bCtx.beginPath();
        bCtx.moveTo(x, 0);
        bCtx.lineTo(x, h);
        bCtx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        bCtx.beginPath();
        bCtx.moveTo(0, y);
        bCtx.lineTo(w, y);
        bCtx.stroke();
      }

      // Corner station brackets
      bCtx.strokeStyle = 'rgba(102, 218, 213, 0.28)';
      bCtx.lineWidth = 2;
      const br = 24;
      // Top-left
      bCtx.beginPath();
      bCtx.moveTo(16, 16 + br); bCtx.lineTo(16, 16); bCtx.lineTo(16 + br, 16);
      bCtx.stroke();
      // Top-right
      bCtx.beginPath();
      bCtx.moveTo(w - 16 - br, 16); bCtx.lineTo(w - 16, 16); bCtx.lineTo(w - 16, 16 + br);
      bCtx.stroke();
      // Bottom-left
      bCtx.beginPath();
      bCtx.moveTo(16, h - 16 - br); bCtx.lineTo(16, h - 16); bCtx.lineTo(16 + br, h - 16);
      bCtx.stroke();
      // Bottom-right
      bCtx.beginPath();
      bCtx.moveTo(w - 16 - br, h - 16); bCtx.lineTo(w - 16, h - 16); bCtx.lineTo(w - 16, h - 16 - br);
      bCtx.stroke();
    } else if (theme === 'facility') {
      // Collapsed facility: overhead structural steel I-beams & diagonal caution perimeter
      bCtx.strokeStyle = 'rgba(245, 207, 121, 0.06)';
      bCtx.lineWidth = 1;
      const step = 48;
      for (let x = 0; x < w; x += step) {
        bCtx.beginPath();
        bCtx.moveTo(x, 0);
        bCtx.lineTo(x, h);
        bCtx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        bCtx.beginPath();
        bCtx.moveTo(0, y);
        bCtx.lineTo(w, y);
        bCtx.stroke();
      }

      // Overhead steel I-beam spans
      bCtx.fillStyle = 'rgba(28, 38, 56, 0.55)';
      bCtx.fillRect(0, 24, w, 12);
      bCtx.fillRect(0, h - 36, w, 12);
      bCtx.strokeStyle = 'rgba(58, 78, 115, 0.4)';
      bCtx.lineWidth = 1;
      bCtx.strokeRect(0, 24, w, 12);
      bCtx.strokeRect(0, h - 36, w, 12);

      // Hazard caution stripes on perimeter beam
      bCtx.fillStyle = 'rgba(245, 207, 121, 0.12)';
      for (let x = -20; x < w + 20; x += 32) {
        bCtx.beginPath();
        bCtx.moveTo(x, 24);
        bCtx.lineTo(x + 12, 24);
        bCtx.lineTo(x + 4, 36);
        bCtx.lineTo(x - 8, 36);
        bCtx.closePath();
        bCtx.fill();
      }
    } else if (theme === 'canyon') {
      // Amethyst canyon: organic geological strata bands & deep mineral gorge curves
      bCtx.strokeStyle = 'rgba(166, 149, 242, 0.08)';
      bCtx.lineWidth = 1.4;
      for (let y = 30; y < h; y += 48) {
        bCtx.beginPath();
        bCtx.moveTo(0, y);
        bCtx.bezierCurveTo(w * 0.35, y - 14, w * 0.65, y + 16, w, y);
        bCtx.stroke();
      }
    } else if (theme === 'maze') {
      // Mainframe cyber labyrinth: pulsing data bus traces & micro-circuit buses
      bCtx.strokeStyle = 'rgba(111, 175, 255, 0.08)';
      bCtx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < w; x += step) {
        bCtx.beginPath();
        bCtx.moveTo(x, 0);
        bCtx.lineTo(x, h);
        bCtx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        bCtx.beginPath();
        bCtx.moveTo(0, y);
        bCtx.lineTo(w, y);
        bCtx.stroke();
      }

      // Glowing data bus junction nodes
      bCtx.fillStyle = 'rgba(102, 218, 213, 0.16)';
      for (let x = step * 2; x < w; x += step * 3) {
        for (let y = step * 2; y < h; y += step * 3) {
          bCtx.beginPath();
          bCtx.arc(x, y, 2.5, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
    } else {
      // Default / presentation grid
      bCtx.strokeStyle = 'rgba(102, 218, 213, 0.07)';
      bCtx.lineWidth = 1;
      const step = 48;
      for (let x = 0; x < w; x += step) {
        bCtx.beginPath();
        bCtx.moveTo(x, 0);
        bCtx.lineTo(x, h);
        bCtx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        bCtx.beginPath();
        bCtx.moveTo(0, y);
        bCtx.lineTo(w, y);
        bCtx.stroke();
      }
    }

    bCtx.restore();
  }

  private renderTile(
    x: number,
    y: number,
    tileType: TileType,
    key: string,
    theme: SectorTheme,
    r: number,
    c: number
  ): void {
    const { ctx, tileSize } = this;
    const pad = 1.5;
    const tw = tileSize - pad * 2;
    const th = tileSize - pad * 2;

    // Stable deterministic pseudo-random seed per grid cell (avoids per-frame jitter)
    const seed = ((r * 374761393 + c * 668265263) ^ 0x5bf03635) >>> 0;
    const fRand1 = (seed & 0xff) / 255;
    const fRand2 = ((seed >> 8) & 0xff) / 255;

    ctx.save();

    // 1. Base Walkable Floor Cell Styling
    let fill =
      theme === 'facility'
        ? '#182136'
        : theme === 'canyon'
        ? '#201A33'
        : theme === 'maze'
        ? '#142036'
        : '#1C2944';
    let stroke =
      theme === 'facility'
        ? 'rgba(58, 78, 115, 0.55)'
        : theme === 'canyon'
        ? 'rgba(78, 58, 107, 0.55)'
        : theme === 'maze'
        ? 'rgba(48, 70, 108, 0.55)'
        : 'rgba(43, 59, 91, 0.55)';

    // Search exploration highlights from algorithm visualization
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

    // 2. Theme-Specific Decorative Floor Accents (Subtle, readable, non-obtrusive)
    if (theme === 'facility') {
      // Occasional cracked laboratory floor tiles & corner rivets
      if (fRand1 > 0.65) {
        ctx.strokeStyle = 'rgba(58, 78, 115, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + pad + 3, y + pad + th * 0.3);
        ctx.lineTo(x + pad + tw * 0.4, y + pad + th * 0.5);
        ctx.lineTo(x + pad + tw * 0.7, y + pad + th * 0.8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(161, 173, 199, 0.25)';
      ctx.fillRect(x + pad + 2, y + pad + 2, 2, 2);
      ctx.fillRect(x + pad + tw - 4, y + pad + 2, 2, 2);
    } else if (theme === 'canyon') {
      // Natural alien flagstone moss/crystal speckle
      if (fRand1 > 0.7) {
        ctx.fillStyle = fRand2 > 0.5 ? 'rgba(166, 149, 242, 0.35)' : 'rgba(102, 218, 213, 0.3)';
        ctx.beginPath();
        ctx.arc(x + pad + tw * fRand2, y + pad + th * fRand1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'maze') {
      // Fine etched circuit traces
      ctx.fillStyle = 'rgba(102, 218, 213, 0.18)';
      ctx.fillRect(x + pad + tw / 2 - 1, y + pad + th / 2 - 1, 2, 2);
      if (fRand1 > 0.75) {
        ctx.strokeStyle = 'rgba(111, 175, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + pad + tw / 2, y + pad);
        ctx.lineTo(x + pad + tw / 2, y + pad + th);
        ctx.stroke();
      }
    } else {
      // Proving ground corner bevel dots
      ctx.fillStyle = 'rgba(102, 218, 213, 0.15)';
      ctx.fillRect(x + pad + 2, y + pad + 2, 2, 2);
      ctx.fillRect(x + pad + tw - 4, y + pad + th - 4, 2, 2);
    }

    // 3. Specific Tile Obstacle Overlays
    if (tileType === 'WALL') {
      if (theme === 'canyon') {
        // Natural Multi-Faceted Basalt Canyon Rock Outcropping
        ctx.fillStyle = '#140E20';
        this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 3);
        ctx.fill();

        // Layered geological rock strata gradient
        const rockGrad = ctx.createLinearGradient(x, y, x + tw, y + th);
        rockGrad.addColorStop(0, '#46325C');
        rockGrad.addColorStop(0.45, '#312242');
        rockGrad.addColorStop(1, '#1E142B');
        ctx.fillStyle = rockGrad;

        // Faceted polygonal rock silhouette
        ctx.beginPath();
        ctx.moveTo(x + pad + 3, y + pad + 2);
        ctx.lineTo(x + pad + tw - 3, y + pad + 1);
        ctx.lineTo(x + pad + tw - 1, y + pad + th * 0.6);
        ctx.lineTo(x + pad + tw - 4, y + pad + th - 4);
        ctx.lineTo(x + pad + 4, y + pad + th - 3);
        ctx.lineTo(x + pad + 1, y + pad + th * 0.45);
        ctx.closePath();
        ctx.fill();

        // Natural basalt cliff facet highlight
        ctx.strokeStyle = '#7D5C9E';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Protruding faceted amethyst crystal cluster
        ctx.fillStyle = '#A695F2';
        ctx.shadowColor = '#A695F2';
        ctx.shadowBlur = 8;

        // Primary crystal shard spike
        ctx.beginPath();
        ctx.moveTo(x + tw * 0.48, y + th * 0.2);
        ctx.lineTo(x + tw * 0.68, y + th * 0.65);
        ctx.lineTo(x + tw * 0.35, y + th * 0.65);
        ctx.closePath();
        ctx.fill();

        // Secondary crystal facet
        ctx.fillStyle = '#C7BAFF';
        ctx.beginPath();
        ctx.moveTo(x + tw * 0.48, y + th * 0.2);
        ctx.lineTo(x + tw * 0.58, y + th * 0.65);
        ctx.lineTo(x + tw * 0.35, y + th * 0.65);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else if (theme === 'facility') {
        // Heavy Reinforced Industrial Blast Alloy Bulkhead
        ctx.fillStyle = '#0D1522';
        this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 3);
        ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, y + th);
        grad.addColorStop(0, '#384B69');
        grad.addColorStop(0.5, '#26354D');
        grad.addColorStop(1, '#172233');
        ctx.fillStyle = grad;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 3);
        ctx.fill();

        ctx.strokeStyle = '#5E7BA8';
        ctx.lineWidth = 1;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 3);
        ctx.stroke();

        // Center caution hazard plate (yellow / black hazard stripes)
        const plateW = Math.max(10, tw * 0.55);
        const plateH = 5;
        const px = x + (tw - plateW) / 2;
        const py = y + th / 2 - 4;
        ctx.fillStyle = '#172233';
        ctx.fillRect(px, py, plateW, plateH);
        ctx.fillStyle = '#F5CF79';
        for (let sx = px; sx < px + plateW; sx += 4) {
          ctx.fillRect(sx, py, 2, plateH);
        }

        // Structural rebar studs projecting from corner
        ctx.fillStyle = '#FF9B83';
        ctx.fillRect(x + pad + 2, y + pad + 2, 2.5, 2.5);
        ctx.fillRect(x + pad + tw - 5, y + pad + 2, 2.5, 2.5);
      } else if (theme === 'maze') {
        // Monolithic Server Core Rack Blade
        ctx.fillStyle = '#09121F';
        this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 3);
        ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, y + th);
        grad.addColorStop(0, '#243B5E');
        grad.addColorStop(0.5, '#172842');
        grad.addColorStop(1, '#0F1B2E');
        ctx.fillStyle = grad;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 3);
        ctx.fill();

        ctx.strokeStyle = '#406399';
        ctx.lineWidth = 1;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 3);
        ctx.stroke();

        // Vertical heat-sink cooling slots
        ctx.fillStyle = '#0A1424';
        ctx.fillRect(x + tw * 0.25, y + th * 0.25, 2, th * 0.45);
        ctx.fillRect(x + tw * 0.75 - 2, y + th * 0.25, 2, th * 0.45);

        // Glowing high-speed central data bus
        ctx.fillStyle = '#66DAD5';
        ctx.shadowColor = '#66DAD5';
        ctx.shadowBlur = 6;
        ctx.fillRect(x + tw / 2 - 1.5, y + pad + 3, 3, th - 11);
        ctx.shadowBlur = 0;

        // Logic LED status dots
        ctx.fillStyle = '#86E3B4';
        ctx.fillRect(x + tw - 6, y + pad + 3, 2, 2);
      } else {
        // Proving Ground Cyber Barrier
        ctx.fillStyle = '#0E1726';
        this.roundRect(x + pad + 1, y + pad + 4, tw - 2, th - 2, 4);
        ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, y + th);
        grad.addColorStop(0, '#364D78');
        grad.addColorStop(0.5, '#253757');
        grad.addColorStop(1, '#19263D');
        ctx.fillStyle = grad;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
        ctx.fill();

        ctx.strokeStyle = '#5E80B8';
        ctx.lineWidth = 1;
        this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 5, 4);
        ctx.stroke();

        // Glowing cyan conduit channel
        ctx.fillStyle = '#66DAD5';
        ctx.shadowColor = '#66DAD5';
        ctx.shadowBlur = 5;
        ctx.fillRect(x + tw / 2 - 6, y + th / 2 - 4, 12, 2.5);
        ctx.shadowBlur = 0;
      }
    } else if (tileType === 'DEBRIS') {
      // Interactive Collapsed Debris (Demolishable with Repair Charges)
      ctx.fillStyle = '#111724';
      this.roundRect(x + pad + 1, y + pad + 3, tw - 2, th - 2, 3);
      ctx.fill();

      // Fractured rubble chunks
      const rubbleGrad = ctx.createLinearGradient(x, y, x + tw, y + th);
      rubbleGrad.addColorStop(0, '#5C473C');
      rubbleGrad.addColorStop(0.5, '#40322B');
      rubbleGrad.addColorStop(1, '#261D19');
      ctx.fillStyle = rubbleGrad;
      this.roundRect(x + pad + 1, y + pad + 1, tw - 2, th - 4, 3);
      ctx.fill();

      // Jagged fracture cracks
      ctx.strokeStyle = 'rgba(245, 207, 121, 0.8)';
      ctx.lineWidth = 1.3;
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

      // Interactive demolition target crosshair indicator (tactile pulse)
      const debrisPulse = (Math.sin(this.pulsePhase * 3.5) + 1) * 0.5;
      ctx.strokeStyle = `rgba(255, 155, 131, ${0.45 + debrisPulse * 0.5})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const cx = x + tw / 2;
      const cy = y + th / 2;
      ctx.arc(cx, cy, Math.max(2, tw * 0.22), 0, Math.PI * 2);
      ctx.stroke();
    } else if (tileType === 'ROUGH_TERRAIN') {
      // High-friction crystalline field (3x movement cost)
      ctx.fillStyle =
        theme === 'canyon' ? 'rgba(166, 149, 242, 0.24)' : 'rgba(245, 207, 121, 0.22)';
      this.roundRect(x + pad, y + pad, tw, th, 4);
      ctx.fill();

      // Glowing crystal shards
      ctx.fillStyle = theme === 'canyon' ? '#A695F2' : '#F5CF79';
      ctx.shadowColor = theme === 'canyon' ? 'rgba(166, 149, 242, 0.7)' : 'rgba(245, 207, 121, 0.7)';
      ctx.shadowBlur = 6;

      // Cluster of 3 crystal shard spikes
      ctx.beginPath();
      ctx.moveTo(x + tw * 0.45, y + th * 0.16);
      ctx.lineTo(x + tw * 0.65, y + th * 0.72);
      ctx.lineTo(x + tw * 0.25, y + th * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + tw * 0.72, y + th * 0.32);
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gridModel.tiles[r][c] === 'WALL' || gridModel.tiles[r][c] === 'DEBRIS') {
          // Cast soft shadow onto tile below if open
          if (r + 1 < rows && gridModel.tiles[r + 1][c] !== 'WALL') {
            const sx = this.offsetX + c * tileSize;
            const sy = this.offsetY + (r + 1) * tileSize;
            ctx.fillRect(sx + 2, sy + 1, tileSize - 4, 8);
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

    // Red cancellation crosses on invalidated waypoints
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
    const r = Math.max(1, tileSize * 0.38);

    ctx.save();

    // Heavy octagonal base platform
    ctx.fillStyle = '#101A2E';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bx = cx + Math.cos(angle) * (r + 2);
      const by = cy + Math.sin(angle) * (r + 2);
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();

    // Theme-matched styling
    if (theme === 'training') {
      // High-visibility cyan launch pad with chevron guides
      ctx.strokeStyle = '#66DAD5';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Launch direction chevrons
      ctx.strokeStyle = 'rgba(102, 218, 213, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx - 5, cy + 4);
      ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 4);
      ctx.stroke();

      // Corner docking clamps
      ctx.fillStyle = '#F5CF79';
      ctx.fillRect(cx - r, cy - r, 3, 3);
      ctx.fillRect(cx + r - 3, cy - r, 3, 3);
      ctx.fillRect(cx - r, cy + r - 3, 3, 3);
      ctx.fillRect(cx + r - 3, cy + r - 3, 3, 3);
    } else if (theme === 'facility') {
      // Industrial maintenance elevator platform with caution border
      ctx.strokeStyle = '#F5CF79';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 207, 121, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'canyon') {
      // Basalt expedition pad with runic ring
      ctx.strokeStyle = '#A695F2';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#6FAFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Rotating launch lock brackets
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.pulsePhase * 0.6);
    ctx.strokeStyle = theme === 'training' ? 'rgba(102, 218, 213, 0.6)' : 'rgba(111, 175, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 0.4);
    ctx.arc(0, 0, r + 4, Math.PI, Math.PI * 1.4);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private renderRescuePod(coord: GridCoord, robot: RobotController, theme: SectorTheme): void {
    const { ctx, tileSize } = this;
    const cx = this.offsetX + coord.c * tileSize + tileSize / 2;
    const cy = this.offsetY + coord.r * tileSize + tileSize / 2;
    const isArrived = robot.state === 'ARRIVED' || this.rescueActive;
    const isStabilized = isArrived && (robot.state === 'ARRIVED' || this.rescueProgress >= 0.42);
    const isConfirmed = isArrived && (robot.state === 'ARRIVED' || this.rescueProgress >= 0.65);
    const pulse = (Math.sin(this.pulsePhase * 2.5) + 1) * 0.5;

    ctx.save();

    // 1. Expanding radar distress transmission pulses
    const maxR = Math.max(1, tileSize * 0.7);
    const curR = Math.max(0.1, (Math.abs(this.pulsePhase) * 12) % maxR);
    ctx.strokeStyle = isStabilized
      ? `rgba(134, 227, 180, ${Math.max(0, 0.8 * (1 - curR / maxR))})`
      : `rgba(255, 155, 131, ${Math.max(0, 0.75 * (1 - curR / maxR))})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, curR, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Pod Base Docking Mount (Heavy octagonal alloy plate)
    const baseR = Math.max(4, tileSize * 0.38);
    ctx.fillStyle = '#0F1626';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bx = cx + Math.cos(angle) * baseR;
      const by = cy + Math.sin(angle) * baseR;
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = isStabilized ? '#86E3B4' : '#FF9B83';
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
    ctx.strokeStyle = isStabilized ? '#86E3B4' : '#6FAFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner Glass Cryo-Chamber
    const glassW = podW * 0.72;
    const glassH = podH * 0.68;
    const glassX = cx - glassW / 2;
    const glassY = cy - glassH / 2 - 1;

    const chamberGrad = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
    if (isStabilized) {
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

    // 4. Survivor Silhouette, Rising Micro-Bubbles & Heartbeat ECG Waveform
    ctx.save();
    ctx.beginPath();
    this.roundRect(glassX, glassY, glassW, glassH, glassW * 0.45);
    ctx.clip();

    // Rising micro-bubbles in cryogenic stasis fluid
    ctx.fillStyle = isStabilized ? 'rgba(134, 227, 180, 0.65)' : 'rgba(102, 218, 213, 0.45)';
    for (let bi = 0; bi < 4; bi++) {
      const bProgress = ((this.pulsePhase * 0.7 + bi * 0.28) % 1.0);
      const bx = glassX + glassW * (0.2 + (bi * 0.22));
      const by = glassY + glassH * (1.0 - bProgress);
      const bR = 1.0 + (bi % 2) * 0.5;
      ctx.beginPath();
      ctx.arc(bx, by, bR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Humanoid silhouette in stasis
    ctx.fillStyle = isStabilized ? 'rgba(134, 227, 180, 0.75)' : 'rgba(102, 218, 213, 0.4)';
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
    const ecgColor = isStabilized ? '#86E3B4' : '#66DAD5';
    ctx.strokeStyle = ecgColor;
    ctx.lineWidth = 1.2;
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
    const beaconColor = isStabilized ? '#86E3B4' : '#FF9B83';
    ctx.fillStyle = beaconColor;
    ctx.shadowColor = beaconColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, mastTopY, Math.max(1, 2.5 + pulse * 1.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Rescue Sequence Interactions (Diagnostic Scan Cone & Stabilization)
    if (isArrived) {
      const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
      const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;

      // Diagnostic Medical Scan Fan during Stage 2 (rescueProgress 0.19 to 0.42)
      if (this.rescueActive && this.rescueProgress >= 0.19 && this.rescueProgress < 0.42) {
        ctx.save();
        const scanGrad = ctx.createRadialGradient(rx, ry, 2, cx, cy, tileSize * 1.8);
        scanGrad.addColorStop(0, 'rgba(102, 218, 213, 0.45)');
        scanGrad.addColorStop(0.6, 'rgba(134, 227, 180, 0.2)');
        scanGrad.addColorStop(1, 'rgba(134, 227, 180, 0)');
        ctx.fillStyle = scanGrad;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        const scanAngle = Math.atan2(cy - ry, cx - rx);
        ctx.arc(rx, ry, tileSize * 2.0, scanAngle - Math.PI * 0.2, scanAngle + Math.PI * 0.2);
        ctx.closePath();
        ctx.fill();

        // Oscillating diagnostic laser scan line
        const scanLineShift = Math.sin(this.pulsePhase * 8) * (podH * 0.35);
        ctx.strokeStyle = '#86E3B4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - glassW * 0.6, cy + scanLineShift);
        ctx.lineTo(cx + glassW * 0.6, cy + scanLineShift);
        ctx.stroke();
        ctx.restore();
      }

      // Connective containment laser beam between robot and cryo-pod
      ctx.save();
      ctx.strokeStyle = 'rgba(134, 227, 180, 0.6)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.strokeStyle = '#86E3B4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.pulsePhase * 18;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Floating Medical Cross Icon rising above pod during Stage 3+ (vitals stabilized)
      if (isStabilized) {
        const badgeY = mastTopY - 14 - Math.sin(this.pulsePhase * 3) * 3;
        ctx.save();
        ctx.fillStyle = '#86E3B4';
        ctx.shadowColor = 'rgba(134, 227, 180, 0.9)';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✚', cx, badgeY);

        // Status banner: +1 SURVIVOR SECURED strictly after vitals stabilization (Stage 4+)
        if (isConfirmed) {
          ctx.font = 'bold 10px monospace';
          ctx.fillText('+1 SURVIVOR SECURED', cx, badgeY - 11);

          // Pulsing docking energy ring on deck plate
          ctx.strokeStyle = `rgba(134, 227, 180, ${Math.max(0, 0.4 + Math.sin(this.pulsePhase * 4) * 0.25)})`;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(cx, cy, baseR + 6 + Math.sin(this.pulsePhase * 3) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
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
  private renderRobot(robot: RobotController, theme: SectorTheme, onRough: boolean = false): void {
    const { ctx, tileSize } = this;
    const rx = this.offsetX + robot.visualX * tileSize + tileSize / 2;
    const ry = this.offsetY + robot.visualY * tileSize + tileSize / 2;
    const radius = tileSize * 0.38;

    // 0. Ground Contact Drop Shadow (anchors chassis to floor plate)
    ctx.save();
    ctx.translate(rx, ry + radius * 0.28);
    ctx.scale(1.0, 0.44);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4, 8, 18, 0.52)';
    ctx.fill();
    ctx.restore();

    // Idle breathing animation
    const breathScale =
      robot.state === 'IDLE' || robot.state === 'CONFIRMED'
        ? 1.0 + Math.sin(this.pulsePhase * 2.5) * 0.03
        : 1.0;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(robot.visualAngle);
    ctx.scale(breathScale, breathScale);

    // 1. Dual Forward Volumetric Headlight Beams (Active during transit and docking illumination)
    const isDockingOrArrived = robot.state === 'ARRIVED' || this.rescueActive;
    if (robot.state === 'MOVING' || robot.state === 'CONFIRMED' || robot.state === 'BLOCKED' || isDockingOrArrived) {
      const headlightLength = Math.max(0.1, tileSize * 1.8);
      const isBlocked = robot.state === 'BLOCKED';
      const beamColor = isBlocked
        ? 'rgba(255, 155, 131, '
        : isDockingOrArrived
        ? 'rgba(134, 227, 180, '
        : 'rgba(102, 218, 213, ';

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
      const bulbColor = isBlocked ? '#FF9B83' : isDockingOrArrived ? '#86E3B4' : '#66DAD5';
      ctx.fillStyle = bulbColor;
      ctx.shadowColor = bulbColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(radius * 0.7, -radius * 0.75, 2.5, 0, Math.PI * 2);
      ctx.arc(radius * 0.7, radius * 0.75, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 2. Dual Ion Thruster Particles & Rough Terrain Debris
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
    if (robot.state === 'MOVING' && onRough && Math.random() < 0.65) {
      this.particles.push({
        x: rx - Math.cos(robot.visualAngle) * (radius * 0.8) + (Math.random() - 0.5) * 6,
        y: ry - Math.sin(robot.visualAngle) * (radius * 0.8) + (Math.random() - 0.5) * 6,
        vx: -Math.cos(robot.visualAngle + (Math.random() - 0.5) * 1.4) * (Math.random() * 26 + 14),
        vy: -Math.sin(robot.visualAngle + (Math.random() - 0.5) * 1.4) * (Math.random() * 26 + 14),
        size: Math.random() * 2.2 + 1.0,
        color: theme === 'canyon' ? '#A695F2' : '#F5CF79',
        alpha: 0.85,
        life: 0,
        maxLife: 0.32,
      });
    }

    // 3. Articulated Side Tread Pods with Animated Track Teeth & Bogie Rollers
    ctx.fillStyle = '#141D2E';
    this.roundRect(-radius * 0.95, -radius * 0.95, radius * 1.9, radius * 0.36, 3);
    this.roundRect(-radius * 0.95, radius * 0.6, radius * 1.9, radius * 0.36, 3);
    ctx.fill();

    // Tread teeth cycling animation
    ctx.fillStyle = '#2B3B5B';
    const treadShift = (this.treadTravelDist) % 5;
    for (let ti = 0; ti < 5; ti++) {
      const toothX = -radius * 0.8 + ti * (radius * 0.38) + (robot.state === 'MOVING' ? treadShift * 0.6 : 0);
      if (toothX > -radius * 0.85 && toothX < radius * 0.75) {
        ctx.fillRect(toothX, -radius * 0.93, 2, radius * 0.32);
        ctx.fillRect(toothX, radius * 0.62, 2, radius * 0.32);
      }
    }

    // Mechanical bogie roller hubcaps with rotating spoke markers
    for (let bi = 0; bi < 3; bi++) {
      const bx = -radius * 0.55 + bi * (radius * 0.55);
      ctx.fillStyle = '#1E2C48';
      ctx.beginPath();
      ctx.arc(bx, -radius * 0.77, 2.6, 0, Math.PI * 2);
      ctx.arc(bx, radius * 0.78, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Rotating mechanical spoke crosshairs
      const spokeAngle = this.treadTravelDist * 0.45 + bi * 1.05;
      ctx.strokeStyle = '#4A628A';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(spokeAngle) * 2.2, -radius * 0.77 + Math.sin(spokeAngle) * 2.2);
      ctx.lineTo(bx - Math.cos(spokeAngle) * 2.2, -radius * 0.77 - Math.sin(spokeAngle) * 2.2);
      ctx.moveTo(bx + Math.cos(spokeAngle) * 2.2, radius * 0.78 + Math.sin(spokeAngle) * 2.2);
      ctx.lineTo(bx - Math.cos(spokeAngle) * 2.2, radius * 0.78 - Math.sin(spokeAngle) * 2.2);
      ctx.stroke();
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

    // Front Bumper & Articulated Magnetic Docking Clamp Assembly
    ctx.fillStyle = '#18243A';
    this.roundRect(radius * 0.68, -radius * 0.38, radius * 0.3, radius * 0.76, 2);
    ctx.fill();
    ctx.strokeStyle = '#384F73';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Articulated Magnetic Clamping Pincers
    const clampSpread = isDockingOrArrived ? 0.30 : 0.22;
    const clampColor = isDockingOrArrived ? '#86E3B4' : '#6FAFFF';
    ctx.fillStyle = clampColor;

    // Upper pincer
    ctx.beginPath();
    ctx.moveTo(radius * 0.9, -radius * clampSpread);
    ctx.lineTo(radius * 1.16, -radius * clampSpread * 1.25);
    ctx.lineTo(radius * 1.12, -radius * clampSpread * 0.65);
    ctx.lineTo(radius * 0.9, -radius * clampSpread * 0.55);
    ctx.closePath();
    ctx.fill();

    // Lower pincer
    ctx.beginPath();
    ctx.moveTo(radius * 0.9, radius * clampSpread);
    ctx.lineTo(radius * 1.16, radius * clampSpread * 1.25);
    ctx.lineTo(radius * 1.12, radius * clampSpread * 0.65);
    ctx.lineTo(radius * 0.9, radius * clampSpread * 0.55);
    ctx.closePath();
    ctx.fill();

    // Clamp magnetic lock indicators
    ctx.fillStyle = isDockingOrArrived ? '#10B981' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(radius * 1.05, -radius * clampSpread * 0.95, 1.2, 0, Math.PI * 2);
    ctx.arc(radius * 1.05, radius * clampSpread * 0.95, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Directional Front Visor & Reactive Sweeping Sensor Eye
    const visorGrad = ctx.createLinearGradient(0, -radius * 0.45, radius * 0.85, radius * 0.45);
    visorGrad.addColorStop(0, '#0B1320');
    visorGrad.addColorStop(1, '#16243D');
    ctx.fillStyle = visorGrad;
    this.roundRect(radius * 0.08, -radius * 0.45, radius * 0.8, radius * 0.9, 4);
    ctx.fill();

    // Reactive scanner eye beam
    const eyeColor =
      robot.state === 'BLOCKED'
        ? '#FF9B83'
        : isDockingOrArrived
        ? '#86E3B4'
        : '#66DAD5';

    let sweepY = 0;
    if (robot.state === 'BLOCKED') {
      sweepY = (Math.random() - 0.5) * (radius * 0.28); // alert jitter
    } else if (robot.state === 'MOVING') {
      sweepY = Math.sin(this.pulsePhase * 6) * (radius * 0.12); // forward navigation scan
    } else if (isDockingOrArrived) {
      sweepY = 0; // locked steady on survivor pod
    } else {
      sweepY = Math.sin(this.pulsePhase * 3.2) * (radius * 0.24); // exploratory idle sweep
    }

    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(radius * 0.55, sweepY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Central Concentric Energy Core
    const corePulse = (Math.sin(this.pulsePhase * 3.0) + 1) * 0.5;
    ctx.strokeStyle =
      isDockingOrArrived
        ? 'rgba(134, 227, 180, 0.45)'
        : 'rgba(102, 218, 213, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-radius * 0.2, 0, Math.max(0.1, 5 + corePulse * 1.5), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isDockingOrArrived ? '#86E3B4' : '#66DAD5';
    ctx.shadowColor = isDockingOrArrived ? '#86E3B4' : '#66DAD5';
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
