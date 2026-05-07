import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import Cell from './Cell';
import type { CellIndex, PlaceMove } from '../../engine/types';

export default function GameBoard() {
  const [firstCell, setFirstCell] = useState<CellIndex | null>(null);
  const boardState = useGameStore(s => s.boardState);
  const legalMoves = useGameStore(s => s.legalMoves);
  const applyMove = useGameStore(s => s.applyMove);

  const handleCellClick = (index: CellIndex) => {
    if (boardState.phase !== 'playing') return;
    const placeMoves = legalMoves.filter((m): m is PlaceMove => m.type === 'place');

    if (firstCell === null) {
      if (placeMoves.some(m => m.cells.includes(index))) {
        setFirstCell(index);
      }
    } else if (index === firstCell) {
      setFirstCell(null);
    } else {
      const move = placeMoves.find(
        m => m.cells.includes(firstCell) && m.cells.includes(index)
      );
      if (move) {
        applyMove(move);
        setFirstCell(null);
      } else if (placeMoves.some(m => m.cells.includes(index))) {
        setFirstCell(index);
      }
    }
  };

  return (
    <div className="grid grid-cols-3 gap-1">
      {boardState.cells.map((cell, i) => (
        <Cell
          key={i}
          index={i as CellIndex}
          cell={cell}
          isSelected={firstCell === i}
          legalMoves={legalMoves}
          onClick={handleCellClick}
        />
      ))}
    </div>
  );
}
