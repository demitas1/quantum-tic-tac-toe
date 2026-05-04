import type { Cell, CellIndex, Player } from '../types';
import { checkVictory } from './victory';

function confirmed(player: Player, moveIndex: number): Cell {
  return {
    quantumMarks: [{ player, moveIndex, pairCell: 0 as CellIndex }],
    confirmedBy: player,
  };
}

function empty(): Cell {
  return { quantumMarks: [], confirmedBy: null };
}

function board(layout: Array<Cell | null>): Cell[] {
  return layout.map(c => c ?? empty());
}

const X = (mi: number) => confirmed('X', mi);
const O = (mi: number) => confirmed('O', mi);
const E = empty;

describe('checkVictory', () => {
  it('returns null for an empty board', () => {
    expect(checkVictory(Array(9).fill(null).map(E))).toBeNull();
  });

  it('returns null when a line is incomplete', () => {
    const cells = board([X(0), X(1), E(), E(), E(), E(), E(), E(), E()]);
    expect(checkVictory(cells)).toBeNull();
  });

  it('detects X winning a row (0-1-2)', () => {
    const cells = board([X(0), X(2), X(4), E(), E(), E(), E(), E(), E()]);
    expect(checkVictory(cells)).toBe('X');
  });

  it('detects O winning a column (0-3-6)', () => {
    const cells = board([O(0), E(), E(), O(2), E(), E(), O(4), E(), E()]);
    expect(checkVictory(cells)).toBe('O');
  });

  it('detects X winning a diagonal (0-4-8)', () => {
    const cells = board([X(0), E(), E(), E(), X(2), E(), E(), E(), X(4)]);
    expect(checkVictory(cells)).toBe('X');
  });

  it('detects X winning the other diagonal (2-4-6)', () => {
    const cells = board([E(), E(), X(0), E(), X(2), E(), X(4), E(), E()]);
    expect(checkVictory(cells)).toBe('X');
  });

  it('returns draw when all cells are confirmed with no winner', () => {
    // X X O / O O X / X O X — no 3-in-a-row for either player
    const cells = [
      X(0), X(3), O(1),
      O(2), O(5), X(4),
      X(6), O(7), X(8),
    ];
    expect(checkVictory(cells)).toBe('draw');
  });

  it('returns X when both win simultaneously and X decisive moveIndex is lower', () => {
    // X wins row 0 with decisive moveIndex = max(0,2,4) = 4
    // O wins row 1 with decisive moveIndex = max(1,3,7) = 7
    const cells = board([
      X(0), X(2), X(4),
      O(1), O(3), O(7),
      E(), E(), E(),
    ]);
    expect(checkVictory(cells)).toBe('X');
  });

  it('returns O when both win simultaneously and O decisive moveIndex is lower', () => {
    // X wins row 0 with decisive moveIndex = max(1,3,7) = 7
    // O wins row 1 with decisive moveIndex = max(0,2,4) = 4
    const cells = board([
      X(1), X(3), X(7),
      O(0), O(2), O(4),
      E(), E(), E(),
    ]);
    expect(checkVictory(cells)).toBe('O');
  });
});
