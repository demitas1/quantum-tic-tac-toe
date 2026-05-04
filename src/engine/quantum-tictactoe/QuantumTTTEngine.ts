import Graph from 'graphology';
import type { GameEngine } from '../GameEngine';
import type { BoardState, Cell, CellIndex, CollapseMove, KifuEntry, Move, PlaceMove, Player } from '../types';
import { addEntanglement, detectCycle } from './entanglement';
import { resolveCollapse } from './collapse';
import { checkVictory } from './victory';

function makeInitialState(): BoardState {
  return {
    cells: Array.from({ length: 9 }, (): Cell => ({ quantumMarks: [], confirmedBy: null })),
    currentPlayer: 'X',
    moveCount: 0,
    phase: 'playing',
    winner: null,
    pendingCollapseTargets: null,
  };
}

export class QuantumTTTEngine implements GameEngine {
  private state: BoardState;
  private graph: Graph;
  private cycleNodes: CellIndex[] | null;
  private kifuTurnNumber: number;
  private lastAppliedPlayer: Player | null;

  constructor() {
    this.state = makeInitialState();
    this.graph = new Graph({ type: 'undirected', multi: true });
    this.cycleNodes = null;
    this.kifuTurnNumber = 0;
    this.lastAppliedPlayer = null;
  }

  getState(): BoardState {
    return this.state;
  }

  getLegalMoves(): Move[] {
    const { phase, cells, pendingCollapseTargets } = this.state;

    if (phase === 'playing') {
      const unconfirmed: CellIndex[] = [];
      for (let i = 0; i < 9; i++) {
        if (cells[i].confirmedBy === null) unconfirmed.push(i as CellIndex);
      }
      const moves: PlaceMove[] = [];
      for (let i = 0; i < unconfirmed.length; i++) {
        for (let j = i + 1; j < unconfirmed.length; j++) {
          moves.push({ type: 'place', cells: [unconfirmed[i], unconfirmed[j]] });
        }
      }
      return moves;
    }

    if (phase === 'collapsed') {
      const targets = pendingCollapseTargets!;
      const moves: CollapseMove[] = [];
      for (const t of targets) {
        for (const mark of cells[t].quantumMarks) {
          if (targets.includes(mark.pairCell)) {
            moves.push({ type: 'collapse', targetCell: t, pairCell: mark.pairCell });
          }
        }
      }
      return moves;
    }

    return [];
  }

  applyMove(move: Move): BoardState {
    this.lastAppliedPlayer = this.state.currentPlayer;
    this.kifuTurnNumber++;

    if (move.type === 'place') {
      return this.applyPlaceMove(move);
    } else {
      return this.applyCollapseMove(move);
    }
  }

  private applyPlaceMove(move: PlaceMove): BoardState {
    const { cells, currentPlayer, moveCount, phase } = this.state;
    const [c1, c2] = move.cells;

    if (phase !== 'playing') throw new Error('place: not in playing phase');
    if (c1 === c2) throw new Error('place: cells must be different');
    if (cells[c1].confirmedBy !== null || cells[c2].confirmedBy !== null) {
      throw new Error('place: cannot place on a confirmed cell');
    }

    const newCells: Cell[] = cells.map(c => ({
      quantumMarks: [...c.quantumMarks],
      confirmedBy: c.confirmedBy,
    }));

    const moveIndex = moveCount;
    newCells[c1].quantumMarks.push({ player: currentPlayer, moveIndex, pairCell: c2 });
    newCells[c2].quantumMarks.push({ player: currentPlayer, moveIndex, pairCell: c1 });
    addEntanglement(this.graph, c1, c2, moveIndex);

    const cycle = detectCycle(this.graph);
    const nextPlayer: Player = currentPlayer === 'X' ? 'O' : 'X';

    if (cycle) {
      this.cycleNodes = cycle;
      this.state = {
        cells: newCells,
        currentPlayer: nextPlayer,
        moveCount: moveCount + 1,
        phase: 'collapsed',
        winner: null,
        pendingCollapseTargets: cycle,
      };
    } else {
      this.cycleNodes = null;
      this.state = {
        cells: newCells,
        currentPlayer: nextPlayer,
        moveCount: moveCount + 1,
        phase: 'playing',
        winner: null,
        pendingCollapseTargets: null,
      };
    }

    return this.state;
  }

  private applyCollapseMove(move: CollapseMove): BoardState {
    const { cells, currentPlayer, moveCount } = this.state;

    if (this.state.phase !== 'collapsed') throw new Error('collapse: not in collapsed phase');

    const newCells = resolveCollapse(cells, this.cycleNodes!, move);

    for (let i = 0; i < 9; i++) {
      if (newCells[i].confirmedBy !== null && this.graph.hasNode(String(i))) {
        this.graph.dropNode(String(i));
      }
    }

    const winner = checkVictory(newCells);

    this.cycleNodes = null;
    this.state = {
      cells: newCells,
      currentPlayer,
      moveCount,
      phase: winner !== null ? 'finished' : 'playing',
      winner: winner ?? null,
      pendingCollapseTargets: null,
    };

    return this.state;
  }

  toKifuEntry(move: Move): KifuEntry {
    return {
      turnNumber: this.kifuTurnNumber,
      player: this.lastAppliedPlayer!,
      move,
      snapshot: this.state,
      timestamp: Date.now(),
    };
  }
}
