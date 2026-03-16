import { BOARD_SIZE } from "../core/constants";
import { Board, ActivePiece, Point, PieceDef } from "../core/types";
import { Theme } from "./ThemeManager";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  width: number;
  height: number;
  cellSize: number;
  boardRect: Rect;
  slotCenters: { x: number; y: number }[];
}

interface FlashLines {
  rows: number[];
  cols: number[];
  until: number;
}

export interface RendererState {
  board: Board;
  pieces: Array<ActivePiece | null>;
  dragging?: { pieceId: string; x: number; y: number };
  selectedPieceId?: string | null;
  ghost?: { piece: PieceDef; origin: Point; valid: boolean };
  flashLines?: FlashLines;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private layout: Layout;
  private theme: Theme;
  private state: RendererState;
  private pieceRects = new Map<string, Rect>();

  constructor(private canvas: HTMLCanvasElement, theme: Theme, initialState: RendererState) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context not available");
    }
    this.ctx = context;
    this.theme = theme;
    this.state = initialState;
    this.layout = this.computeLayout();
    this.resize();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  setState(state: Partial<RendererState>): void {
    this.state = { ...this.state, ...state };
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = this.computeLayout();
  }

  render(now: number): void {
    this.clear();
    this.drawBoard();
    this.drawPlacedBlocks();
    this.drawFlashLines(now);
    this.drawGhostPlacement();
    this.drawPieces();
  }

  getBoardCell(point: Point): Point | null {
    const { boardRect, cellSize } = this.layout;
    if (
      point.x < boardRect.x ||
      point.x > boardRect.x + boardRect.w ||
      point.y < boardRect.y ||
      point.y > boardRect.y + boardRect.h
    ) {
      return null;
    }
    const x = Math.floor((point.x - boardRect.x) / cellSize);
    const y = Math.floor((point.y - boardRect.y) / cellSize);
    return { x, y };
  }

  hitTestPiece(point: Point): string | null {
    for (const [id, rect] of this.pieceRects.entries()) {
      if (
        point.x >= rect.x &&
        point.x <= rect.x + rect.w &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.h
      ) {
        return id;
      }
    }
    return null;
  }

  getPieceRect(pieceId: string): Rect | null {
    return this.pieceRects.get(pieceId) ?? null;
  }

  getLayout(): Layout {
    return this.layout;
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.layout.width, this.layout.height);
    this.ctx.fillStyle = this.theme.palette.background;
    this.ctx.fillRect(0, 0, this.layout.width, this.layout.height);
  }

  private drawBoard(): void {
    const { boardRect, cellSize } = this.layout;
    this.ctx.save();
    this.ctx.fillStyle = this.theme.palette.board;
    this.roundRect(boardRect.x, boardRect.y, boardRect.w, boardRect.h, 14, true, false);
    this.ctx.strokeStyle = this.theme.palette.grid;
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= BOARD_SIZE; i += 1) {
      const x = boardRect.x + i * cellSize;
      const y = boardRect.y + i * cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(boardRect.x, y);
      this.ctx.lineTo(boardRect.x + boardRect.w, y);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(x, boardRect.y);
      this.ctx.lineTo(x, boardRect.y + boardRect.h);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawPlacedBlocks(): void {
    const { board, cellSize, boardRect } = this.statefulLayout();
    this.ctx.save();
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (board[y][x] === 1) {
          this.drawBlock(
            boardRect.x + x * cellSize,
            boardRect.y + y * cellSize,
            cellSize
          );
        }
      }
    }
    this.ctx.restore();
  }

  private drawFlashLines(now: number): void {
    const flash = this.state.flashLines;
    if (!flash || now > flash.until) {
      return;
    }
    const { boardRect, cellSize } = this.layout;
    this.ctx.save();
    this.ctx.fillStyle = this.theme.palette.highlight;
    this.ctx.globalAlpha = 0.6;
    this.ctx.shadowBlur = 14;
    this.ctx.shadowColor = this.theme.palette.highlight;

    for (const row of flash.rows) {
      this.ctx.fillRect(boardRect.x, boardRect.y + row * cellSize, boardRect.w, cellSize);
    }
    for (const col of flash.cols) {
      this.ctx.fillRect(boardRect.x + col * cellSize, boardRect.y, cellSize, boardRect.h);
    }
    this.ctx.restore();
  }

  private drawGhostPlacement(): void {
    const ghost = this.state.ghost;
    if (!ghost) {
      return;
    }
    const { cellSize, boardRect } = this.layout;
    this.ctx.save();
    this.ctx.globalAlpha = 0.35;
    const color = ghost.valid ? this.theme.palette.block : "#ff6b6b";
    this.ctx.fillStyle = color;
    for (const cell of ghost.piece.cells) {
      const x = boardRect.x + (ghost.origin.x + cell.x) * cellSize;
      const y = boardRect.y + (ghost.origin.y + cell.y) * cellSize;
      this.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 6, true, false);
    }
    this.ctx.restore();
  }

  private drawPieces(): void {
    const { pieces, dragging, selectedPieceId } = this.state;
    const { cellSize, slotCenters } = this.layout;
    this.pieceRects.clear();

    pieces.forEach((piece, index) => {
      const center = slotCenters[index];
      if (!center) {
        return;
      }

      if (!piece) {
        this.drawSlotPlaceholder(center.x, center.y, cellSize * 3.2);
        return;
      }

      if (dragging && dragging.pieceId === piece.instanceId) {
        return;
      }

      const { bounds } = piece.def;
      const width = bounds.w * cellSize;
      const height = bounds.h * cellSize;
      const startX = center.x - width / 2;
      const startY = center.y - height / 2;
      this.pieceRects.set(piece.instanceId, { x: startX, y: startY, w: width, h: height });

      if (selectedPieceId === piece.instanceId) {
        this.ctx.save();
        this.ctx.strokeStyle = this.theme.palette.highlight;
        this.ctx.lineWidth = 2;
        this.roundRect(startX - 6, startY - 6, width + 12, height + 12, 10, false, true);
        this.ctx.restore();
      }

      this.drawPieceAt(piece.def, startX, startY, cellSize);
    });

    if (dragging) {
      const piece = pieces.find((item) => item?.instanceId === dragging.pieceId);
      if (piece) {
        this.drawPieceAt(piece.def, dragging.x, dragging.y, cellSize, true);
      }
    }
  }

  private drawSlotPlaceholder(x: number, y: number, size: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    this.ctx.setLineDash([6, 6]);
    this.roundRect(x - size / 2, y - size / 2, size, size, 12, false, true);
    this.ctx.restore();
  }

  private drawPieceAt(piece: PieceDef, x: number, y: number, cellSize: number, floating = false): void {
    for (const cell of piece.cells) {
      const px = x + cell.x * cellSize;
      const py = y + cell.y * cellSize;
      this.drawBlock(px, py, cellSize, floating);
    }
  }

  private drawBlock(x: number, y: number, size: number, floating = false): void {
    this.ctx.save();
    this.ctx.fillStyle = this.theme.palette.block;
    this.ctx.strokeStyle = this.theme.palette.blockEdge;
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = floating ? 16 : 12;
    this.ctx.shadowColor = this.theme.palette.glow;
    const inset = 2;
    this.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, 6, true, true);
    this.ctx.restore();
  }

  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  private computeLayout(): Layout {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const margin = 18;
    const maxPieceCells = 4;
    const slotGapCells = 0.4;
    const slotPadCells = 0.6;

    if (width > height * 1.1) {
      const gap = Math.max(24, Math.round(width * 0.02));
      const availableWidth = width - margin * 2;
      const availableHeight = height - margin * 2;
      const availableWidthForBoard = availableWidth - gap;

      const buildWideLayout = (columns: 1 | 2, rows: 2 | 3) => {
        if (availableWidthForBoard <= 0 || availableHeight <= 0) {
          return null;
        }
        const trayWidthCells =
          columns * maxPieceCells + (columns - 1) * slotGapCells + slotPadCells * 2;
        const trayHeightCells =
          rows * maxPieceCells + (rows - 1) * slotGapCells + slotPadCells * 2;

        const maxCellByHeight = Math.min(availableHeight / BOARD_SIZE, availableHeight / trayHeightCells);
        const maxCellByWidth = availableWidthForBoard / (BOARD_SIZE + trayWidthCells);
        const cellSize = Math.max(1, Math.floor(Math.min(maxCellByHeight, maxCellByWidth)));
        if (!Number.isFinite(cellSize) || cellSize < 1) {
          return null;
        }

        const boardSize = cellSize * BOARD_SIZE;
        const boardRect = {
          x: margin,
          y: (height - boardSize) / 2,
          w: boardSize,
          h: boardSize
        };

        const trayX0 = boardRect.x + boardRect.w + gap;
        const trayX1 = width - margin;
        const trayWidth = Math.max(trayX1 - trayX0, 0);
        if (trayWidth <= 0) {
          return null;
        }

        const slotSize = maxPieceCells * cellSize;
        const gapPx = slotGapCells * cellSize;
        const padPx = slotPadCells * cellSize;
        const trayInnerWidth = trayWidthCells * cellSize;
        const trayInnerHeight = trayHeightCells * cellSize;
        const trayInnerX = trayX0 + (trayWidth - trayInnerWidth) / 2;
        const trayInnerY = margin + (availableHeight - trayInnerHeight) / 2;

        const slotCenters =
          columns === 2 && rows === 2
            ? (() => {
                const x1 = trayInnerX + padPx + slotSize / 2;
                const x2 = x1 + slotSize + gapPx;
                const y1 = trayInnerY + padPx + slotSize / 2;
                const y2 = y1 + slotSize + gapPx;
                return [
                  { x: x1, y: y1 },
                  { x: x2, y: y1 },
                  { x: (x1 + x2) / 2, y: y2 }
                ];
              })()
            : Array.from({ length: rows }, (_, index) => ({
                x: trayInnerX + trayInnerWidth / 2,
                y: trayInnerY + padPx + slotSize / 2 + index * (slotSize + gapPx)
              }));

        return { cellSize, boardRect, slotCenters };
      };

      const twoColumn = buildWideLayout(2, 2);
      const oneColumn = buildWideLayout(1, 3);
      const chosen =
        twoColumn && oneColumn
          ? twoColumn.cellSize >= oneColumn.cellSize
            ? twoColumn
            : oneColumn
          : twoColumn ?? oneColumn;

      if (chosen) {
        return { width, height, cellSize: chosen.cellSize, boardRect: chosen.boardRect, slotCenters: chosen.slotCenters };
      }
    }

    const availableWidth = width - margin * 2;
    const availableHeight = height - margin * 2;
    const gapBoardTrayCells = 1.2;
    const trayColumns = 2;
    const trayRows = 2;
    const trayWidthCells =
      trayColumns * maxPieceCells + (trayColumns - 1) * slotGapCells + slotPadCells * 2;
    const trayHeightCells =
      trayRows * maxPieceCells + (trayRows - 1) * slotGapCells + slotPadCells * 2;
    const totalHeightCells = BOARD_SIZE + gapBoardTrayCells + trayHeightCells;
    const widthCells = Math.max(BOARD_SIZE, trayWidthCells);
    let cellSize = Math.max(
      1,
      Math.floor(Math.min(availableWidth / widthCells, availableHeight / totalHeightCells))
    );
    if (!Number.isFinite(cellSize) || cellSize < 1) {
      cellSize = 1;
    }
    const boardSize = cellSize * BOARD_SIZE;
    const boardRect = {
      x: (width - boardSize) / 2,
      y: margin,
      w: boardSize,
      h: boardSize
    };
    const gapBoardTrayPx = gapBoardTrayCells * cellSize;
    const trayInnerWidth = trayWidthCells * cellSize;
    const trayInnerX = (width - trayInnerWidth) / 2;
    const trayInnerY = boardRect.y + boardRect.h + gapBoardTrayPx;
    const slotSize = maxPieceCells * cellSize;
    const gapPx = slotGapCells * cellSize;
    const padPx = slotPadCells * cellSize;
    const x1 = trayInnerX + padPx + slotSize / 2;
    const x2 = x1 + slotSize + gapPx;
    const y1 = trayInnerY + padPx + slotSize / 2;
    const y2 = y1 + slotSize + gapPx;
    const slotCenters = [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: (x1 + x2) / 2, y: y2 }
    ];
    return { width, height, cellSize, boardRect, slotCenters };
  }

  private statefulLayout(): { board: Board; cellSize: number; boardRect: Rect } {
    return { board: this.state.board, cellSize: this.layout.cellSize, boardRect: this.layout.boardRect };
  }
}
