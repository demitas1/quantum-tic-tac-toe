import type { Cell, CellIndex, CollapseMove, QuantumMark } from '../types';

// cycleNodes is available for validation in QuantumTTTEngine; not used in BFS itself.
export function resolveCollapse(
  cells: Cell[],
  cycleNodes: CellIndex[],
  choice: CollapseMove,
): Cell[] {
  const newCells: Cell[] = cells.map(c => ({
    quantumMarks: [...c.quantumMarks],
    confirmedBy: c.confirmedBy,
  }));

  const startMark = newCells[choice.targetCell].quantumMarks.find(
    m => m.pairCell === choice.pairCell,
  );
  if (!startMark) throw new Error('invalid collapse choice: mark not found in targetCell');

  const queue: Array<[CellIndex, QuantumMark]> = [[choice.targetCell, startMark]];

  while (queue.length > 0) {
    const [cellIdx, mark] = queue.shift()!;

    if (newCells[cellIdx].confirmedBy !== null) continue;

    // Step 1: Confirm this cell with this mark
    newCells[cellIdx].confirmedBy = mark.player;

    // Step 2: The confirmed mark does not land in its pair cell.
    // Remove the partner mark (same moveIndex) from the pair cell.
    // If the pair cell is now down to 1 mark, it must be confirmed next.
    const partnerCellIdx = mark.pairCell;
    if (newCells[partnerCellIdx].confirmedBy === null) {
      newCells[partnerCellIdx].quantumMarks = newCells[partnerCellIdx].quantumMarks.filter(
        m => m.moveIndex !== mark.moveIndex,
      );
      if (newCells[partnerCellIdx].quantumMarks.length === 1) {
        queue.push([partnerCellIdx, newCells[partnerCellIdx].quantumMarks[0]]);
      }
    }

    // Step 3: Each rejected mark (every mark other than the confirmed one) must
    // land in its own pair cell. Find the corresponding mark there and enqueue.
    const rejected = newCells[cellIdx].quantumMarks.filter(
      m => m.moveIndex !== mark.moveIndex,
    );
    for (const r of rejected) {
      if (newCells[r.pairCell].confirmedBy !== null) continue;
      const landingMark = newCells[r.pairCell].quantumMarks.find(
        m => m.moveIndex === r.moveIndex,
      );
      if (landingMark) queue.push([r.pairCell, landingMark]);
    }

    // Step 4: Keep only the confirming mark (required by victory.ts to read moveIndex)
    newCells[cellIdx].quantumMarks = [mark];
  }

  return newCells;
}
