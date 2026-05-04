import { QuantumTTTEngine } from './QuantumTTTEngine';
import type { CollapseMove, PlaceMove } from '../types';

function place(a: number, b: number): PlaceMove {
  return { type: 'place', cells: [a, b] as [0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8] } as PlaceMove;
}

function collapse(targetCell: number, pairCell: number): CollapseMove {
  return {
    type: 'collapse',
    targetCell: targetCell as CollapseMove['targetCell'],
    pairCell: pairCell as CollapseMove['pairCell'],
  };
}

// Cycle on cells 0,3,6 (column 0). All marks are X → collapse always yields X wins.
function setupColumnCycle() {
  const engine = new QuantumTTTEngine();
  engine.applyMove(place(0, 3)); // X, moveIndex=0
  engine.applyMove(place(1, 4)); // O, moveIndex=1
  engine.applyMove(place(3, 6)); // X, moveIndex=2
  engine.applyMove(place(4, 7)); // O, moveIndex=3
  engine.applyMove(place(0, 6)); // X, moveIndex=4 → cycle [0,3,6]
  return engine;
}

// Cycle on cells 0,1,4 — NOT a winning line, so collapse does not immediately end the game.
// Cell 0 = ✓X, Cell 1 = ✓O, Cell 4 = ✓X after collapse(0, 1).
function setupNonWinningCycle() {
  const engine = new QuantumTTTEngine();
  engine.applyMove(place(0, 1)); // X, moveIndex=0
  engine.applyMove(place(1, 4)); // O, moveIndex=1
  engine.applyMove(place(0, 4)); // X, moveIndex=2 → cycle [0,1,4]
  return engine;
}

describe('QuantumTTTEngine — initial state', () => {
  it('starts in playing phase with X to move', () => {
    const engine = new QuantumTTTEngine();
    const state = engine.getState();
    expect(state.phase).toBe('playing');
    expect(state.currentPlayer).toBe('X');
    expect(state.moveCount).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.pendingCollapseTargets).toBeNull();
  });

  it('getLegalMoves returns all 36 cell pairs on a fresh board', () => {
    const engine = new QuantumTTTEngine();
    expect(engine.getLegalMoves()).toHaveLength(36);
  });
});

describe('QuantumTTTEngine — PlaceMove', () => {
  it('adds quantum marks to both cells and switches player', () => {
    const engine = new QuantumTTTEngine();
    const state = engine.applyMove(place(0, 1));

    expect(state.currentPlayer).toBe('O');
    expect(state.moveCount).toBe(1);
    expect(state.cells[0].quantumMarks).toContainEqual({ player: 'X', moveIndex: 0, pairCell: 1 });
    expect(state.cells[1].quantumMarks).toContainEqual({ player: 'X', moveIndex: 0, pairCell: 0 });
  });

  it('uses moveCount as moveIndex', () => {
    const engine = new QuantumTTTEngine();
    engine.applyMove(place(0, 1)); // moveIndex=0
    const state = engine.applyMove(place(2, 3)); // moveIndex=1
    expect(state.cells[2].quantumMarks[0].moveIndex).toBe(1);
  });
});

describe('QuantumTTTEngine — cycle detection', () => {
  it('transitions to collapsed phase when a cycle is formed', () => {
    const engine = setupColumnCycle();
    const state = engine.getState();

    expect(state.phase).toBe('collapsed');
    expect(state.pendingCollapseTargets).toContain(0);
    expect(state.pendingCollapseTargets).toContain(3);
    expect(state.pendingCollapseTargets).toContain(6);
    expect(state.currentPlayer).toBe('O');
  });

  it('getLegalMoves returns CollapseMove[] in collapsed phase', () => {
    const engine = setupColumnCycle();
    const moves = engine.getLegalMoves();
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every(m => m.type === 'collapse')).toBe(true);
  });
});

describe('QuantumTTTEngine — CollapseMove', () => {
  it('resolves collapse, confirms cells, and keeps currentPlayer (non-winning cycle)', () => {
    const engine = setupNonWinningCycle();
    const collapseMaker = engine.getState().currentPlayer; // 'O'

    // collapse(0,1) → X0 confirmed in cell 0 → cell 0=✓X, cell 1=✓O, cell 4=✓X
    const state = engine.applyMove(collapse(0, 1));

    expect(state.phase).toBe('playing');
    expect(state.pendingCollapseTargets).toBeNull();
    expect(state.currentPlayer).toBe(collapseMaker); // O still — no switch after collapse
    expect(state.cells[0].confirmedBy).not.toBeNull();
    expect(state.cells[1].confirmedBy).not.toBeNull();
    expect(state.cells[4].confirmedBy).not.toBeNull();
  });

  it('winning cycle: phase becomes finished and winner is set', () => {
    const engine = setupColumnCycle();
    const state = engine.applyMove(collapse(0, 3));
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('X');
    expect(engine.getLegalMoves()).toHaveLength(0);
  });

  it('winning cycle: collapse(0,3) confirms X0→cell0, X2→cell3, X4→cell6; X wins', () => {
    // Cycle cells 0,3,6 hold only X marks (X placed all three edges).
    // collapse(0,3): startMark = X0(pair=3) in cell 0.
    //   cell 0 = ✓X[X0], cell 3 = ✓X[X2], cell 6 = ✓X[X4] → column 0 → X wins.
    const engine = setupColumnCycle();
    const state = engine.applyMove(collapse(0, 3));

    expect(state.cells[0].confirmedBy).toBe('X');
    expect(state.cells[0].quantumMarks[0].moveIndex).toBe(0);
    expect(state.cells[3].confirmedBy).toBe('X');
    expect(state.cells[3].quantumMarks[0].moveIndex).toBe(2);
    expect(state.cells[6].confirmedBy).toBe('X');
    expect(state.cells[6].quantumMarks[0].moveIndex).toBe(4);

    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('X');
    expect(engine.getLegalMoves()).toHaveLength(0);
  });

  it('winning cycle: collapse(0,6) confirms X4→cell0, X0→cell3, X2→cell6; X wins', () => {
    // startMark = X4(pair=6) in cell 0.
    //   cell 0 = ✓X[X4], cell 3 = ✓X[X0], cell 6 = ✓X[X2] → column 0 → X wins.
    const engine = setupColumnCycle();
    const state = engine.applyMove(collapse(0, 6));

    expect(state.cells[0].confirmedBy).toBe('X');
    expect(state.cells[0].quantumMarks[0].moveIndex).toBe(4);
    expect(state.cells[3].confirmedBy).toBe('X');
    expect(state.cells[3].quantumMarks[0].moveIndex).toBe(0);
    expect(state.cells[6].confirmedBy).toBe('X');
    expect(state.cells[6].quantumMarks[0].moveIndex).toBe(2);

    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('X');
    expect(engine.getLegalMoves()).toHaveLength(0);
  });
});

describe('QuantumTTTEngine — toKifuEntry', () => {
  it('records correct player, turnNumber, move, and snapshot', () => {
    const engine = new QuantumTTTEngine();
    const move = place(0, 1);
    const snapshot = engine.applyMove(move);
    const entry = engine.toKifuEntry(move);

    expect(entry.player).toBe('X');
    expect(entry.turnNumber).toBe(1);
    expect(entry.move).toBe(move);
    expect(entry.snapshot).toBe(snapshot);
  });

  it('increments turnNumber on each applyMove', () => {
    const engine = new QuantumTTTEngine();
    engine.applyMove(place(0, 1));
    const move2 = place(2, 3);
    engine.applyMove(move2);
    const entry = engine.toKifuEntry(move2);
    expect(entry.turnNumber).toBe(2);
    expect(entry.player).toBe('O');
  });
});

describe('QuantumTTTEngine — invalid move errors', () => {
  it('throws when PlaceMove is applied in collapsed phase', () => {
    const engine = setupColumnCycle();
    expect(() => engine.applyMove(place(2, 5))).toThrow();
  });

  it('throws when CollapseMove is applied in playing phase', () => {
    const engine = new QuantumTTTEngine();
    expect(() => engine.applyMove(collapse(0, 1))).toThrow();
  });

  it('throws when PlaceMove targets the same cell twice', () => {
    const engine = new QuantumTTTEngine();
    expect(() => engine.applyMove(place(0, 0))).toThrow();
  });

  it('throws when PlaceMove targets a confirmed cell', () => {
    const engine = setupNonWinningCycle();
    engine.applyMove(collapse(0, 1)); // confirms cells 0,1,4; phase='playing', currentPlayer='O'
    // cell 0 is confirmed; trying to place on it should throw
    expect(() => engine.applyMove(place(0, 5))).toThrow();
  });
});
