export type Player = 'X' | 'O';
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface QuantumMark {
  player: Player;
  moveIndex: number;
  pairCell: CellIndex;
}

export interface Cell {
  quantumMarks: QuantumMark[];
  confirmedBy: Player | null;
}

export interface BoardState {
  cells: Cell[];
  currentPlayer: Player;
  moveCount: number;
  phase: 'playing' | 'collapsed' | 'finished';
  winner: Player | 'draw' | null;
  pendingCollapseTargets: CellIndex[] | null;
}

export interface PlaceMove {
  type: 'place';
  cells: [CellIndex, CellIndex];
}

export interface CollapseMove {
  type: 'collapse';
  targetCell: CellIndex;
  pairCell: CellIndex;
}

export type Move = PlaceMove | CollapseMove;

export interface KifuEntry {
  turnNumber: number;
  player: Player;
  move: Move;
  snapshot: BoardState;
  timestamp: string; // ISO8601
}
