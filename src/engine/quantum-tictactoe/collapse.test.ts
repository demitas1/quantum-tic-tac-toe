import type { Cell, CellIndex, QuantumMark } from '../types';
import { resolveCollapse } from './collapse';

function qm(player: 'X' | 'O', moveIndex: number, pairCell: CellIndex): QuantumMark {
  return { player, moveIndex, pairCell };
}

function cell(marks: QuantumMark[]): Cell {
  return { quantumMarks: marks, confirmedBy: null };
}

function emptyCell(): Cell {
  return { quantumMarks: [], confirmedBy: null };
}

// 3-node cycle board: cells 0,1,2 in a cycle; cells 3-8 empty.
// Simulates:
//   Move 0 (X, 0-1): cell0=[X0(p=1)], cell1=[X0(p=0)]
//   Move 1 (O, 1-2): cell1+=[O1(p=2)], cell2=[O1(p=1)]
//   Move 2 (X, 0-2): cell0+=[X2(p=2)], cell2+=[X2(p=0)] → cycle [0,1,2]
function makeCycleBoard(): Cell[] {
  return [
    cell([qm('X', 0, 1), qm('X', 2, 2)]), // cell 0
    cell([qm('X', 0, 0), qm('O', 1, 2)]), // cell 1
    cell([qm('O', 1, 1), qm('X', 2, 0)]), // cell 2
    emptyCell(), emptyCell(), emptyCell(),
    emptyCell(), emptyCell(), emptyCell(),
  ];
}

const CYCLE_NODES_012 = [0, 1, 2] as CellIndex[];

describe('resolveCollapse — 3-node cycle', () => {
  it('collapses correctly when targetCell=0, pairCell=1 (confirms X0 in cell 0)', () => {
    const cells = makeCycleBoard();
    const result = resolveCollapse(cells, CYCLE_NODES_012, {
      type: 'collapse', targetCell: 0, pairCell: 1,
    });

    expect(result[0].confirmedBy).toBe('X');
    expect(result[0].quantumMarks).toEqual([qm('X', 0, 1)]);

    expect(result[1].confirmedBy).toBe('O');
    expect(result[1].quantumMarks).toEqual([qm('O', 1, 2)]);

    expect(result[2].confirmedBy).toBe('X');
    expect(result[2].quantumMarks).toEqual([qm('X', 2, 0)]);
  });

  it('collapses correctly when targetCell=0, pairCell=2 (confirms X2 in cell 0)', () => {
    const cells = makeCycleBoard();
    const result = resolveCollapse(cells, CYCLE_NODES_012, {
      type: 'collapse', targetCell: 0, pairCell: 2,
    });

    expect(result[0].confirmedBy).toBe('X');
    expect(result[0].quantumMarks).toEqual([qm('X', 2, 2)]);

    expect(result[1].confirmedBy).toBe('X');
    expect(result[1].quantumMarks).toEqual([qm('X', 0, 0)]);

    expect(result[2].confirmedBy).toBe('O');
    expect(result[2].quantumMarks).toEqual([qm('O', 1, 1)]);
  });

  it('does not mutate the original cells array', () => {
    const cells = makeCycleBoard();
    resolveCollapse(cells, CYCLE_NODES_012, {
      type: 'collapse', targetCell: 0, pairCell: 1,
    });
    expect(cells[0].confirmedBy).toBeNull();
  });

  it('leaves non-cycle cells unchanged', () => {
    const cells = makeCycleBoard();
    const result = resolveCollapse(cells, CYCLE_NODES_012, {
      type: 'collapse', targetCell: 0, pairCell: 1,
    });
    for (let i = 3; i < 9; i++) {
      expect(result[i].confirmedBy).toBeNull();
      expect(result[i].quantumMarks).toHaveLength(0);
    }
  });
});

describe('resolveCollapse — cycle with branch (cycle 0-1-2-0, branch 0-3)', () => {
  // Simulates:
  //   Move 0 (X, 0-3): cell0=[X0(p=3)], cell3=[X0(p=0)]
  //   Move 1 (O, 0-1): cell0+=[O1(p=1)], cell1=[O1(p=0)]
  //   Move 2 (X, 1-2): cell1+=[X2(p=2)], cell2=[X2(p=1)]
  //   Move 3 (O, 0-2): cell0+=[O3(p=2)], cell2+=[O3(p=0)] → cycle [0,1,2]; cell3 is branch
  function makeBranchBoard(): Cell[] {
    return [
      cell([qm('X', 0, 3), qm('O', 1, 1), qm('O', 3, 2)]), // cell 0 (hub)
      cell([qm('O', 1, 0), qm('X', 2, 2)]),                 // cell 1
      cell([qm('X', 2, 1), qm('O', 3, 0)]),                 // cell 2
      cell([qm('X', 0, 0)]),                                  // cell 3 (branch)
      emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(),
    ];
  }

  it('confirms cycle cells and propagates to branch (targetCell=0, pairCell=1)', () => {
    const cells = makeBranchBoard();
    const result = resolveCollapse(cells, [0, 1, 2] as CellIndex[], {
      type: 'collapse', targetCell: 0, pairCell: 1,
    });

    expect(result[0].confirmedBy).toBe('O');
    expect(result[0].quantumMarks).toEqual([qm('O', 1, 1)]);

    expect(result[1].confirmedBy).toBe('X');
    expect(result[1].quantumMarks).toEqual([qm('X', 2, 2)]);

    expect(result[2].confirmedBy).toBe('O');
    expect(result[2].quantumMarks).toEqual([qm('O', 3, 0)]);

    // Branch cell 3 must also be confirmed via cascade
    expect(result[3].confirmedBy).toBe('X');
    expect(result[3].quantumMarks).toEqual([qm('X', 0, 0)]);
  });
});
