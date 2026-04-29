import type { BoardState, Move, KifuEntry } from './types';

export interface GameEngine {
  getState(): BoardState;

  /**
   * Returns legal moves for the current player.
   * During phase='playing': PlaceMove[] only.
   * During phase='collapsed': CollapseMove[] only.
   * Never mixed.
   */
  getLegalMoves(): Move[];

  /** Applies a move (including collapse resolution) and returns the new state. */
  applyMove(move: Move): BoardState;

  /**
   * Generates a kifu entry. Call immediately after applyMove.
   * snapshot must be the state returned by applyMove (post-move).
   */
  toKifuEntry(move: Move): KifuEntry;
}
