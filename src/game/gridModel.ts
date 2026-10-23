import { GridCoord, TileType } from '../algorithms/types';

export class GridModel {
  public rows: number;
  public cols: number;
  public tiles: TileType[][];
  public start: GridCoord;
  public target: GridCoord;

  constructor(rows: number, cols: number, start: GridCoord, target: GridCoord) {
    this.rows = rows;
    this.cols = cols;
    this.start = { ...start };
    this.target = { ...target };
    this.tiles = Array.from({ length: rows }, () => Array(cols).fill('EMPTY'));
    this.tiles[this.start.r][this.start.c] = 'START';
    this.tiles[this.target.r][this.target.c] = 'TARGET';
  }

  public clone(): GridModel {
    const next = new GridModel(this.rows, this.cols, this.start, this.target);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        next.tiles[r][c] = this.tiles[r][c];
      }
    }
    return next;
  }

  public setTile(r: number, c: number, type: TileType): boolean {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    // Don't overwrite start/target directly with wall or rough terrain
    if ((r === this.start.r && c === this.start.c) || (r === this.target.r && c === this.target.c)) {
      return false;
    }
    this.tiles[r][c] = type;
    return true;
  }

  public setStart(r: number, c: number): boolean {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    if (r === this.target.r && c === this.target.c) return false;

    // Reset previous start
    if (this.tiles[this.start.r][this.start.c] === 'START') {
      this.tiles[this.start.r][this.start.c] = 'EMPTY';
    }
    this.start = { r, c };
    this.tiles[r][c] = 'START';
    return true;
  }

  public setTarget(r: number, c: number): boolean {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    if (r === this.start.r && c === this.start.c) return false;

    // Reset previous target
    if (this.tiles[this.target.r][this.target.c] === 'TARGET') {
      this.tiles[this.target.r][this.target.c] = 'EMPTY';
    }
    this.target = { r, c };
    this.tiles[r][c] = 'TARGET';
    return true;
  }

  public clearWalls(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.tiles[r][c] === 'WALL' || this.tiles[r][c] === 'DEBRIS' || this.tiles[r][c] === 'ROUGH_TERRAIN') {
          this.tiles[r][c] = 'EMPTY';
        }
      }
    }
  }

  public generateRandomWalls(density: number = 0.25): void {
    this.clearWalls();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if ((r === this.start.r && c === this.start.c) || (r === this.target.r && c === this.target.c)) {
          continue;
        }
        // Don't wall immediate neighbors of start and target to prevent trivial blockage
        const distToStart = Math.abs(r - this.start.r) + Math.abs(c - this.start.c);
        const distToTarget = Math.abs(r - this.target.r) + Math.abs(c - this.target.c);
        if (distToStart <= 1 || distToTarget <= 1) continue;

        const rand = Math.random();
        if (rand < density * 0.8) {
          this.tiles[r][c] = 'WALL';
        } else if (rand < density) {
          this.tiles[r][c] = 'ROUGH_TERRAIN';
        }
      }
    }
  }

  public generateMaze(): void {
    this.clearWalls();
    // Fill all with walls
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.tiles[r][c] = 'WALL';
      }
    }

    // Carve maze corridors using iterative randomized DFS
    const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const stack: GridCoord[] = [];

    const startNode = { r: 1, c: 1 };
    visited[startNode.r][startNode.c] = true;
    this.tiles[startNode.r][startNode.c] = 'EMPTY';
    stack.push(startNode);

    const dirs = [
      { dr: -2, dc: 0 },
      { dr: 2, dc: 0 },
      { dr: 0, dc: -2 },
      { dr: 0, dc: 2 },
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors: { r: number; c: number; wallR: number; wallC: number }[] = [];

      for (const d of dirs) {
        const nr = current.r + d.dr;
        const nc = current.c + d.dc;
        if (nr > 0 && nr < this.rows - 1 && nc > 0 && nc < this.cols - 1 && !visited[nr][nc]) {
          neighbors.push({
            r: nr,
            c: nc,
            wallR: current.r + d.dr / 2,
            wallC: current.c + d.dc / 2,
          });
        }
      }

      if (neighbors.length > 0) {
        const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
        visited[chosen.r][chosen.c] = true;
        this.tiles[chosen.wallR][chosen.wallC] = 'EMPTY';
        this.tiles[chosen.r][chosen.c] = 'EMPTY';
        stack.push({ r: chosen.r, c: chosen.c });
      } else {
        stack.pop();
      }
    }

    // Ensure start and target are traversable
    this.tiles[this.start.r][this.start.c] = 'START';
    this.tiles[this.target.r][this.target.c] = 'TARGET';

    // Clear neighboring cells to guarantee ingress/egress
    const clearSurrounding = (pt: GridCoord) => {
      const deltas = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ];
      for (const d of deltas) {
        const nr = pt.r + d.dr;
        const nc = pt.c + d.dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          if (this.tiles[nr][nc] === 'WALL') {
            this.tiles[nr][nc] = 'EMPTY';
            break; // Clear at least one access corridor
          }
        }
      }
    };
    clearSurrounding(this.start);
    clearSurrounding(this.target);
  }
}
