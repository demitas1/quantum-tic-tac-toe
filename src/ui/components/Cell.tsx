import type { Cell as CellType, CellIndex, Move, PlaceMove } from '../../engine/types';
import QuantumMark from './QuantumMark';

interface Props {
  index: CellIndex;
  cell: CellType;
  isSelected: boolean;
  legalMoves: Move[];
  onClick: (index: CellIndex) => void;
}

export default function Cell({ index, cell, isSelected, legalMoves, onClick }: Props) {
  const placeMoves = legalMoves.filter((m): m is PlaceMove => m.type === 'place');
  const isLegal = placeMoves.some(m => m.cells.includes(index));
  const isConfirmed = cell.confirmedBy !== null;

  const borderClass = isSelected
    ? 'border-yellow-400 bg-yellow-50'
    : 'border-gray-300';

  const hoverClass = isLegal && !isSelected && !isConfirmed
    ? 'hover:bg-gray-100 cursor-pointer'
    : 'cursor-default';

  return (
    <div
      className={`w-24 h-24 border-2 flex flex-wrap content-center justify-center gap-0.5 p-1 select-none ${borderClass} ${hoverClass}`}
      onClick={() => onClick(index)}
    >
      {isConfirmed ? (
        <span className={`text-3xl font-bold ${cell.confirmedBy === 'X' ? 'text-blue-600' : 'text-red-600'}`}>
          {cell.confirmedBy}<sub className="text-base">{cell.quantumMarks[0]?.moveIndex}</sub>
        </span>
      ) : (
        cell.quantumMarks.map((mark, i) => (
          <QuantumMark key={i} mark={mark} />
        ))
      )}
    </div>
  );
}
