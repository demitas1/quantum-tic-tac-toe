# 量子三目並べ DESIGN.md

Claude Code への引き継ぎ用設計書。コードを書く前にこのドキュメントを読み、不明点があれば実装前に確認すること。

---

## プロジェクト概要

ブラウザ上でプレイできる量子三目並べの実装。  
将来的に拡張したルールのゲームを実装する基盤とすることをを見越し、**ゲームロジック層とUI層の完全分離**を最優先の非機能要求とする。

---

## 技術スタック

| 役割 | 採用技術 |
|---|---|
| UIフレームワーク | React + TypeScript |
| 状態管理 | Zustand |
| グラフ処理 | graphology |
| 描画（もつれ可視化） | SVG（Reactインライン） |
| ビルド | Vite |
| デプロイ | Cloudflare Pages（設定未作成） |
| 棋譜フォーマット | JSON |

---

## 非機能要求

### 最優先：ゲームロジック層とUI層の完全分離

これはプロジェクト全体を通じて**最も重要なアーキテクチャ制約**である。

**原則**

- ゲームロジック層はReactに一切依存しない純粋なTypeScriptモジュールとして実装する
- UIコンポーネントはゲームロジック層を呼び出すのみで、ゲームのルール判断を自身で行わない
- ゲームロジック層のユニットテストはブラウザなしで実行できること

**理由**

将来的にルールを拡張する際、UI層を再利用しながらゲームエンジン実装を差し替えられる設計にするため。

**違反例（禁止）**

```typescript
// ❌ UIコンポーネント内でルール判断を行っている
const Cell = ({ index }) => {
  const handleClick = () => {
    if (marks.filter(m => m.cell === index).length >= 2) return; // ← ロジックがUIに混在
    placeQuantumMark(index);
  };
};
```

**正しい例**

```typescript
// ✅ ロジック層が合法手を返し、UIはそれを表示するだけ
const Cell = ({ index }) => {
  const legalMoves = useGameStore(s => s.legalMoves); // エンジンが計算済み
  const handleClick = () => {
    if (!legalMoves.includes(index)) return;
    useGameStore.getState().placeQuantumMark(index);
  };
};
```

---

## アーキテクチャ

```
src/
├── engine/                        # ゲームロジック層（React非依存）
│   ├── types.ts                   # 型定義
│   ├── GameEngine.ts              # エンジン抽象インターフェース
│   ├── quantum-tictactoe/
│   │   ├── QuantumTTTEngine.ts    # ゲームロジック実装
│   │   ├── entanglement.ts        # もつれネットワーク管理（graphology）
│   │   ├── collapse.ts            # 収束処理
│   │   └── victory.ts             # 勝利判定
│   └── kifu/
│       ├── KifuRecorder.ts        # 棋譜記録
│       └── KifuReplayer.ts        # 棋譜再生
├── store/
│   └── gameStore.ts               # Zustand（エンジンとUIの橋渡し）
└── ui/                            # UI層（エンジンを呼び出すのみ）
    ├── components/
    │   ├── GameBoard.tsx
    │   ├── Cell.tsx
    │   ├── QuantumMark.tsx
    │   ├── EntanglementOverlay.tsx
    │   ├── TurnIndicator.tsx
    │   └── KifuPanel.tsx
    └── App.tsx
```

---

## ゲームエンジン抽象インターフェース

将来の拡張に備え、ゲームエンジンは以下のインターフェースを実装する。  
新しいルールでのゲームを実装するときは、このインターフェースを満たす別クラスを追加するだけでよい。

```typescript
// engine/GameEngine.ts

export interface GameEngine {
  /** 現在の盤面状態を返す */
  getState(): BoardState;

  /**
   * 現在のプレイヤーが実行できる合法手を返す。
   * phase='playing' のとき PlaceMove[] のみ、phase='collapsed' のとき CollapseMove[] のみを返す。
   * 両者が混在することはない。
   */
  getLegalMoves(): Move[];

  /** 手を実行し、収束処理まで完了した新しい状態を返す */
  applyMove(move: Move): BoardState;

  /**
   * 棋譜エントリを生成する。applyMove の直後に呼び出すこと。
   * snapshot には applyMove 実行後の状態（現在の getState()）を使用する。
   */
  toKifuEntry(move: Move): KifuEntry;
}
```

---

## 型定義

```typescript
// engine/types.ts

export type Player = 'X' | 'O';
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 3x3

export interface QuantumMark {
  player: Player;
  moveIndex: number;       // 何手目か（添字）
  pairCell: CellIndex;     // ペアの相手のマス
}

export interface Cell {
  quantumMarks: QuantumMark[];
  confirmedBy: Player | null;  // 収束済みの場合の勝者
}

export interface BoardState {
  cells: Cell[];                              // 長さ9
  currentPlayer: Player;
  moveCount: number;
  phase: 'playing' | 'collapsed' | 'finished';
  winner: Player | 'draw' | null;
  pendingCollapseTargets: CellIndex[] | null; // phase='collapsed' 時のみ非null（相手が選べるマスの一覧）
}

export interface PlaceMove {
  type: 'place';
  cells: [CellIndex, CellIndex];  // 重ね合わせを置く2マス
}

export interface CollapseMove {
  type: 'collapse';
  targetCell: CellIndex;  // 相手が「確定させる」と選んだマス（ここにマークが落ちる）
  pairCell: CellIndex;    // targetCell の量子マークのペアのマス（連鎖収束の起点となる）
}

export type Move = PlaceMove | CollapseMove;

export interface KifuEntry {
  turnNumber: number;
  player: Player;
  move: Move;
  snapshot: BoardState;
  timestamp: string;  // ISO8601
}
```

---

## ゲームロジックの実装要件

### もつれネットワーク（entanglement.ts）

- graphologyのグラフとして管理する
- **ノード**：マスのインデックス（0〜8）
- **エッジ**：量子手によるマス間の関係（1手につき1エッジ）
- 循環（サイクル）の検出にはgraphologyの`hasCycle`またはDFS実装を使用する
- 循環検出は量子マークを置くたびに実行する

```typescript
// entanglement.tsの責務
export function addEntanglement(graph: Graph, cell1: CellIndex, cell2: CellIndex, moveIndex: number): void;
export function detectCycle(graph: Graph): CellIndex[] | null;  // 循環するマスの列を返す、なければnull
export function getEntangledCells(graph: Graph, cell: CellIndex): CellIndex[];
```

### 収束処理（collapse.ts）

- 循環検出後、循環を構成するマスのリストを受け取る
- **相手プレイヤー**（循環を作ったのではない方）が収束先を選択する
- 選択後、連鎖的に他のマスの収束を処理する
- 収束処理は再帰ではなくキューを使ったBFS/DFSで実装する（スタックオーバーフロー回避）

### 勝利判定（victory.ts）

- 収束処理の完了後に呼び出す
- 3マス連続（縦・横・斜め）の確定マークを確認する
- **両者が同時に3つ並んだ場合**、moveIndexが小さい（先に置いた）方の勝ち

---

## 棋譜の設計

### 記録形式

```json
{
  "version": "1.0",
  "game": "quantum-tictactoe",
  "startedAt": "2026-04-27T10:00:00Z",
  "result": "X",
  "moves": [
    {
      "turnNumber": 1,
      "player": "X",
      "move": { "type": "place", "cells": [0, 4] },
      "snapshot": { ... },
      "timestamp": "2026-04-27T10:00:05Z"
    }
  ]
}
```

### 記録の考え方

`KifuRecorder` は `applyMove` 直後（収束処理完了後）の `BoardState` をスナップショットとして記録する。  
各 `KifuEntry.snapshot` は手番完了時点の確定した状態を表す。

### 再生の考え方

`KifuReplayer` は記録済みの `KifuEntry[]` を受け取り、インデックス指定で `KifuEntry` を返すだけのユーティリティとする。  
ゲームエンジンを呼び出したり状態を書き換えたりしない。Zustand ストアの再生モードが `replayIndex` を管理し、対応するスナップショットをUIに渡す。

### 棋譜の再生要件

- 棋譜JSONを読み込み、任意の手番のスナップショットを復元できること
- 再生モードでは手番を1つずつ進める・戻るができること
- 再生中はゲームエンジンへの手の入力を無効化すること

---

## Zustand ストアの設計方針

```typescript
// store/gameStore.ts

interface GameStore {
  // 状態（エンジンから取得）
  boardState: BoardState;
  legalMoves: Move[];
  kifu: KifuEntry[];

  // アクション（エンジンを呼び出す）
  applyMove: (move: Move) => void;
  resetGame: () => void;

  // 棋譜操作
  exportKifu: () => string;  // JSON文字列
  importKifu: (json: string) => void;

  // 再生モード
  replayMode: boolean;
  replayIndex: number;
  stepForward: () => void;
  stepBackward: () => void;
}
```

UIコンポーネントはこのストアのみを参照し、エンジンを直接呼び出さない。

---

## UIコンポーネントの実装要件

### GameBoard

- 3×3グリッドをSVGまたはCSSグリッドで描画
- もつれネットワークの可視化（SVGの線）をCellの上にオーバーレイ表示
- 収束アニメーションは任意（後回し可）

### Cell

- 未確定マス：そのマスに置かれた全ての量子マークを表示
  - 例：X₁ O₃ が重なっている場合は両方を表示
- 確定マス：確定した勝者のマーク（XまたはO）を大きく表示
- 現在の合法手に含まれるマスはハイライト表示

### KifuPanel

- 棋譜の手順リストを表示（クリックでその時点に移動）
- JSONエクスポートボタン
- JSONインポート（ファイル読み込み）

---

## 実装フェーズ

| Phase | 内容 | 完了条件 |
|---|---|---|
| 1 | ゲームロジック単体実装 | ユニットテストが全てパス。ブラウザ不要で動作確認 |
| 2 | Zustandストア + 基本UI（配置のみ） | 量子マークを盤面に置けること |
| 3 | 収束UI（選択・連鎖表示） | 収束フローが正しく動作すること |
| 4 | もつれネットワーク可視化 | マス間の関係が線で表示されること |
| 5 | 棋譜記録・再生 | JSONエクスポート・インポートと手番移動が動作すること |

**Phase 1が完了するまでUI実装を開始しないこと。**

---

## 注意事項

- `engine/` 配下のファイルは `react` を import してはならない
- `engine/` 配下のファイルのテストは Vitest で記述し、jsdom不要で実行できること
- graphologyのバージョンは最新安定版を使用すること
- 収束処理の再帰実装は禁止（BFS/DFSキューを使うこと）
