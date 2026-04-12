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
  blockedPieceIds?: string[];
  placementCounts?: Record<string, number>;
  dragging?: { pieceId: string; x: number; y: number };
  selectedPieceId?: string | null;
  ghost?: { piece: PieceDef; origin: Point; valid: boolean };
  guideGhost?: { piece: PieceDef; origin: Point };
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
    this.drawGuideGhost();
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
    const { width, height } = this.layout;
    this.ctx.clearRect(0, 0, width, height);

    const base = this.ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, this.theme.atmosphere.skyTop);
    base.addColorStop(0.45, this.theme.palette.background);
    base.addColorStop(1, this.theme.atmosphere.skyBottom);
    this.ctx.fillStyle = base;
    this.ctx.fillRect(0, 0, width, height);

    this.paintAmbientGlow(width * 0.16, height * 0.18, width * 0.54, this.theme.atmosphere.bloomA);
    this.paintAmbientGlow(width * 0.82, height * 0.22, width * 0.44, this.theme.atmosphere.bloomB);
    this.paintAmbientGlow(width * 0.58, height * 0.8, width * 0.5, this.theme.atmosphere.bloomC);
    this.paintScenePattern(width, height);

    const vignette = this.ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      width * 0.18,
      width * 0.5,
      height * 0.45,
      width * 0.82
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(2, 6, 12, 0.55)");
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, width, height);
  }

  private paintAmbientGlow(x: number, y: number, radius: number, color: string): void {
    const glow = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private paintScenePattern(width: number, height: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.style.patternColor;
    this.ctx.fillStyle = this.theme.style.patternColor;

    switch (this.theme.style.scenePattern) {
      case "lattice":
        this.ctx.globalAlpha = 0.18;
        this.ctx.lineWidth = 1;
        for (let x = -height * 0.15; x < width + height * 0.2; x += 84) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x - height * 0.2, height);
          this.ctx.stroke();
        }
        this.ctx.globalAlpha = 0.1;
        for (let x = -height * 0.1; x < width + height * 0.18; x += 118) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x + height * 0.16, height);
          this.ctx.stroke();
        }
        break;
      case "forge":
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 18;
        this.ctx.lineCap = "round";
        for (let offset = -120; offset < width + 120; offset += 120) {
          this.ctx.beginPath();
          this.ctx.moveTo(offset, height * 0.16);
          this.ctx.bezierCurveTo(
            offset + 34,
            height * 0.26,
            offset + 16,
            height * 0.72,
            offset - 42,
            height
          );
          this.ctx.stroke();
        }
        break;
      case "crystal":
        this.ctx.globalAlpha = 0.14;
        this.ctx.lineWidth = 2;
        for (let x = -48; x < width + 48; x += 88) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x + 38, height * 0.32);
          this.ctx.lineTo(x - 14, height);
          this.ctx.stroke();
        }
        break;
      case "signal":
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 1;
        for (let y = 18; y < height; y += 16) {
          this.ctx.beginPath();
          this.ctx.moveTo(0, y);
          this.ctx.lineTo(width, y);
          this.ctx.stroke();
        }
        this.ctx.globalAlpha = 0.08;
        this.ctx.fillRect(width * 0.16, 0, 8, height);
        this.ctx.fillRect(width * 0.74, 0, 6, height);
        break;
      case "ember":
        this.ctx.globalAlpha = 0.11;
        for (let index = 0; index < 7; index += 1) {
          const x = width * (0.12 + index * 0.11);
          const y = height * (0.22 + (index % 3) * 0.18);
          this.ctx.beginPath();
          this.ctx.arc(x, y, 4 + (index % 2) * 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = "round";
        for (let x = -40; x < width + 80; x += 96) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, height * 0.1);
          this.ctx.lineTo(x - 56, height * 0.92);
          this.ctx.stroke();
        }
        break;
      case "tide":
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 3;
        for (let y = height * 0.18; y < height; y += 48) {
          this.ctx.beginPath();
          this.ctx.moveTo(-20, y);
          this.ctx.bezierCurveTo(width * 0.2, y - 18, width * 0.54, y + 18, width + 24, y - 4);
          this.ctx.stroke();
        }
        break;
      case "sunset":
        this.ctx.globalAlpha = 0.12;
        this.ctx.fillRect(0, height * 0.18, width, 22);
        this.ctx.fillRect(0, height * 0.34, width, 14);
        this.ctx.globalAlpha = 0.08;
        this.ctx.fillRect(0, height * 0.52, width, 10);
        break;
      case "aurora":
        this.ctx.globalAlpha = 0.09;
        this.ctx.lineWidth = 22;
        this.ctx.lineCap = "round";
        for (let index = 0; index < 3; index += 1) {
          const startY = height * (0.12 + index * 0.16);
          this.ctx.beginPath();
          this.ctx.moveTo(width * 0.04, startY);
          this.ctx.bezierCurveTo(
            width * 0.28,
            startY - 24,
            width * 0.58,
            startY + 34,
            width * 0.9,
            startY - 12
          );
          this.ctx.stroke();
        }
        break;
      case "canopy":
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 20;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(width * 0.04, height * 0.2);
        this.ctx.bezierCurveTo(width * 0.16, 0, width * 0.3, height * 0.08, width * 0.44, height * 0.28);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(width * 0.96, height * 0.12);
        this.ctx.bezierCurveTo(width * 0.82, 0, width * 0.66, height * 0.08, width * 0.54, height * 0.3);
        this.ctx.stroke();
        break;
    }

    this.ctx.restore();
  }

  private drawBoard(): void {
    const { boardRect, cellSize } = this.layout;
    this.ctx.save();
    this.ctx.shadowBlur = 24;
    this.ctx.shadowColor = this.theme.style.boardGlow;
    const boardFill = this.ctx.createLinearGradient(
      boardRect.x,
      boardRect.y,
      boardRect.x,
      boardRect.y + boardRect.h
    );
    boardFill.addColorStop(0, this.theme.style.boardSheen);
    boardFill.addColorStop(0.16, this.theme.palette.board);
    boardFill.addColorStop(1, this.theme.palette.background);
    this.ctx.fillStyle = boardFill;
    this.traceRoundRect(boardRect.x, boardRect.y, boardRect.w, boardRect.h, 14);
    this.ctx.fill();
    this.ctx.clip();
    this.paintBoardTexture(boardRect);
    const sheen = this.ctx.createLinearGradient(
      boardRect.x,
      boardRect.y,
      boardRect.x + boardRect.w,
      boardRect.y + boardRect.h
    );
    sheen.addColorStop(0, this.theme.style.boardSheen);
    sheen.addColorStop(0.38, "rgba(255, 255, 255, 0)");
    sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    this.ctx.fillStyle = sheen;
    this.ctx.fillRect(boardRect.x, boardRect.y, boardRect.w, boardRect.h);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.strokeStyle = this.theme.style.boardFrame;
    this.ctx.lineWidth = 2;
    this.roundRect(boardRect.x, boardRect.y, boardRect.w, boardRect.h, 14, false, true);
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

  private paintBoardTexture(boardRect: Rect): void {
    const { x, y, w, h } = boardRect;
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.style.patternColor;
    this.ctx.fillStyle = this.theme.style.patternColor;

    switch (this.theme.style.scenePattern) {
      case "lattice":
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 1;
        for (let offset = -h * 0.12; offset < w + h * 0.12; offset += 34) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + offset, y);
          this.ctx.lineTo(x + offset - h * 0.12, y + h);
          this.ctx.stroke();
        }
        break;
      case "forge":
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = "round";
        for (let offset = -20; offset < w + 40; offset += 42) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + offset, y);
          this.ctx.lineTo(x + offset - 18, y + h);
          this.ctx.stroke();
        }
        break;
      case "crystal":
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 1.5;
        for (let offset = -24; offset < w + 24; offset += 36) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + offset, y);
          this.ctx.lineTo(x + offset + 12, y + h * 0.38);
          this.ctx.lineTo(x + offset - 10, y + h);
          this.ctx.stroke();
        }
        break;
      case "signal":
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 1;
        for (let line = y + 10; line < y + h; line += 8) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, line);
          this.ctx.lineTo(x + w, line);
          this.ctx.stroke();
        }
        break;
      case "ember":
        this.ctx.globalAlpha = 0.1;
        for (let index = 0; index < 9; index += 1) {
          this.ctx.beginPath();
          this.ctx.arc(
            x + w * (0.1 + (index % 4) * 0.22),
            y + h * (0.14 + Math.floor(index / 4) * 0.28),
            2.2,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        }
        break;
      case "tide":
        this.ctx.globalAlpha = 0.1;
        this.ctx.lineWidth = 2;
        for (let line = y + 12; line < y + h; line += 22) {
          this.ctx.beginPath();
          this.ctx.moveTo(x - 4, line);
          this.ctx.bezierCurveTo(x + w * 0.22, line - 8, x + w * 0.68, line + 8, x + w + 4, line);
          this.ctx.stroke();
        }
        break;
      case "sunset":
        this.ctx.globalAlpha = 0.08;
        this.ctx.fillRect(x, y + h * 0.18, w, 10);
        this.ctx.fillRect(x, y + h * 0.4, w, 6);
        this.ctx.fillRect(x, y + h * 0.62, w, 4);
        break;
      case "aurora":
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 12;
        this.ctx.lineCap = "round";
        for (let index = 0; index < 2; index += 1) {
          const offsetY = y + h * (0.24 + index * 0.24);
          this.ctx.beginPath();
          this.ctx.moveTo(x + w * 0.02, offsetY);
          this.ctx.bezierCurveTo(
            x + w * 0.24,
            offsetY - 10,
            x + w * 0.62,
            offsetY + 10,
            x + w * 0.96,
            offsetY - 6
          );
          this.ctx.stroke();
        }
        break;
      case "canopy":
        this.ctx.globalAlpha = 0.08;
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(x + w * 0.08, y + h * 0.22);
        this.ctx.bezierCurveTo(x + w * 0.2, y, x + w * 0.34, y + h * 0.08, x + w * 0.44, y + h * 0.24);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + w * 0.92, y + h * 0.18);
        this.ctx.bezierCurveTo(x + w * 0.78, y, x + w * 0.62, y + h * 0.08, x + w * 0.54, y + h * 0.24);
        this.ctx.stroke();
        break;
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

  private drawGuideGhost(): void {
    const guideGhost = this.state.guideGhost;
    if (!guideGhost) {
      return;
    }
    const { cellSize, boardRect } = this.layout;
    this.ctx.save();
    this.ctx.globalAlpha = 0.18;
    this.ctx.fillStyle = this.theme.palette.highlight;
    this.ctx.strokeStyle = this.theme.palette.highlight;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 4]);
    for (const cell of guideGhost.piece.cells) {
      const x = boardRect.x + (guideGhost.origin.x + cell.x) * cellSize;
      const y = boardRect.y + (guideGhost.origin.y + cell.y) * cellSize;
      this.roundRect(x + 3, y + 3, cellSize - 6, cellSize - 6, 6, true, true);
    }
    this.ctx.restore();
  }

  private drawPieces(): void {
    const { pieces, dragging, selectedPieceId } = this.state;
    const { cellSize, slotCenters } = this.layout;
    const blockedPieceIds = new Set(this.state.blockedPieceIds ?? []);
    const placementCounts = this.state.placementCounts ?? {};
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

      const blocked = blockedPieceIds.has(piece.instanceId);
      if (blocked) {
        this.ctx.save();
        this.ctx.strokeStyle = "rgba(255, 132, 132, 0.55)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 4]);
        this.roundRect(startX - 6, startY - 6, width + 12, height + 12, 10, false, true);
        this.ctx.restore();
      }

      this.drawPieceAt(piece.def, startX, startY, cellSize, false, blocked);
      if (piece.instanceId in placementCounts) {
        this.drawPlacementBadge(startX + width, startY, placementCounts[piece.instanceId]);
      }
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
    this.ctx.strokeStyle = this.theme.style.boardFrame;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = this.theme.style.boardGlow;
    this.ctx.setLineDash([6, 6]);
    this.roundRect(x - size / 2, y - size / 2, size, size, 12, false, true);
    this.ctx.restore();
  }

  private drawPieceAt(
    piece: PieceDef,
    x: number,
    y: number,
    cellSize: number,
    floating = false,
    muted = false
  ): void {
    for (const cell of piece.cells) {
      const px = x + cell.x * cellSize;
      const py = y + cell.y * cellSize;
      this.drawBlock(px, py, cellSize, floating, muted);
    }
  }

  private drawPlacementBadge(x: number, y: number, count: number): void {
    const fontSize = Math.max(11, Math.round(this.layout.cellSize * 0.46));
    const padX = Math.max(6, Math.round(fontSize * 0.45));
    const badgeHeight = Math.max(18, Math.round(fontSize * 1.55));
    const label = `${count}`;

    this.ctx.save();
    this.ctx.font = `700 ${fontSize}px "Trebuchet MS", "Verdana", sans-serif`;
    const badgeWidth = Math.max(
      badgeHeight,
      Math.ceil(this.ctx.measureText(label).width + padX * 2)
    );
    const badgeX = x - badgeWidth * 0.78;
    const badgeY = y - badgeHeight * 0.42;

    let fillStyle = this.theme.palette.board;
    let strokeStyle = this.theme.palette.accent;
    let textStyle = "#f8f9fb";

    if (count === 0) {
      fillStyle = "#33161a";
      strokeStyle = "rgba(255, 132, 132, 0.88)";
      textStyle = "#ffd8d8";
    } else if (count <= 2) {
      strokeStyle = this.theme.palette.accentAlt;
    }

    this.ctx.fillStyle = fillStyle;
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = count === 0 ? 0 : 10;
    this.ctx.shadowColor = strokeStyle;
    this.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2, true, true);

    this.ctx.fillStyle = textStyle;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);
    this.ctx.restore();
  }

  private drawBlock(x: number, y: number, size: number, floating = false, muted = false): void {
    const inset = 2;
    const blockX = x + inset;
    const blockY = y + inset;
    const blockSize = size - inset * 2;

    this.ctx.save();
    this.ctx.globalAlpha = muted ? 0.28 : 1;
    this.ctx.shadowBlur = muted ? 0 : floating ? 16 : 12;
    this.ctx.shadowColor = this.theme.palette.glow;
    const blockFill = this.ctx.createLinearGradient(blockX, blockY, blockX, blockY + blockSize);
    blockFill.addColorStop(0, this.theme.style.blockTop);
    blockFill.addColorStop(0.48, this.theme.palette.block);
    blockFill.addColorStop(1, this.theme.style.blockBottom);
    this.ctx.fillStyle = blockFill;
    this.traceRoundRect(blockX, blockY, blockSize, blockSize, 6);
    this.ctx.fill();
    this.ctx.clip();

    const gloss = this.ctx.createLinearGradient(blockX, blockY, blockX + blockSize, blockY + blockSize);
    gloss.addColorStop(0, this.theme.style.blockInner);
    gloss.addColorStop(0.36, "rgba(255, 255, 255, 0)");
    gloss.addColorStop(1, "rgba(0, 0, 0, 0.14)");
    this.ctx.fillStyle = gloss;
    this.ctx.fillRect(blockX, blockY, blockSize, blockSize);
    this.paintBlockPattern(blockX, blockY, blockSize);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.globalAlpha = muted ? 0.32 : 1;
    this.ctx.strokeStyle = this.theme.palette.blockEdge;
    this.ctx.lineWidth = 2;
    this.roundRect(blockX, blockY, blockSize, blockSize, 6, false, true);
    this.ctx.globalAlpha = muted ? 0.12 : 0.42;
    this.ctx.strokeStyle = this.theme.style.blockInner;
    this.ctx.lineWidth = 1;
    this.traceRoundRect(blockX + 1, blockY + 1, blockSize - 2, Math.max(6, blockSize * 0.44), 5);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private paintBlockPattern(x: number, y: number, size: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.style.patternColor;
    this.ctx.fillStyle = this.theme.style.sparkle;

    switch (this.theme.style.blockPattern) {
      case "glass": {
        const shine = this.ctx.createLinearGradient(x, y, x + size, y + size);
        shine.addColorStop(0.08, "rgba(255, 255, 255, 0)");
        shine.addColorStop(0.42, this.theme.style.blockInner);
        shine.addColorStop(0.58, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = shine;
        this.ctx.fillRect(x, y, size, size);
        break;
      }
      case "alloy":
        this.ctx.globalAlpha = 0.14;
        this.ctx.lineWidth = 2;
        for (let offset = -size; offset < size * 2; offset += 7) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + offset, y + size);
          this.ctx.lineTo(x + offset + size * 0.45, y);
          this.ctx.stroke();
        }
        break;
      case "frost":
        this.ctx.globalAlpha = 0.22;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.24, y + size * 0.18);
        this.ctx.lineTo(x + size * 0.76, y + size * 0.78);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.18, y + size * 0.64);
        this.ctx.lineTo(x + size * 0.46, y + size * 0.42);
        this.ctx.lineTo(x + size * 0.82, y + size * 0.22);
        this.ctx.stroke();
        break;
      case "signal":
        this.ctx.globalAlpha = 0.16;
        this.ctx.fillStyle = this.theme.style.patternColor;
        this.ctx.fillRect(x, y + size * 0.28, size, 2);
        this.ctx.fillRect(x, y + size * 0.58, size, 2);
        this.ctx.fillRect(x + size * 0.56, y, 2, size);
        break;
      case "ember":
        this.ctx.globalAlpha = 0.28;
        this.ctx.beginPath();
        this.ctx.arc(x + size * 0.32, y + size * 0.3, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(x + size * 0.66, y + size * 0.58, 1.8, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case "wave":
        this.ctx.globalAlpha = 0.16;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.08, y + size * 0.38);
        this.ctx.bezierCurveTo(
          x + size * 0.26,
          y + size * 0.18,
          x + size * 0.64,
          y + size * 0.54,
          x + size * 0.92,
          y + size * 0.28
        );
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.04, y + size * 0.68);
        this.ctx.bezierCurveTo(
          x + size * 0.24,
          y + size * 0.5,
          x + size * 0.68,
          y + size * 0.86,
          x + size * 0.94,
          y + size * 0.62
        );
        this.ctx.stroke();
        break;
      case "horizon":
        this.ctx.globalAlpha = 0.18;
        this.ctx.fillStyle = this.theme.style.patternColor;
        this.ctx.fillRect(x, y + size * 0.34, size, 3);
        this.ctx.fillRect(x, y + size * 0.58, size, 2);
        break;
      case "aurora": {
        const ribbon = this.ctx.createLinearGradient(x, y + size, x + size, y);
        ribbon.addColorStop(0.12, "rgba(255, 255, 255, 0)");
        ribbon.addColorStop(0.4, this.theme.style.patternColor);
        ribbon.addColorStop(0.6, this.theme.style.blockInner);
        ribbon.addColorStop(0.82, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = ribbon;
        this.ctx.fillRect(x, y, size, size);
        break;
      }
      case "leaf":
        this.ctx.globalAlpha = 0.18;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.26, y + size * 0.82);
        this.ctx.lineTo(x + size * 0.68, y + size * 0.22);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + size * 0.42, y + size * 0.56);
        this.ctx.lineTo(x + size * 0.76, y + size * 0.7);
        this.ctx.stroke();
        break;
    }

    this.ctx.restore();
  }

  private traceRoundRect(x: number, y: number, width: number, height: number, radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
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
    this.traceRoundRect(x, y, width, height, radius);
    if (fill) this.ctx.fill();
    if (stroke) this.ctx.stroke();
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
