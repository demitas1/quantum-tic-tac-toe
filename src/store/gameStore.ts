import { create } from 'zustand';
import { QuantumTTTEngine } from '../engine/quantum-tictactoe/QuantumTTTEngine';
import type { BoardState, KifuEntry, Move } from '../engine/types';

interface GameStore {
  boardState: BoardState;
  legalMoves: Move[];
  kifu: KifuEntry[];
  applyMove: (move: Move) => void;
  resetGame: () => void;
  exportKifu: () => string;
  importKifu: (json: string) => void;
  replayMode: boolean;
  replayIndex: number;
  stepForward: () => void;
  stepBackward: () => void;
}

function makeEngine() {
  return new QuantumTTTEngine();
}

export const useGameStore = create<GameStore>((set, get) => {
  let engine = makeEngine();

  return {
    boardState: engine.getState(),
    legalMoves: engine.getLegalMoves(),
    kifu: [],
    replayMode: false,
    replayIndex: 0,

    applyMove: (move: Move) => {
      engine.applyMove(move);
      const entry = engine.toKifuEntry(move);
      set({
        boardState: engine.getState(),
        legalMoves: engine.getLegalMoves(),
        kifu: [...get().kifu, entry],
      });
    },

    resetGame: () => {
      engine = makeEngine();
      set({
        boardState: engine.getState(),
        legalMoves: engine.getLegalMoves(),
        kifu: [],
        replayMode: false,
        replayIndex: 0,
      });
    },

    exportKifu: () => JSON.stringify([]),
    importKifu: (_json: string) => {},
    stepForward: () => {},
    stepBackward: () => {},
  };
});
