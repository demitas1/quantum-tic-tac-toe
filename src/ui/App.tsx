import { useGameStore } from '../store/gameStore';
import GameBoard from './components/GameBoard';

export default function App() {
  const currentPlayer = useGameStore(s => s.boardState.currentPlayer);
  const phase = useGameStore(s => s.boardState.phase);
  const winner = useGameStore(s => s.boardState.winner);
  const resetGame = useGameStore(s => s.resetGame);

  return (
    <div className="flex flex-col items-center gap-6 p-8 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold">Quantum Tic-Tac-Toe</h1>

      <div className="text-lg">
        {phase === 'finished' ? (
          <span className="font-semibold">
            {winner === 'draw' ? 'Draw!' : `${winner} wins!`}
          </span>
        ) : phase === 'collapsed' ? (
          <span>Collapse phase — <span className="font-semibold">{currentPlayer}</span> to resolve</span>
        ) : (
          <span>Turn: <span className="font-semibold">{currentPlayer}</span></span>
        )}
      </div>

      <GameBoard />

      <button
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        onClick={resetGame}
      >
        Reset
      </button>
    </div>
  );
}
