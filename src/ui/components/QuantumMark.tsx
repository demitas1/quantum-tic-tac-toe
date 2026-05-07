import type { QuantumMark as QMType } from '../../engine/types';

interface Props {
  mark: QMType;
}

export default function QuantumMark({ mark }: Props) {
  const colorClass = mark.player === 'X' ? 'text-blue-600' : 'text-red-600';
  return (
    <span className={`text-xs font-medium leading-tight ${colorClass}`}>
      {mark.player}<sub>{mark.moveIndex}</sub>
    </span>
  );
}
