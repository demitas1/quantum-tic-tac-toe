import type { Cell, CellIndex, Player } from '../types';

const WINNING_LINES: [CellIndex, CellIndex, CellIndex][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

// Requires that collapse.ts leaves the confirming QuantumMark in quantumMarks
// after confirmation (mark.player === cell.confirmedBy).
function getConfirmedMoveIndex(cell: Cell): number {
  const mark = cell.quantumMarks.find(m => m.player === cell.confirmedBy);
  if (!mark) throw new Error('confirmed cell missing its quantum mark');
  return mark.moveIndex;
}

export function checkVictory(cells: Cell[]): Player | 'draw' | null {
  let xBestMove: number | null = null;
  let oBestMove: number | null = null;

  for (const [a, b, c] of WINNING_LINES) {
    const ca = cells[a], cb = cells[b], cc = cells[c];
    if (!ca.confirmedBy || !cb.confirmedBy || !cc.confirmedBy) continue;
    if (ca.confirmedBy !== cb.confirmedBy || cb.confirmedBy !== cc.confirmedBy) continue;

    const player = ca.confirmedBy;
    const lineMove = Math.max(
      getConfirmedMoveIndex(ca),
      getConfirmedMoveIndex(cb),
      getConfirmedMoveIndex(cc),
    );

    if (player === 'X' && (xBestMove === null || lineMove < xBestMove)) xBestMove = lineMove;
    if (player === 'O' && (oBestMove === null || lineMove < oBestMove)) oBestMove = lineMove;
  }

  if (xBestMove !== null && oBestMove !== null) {
    return xBestMove < oBestMove ? 'X' : 'O';
  }
  if (xBestMove !== null) return 'X';
  if (oBestMove !== null) return 'O';

  if (cells.every(c => c.confirmedBy !== null)) return 'draw';

  return null;
}
