# 実装計画

> 設計上の未確定事項はすべて解決済み。

---

## Phase 0: プロジェクトセットアップ ✅ 完了

主要パッケージバージョン：React 18.3.1 / TypeScript 6.0.3 / Vite 8.0.10 / Vitest 4.1.5 / Tailwind CSS 4.2.4

`create-vite` が非対話モードで動作しないため、設定ファイルを手動作成して `npm install` を実行した。
`vite.config.ts` に `environment: 'node'` と `globals: true` を設定済み。Tailwind v4 は設定ファイル不要。

---

## Phase 1: ゲームエンジン単体実装

**UI実装禁止ゲート。全テストパスまで Phase 2 に進まない。**

### 実装順序

#### 1-1. `src/engine/types.ts`

全型定義を実装する。Q1・Q2 が解決してから着手すること。

- `Player`, `CellIndex`
- `QuantumMark`, `Cell`, `BoardState`（`pendingCollapseTargets: CellIndex[] | null` を含む）
- `PlaceMove`, `CollapseMove`, `Move`
- `KifuEntry`

#### 1-2. `src/engine/GameEngine.ts`

抽象インターフェースを定義する。

- `getWinner()` は削除済み。勝者は `BoardState.winner` で参照する
- `toKifuEntry` は `applyMove` 直後に呼び出す（スナップショット = applyMove後の状態）

#### 1-3. `src/engine/quantum-tictactoe/entanglement.ts`

graphology を使ったもつれネットワーク管理。

```typescript
export function addEntanglement(graph: Graph, cell1: CellIndex, cell2: CellIndex, moveIndex: number): void;
export function detectCycle(graph: Graph): CellIndex[] | null;
export function getEntangledCells(graph: Graph, cell: CellIndex): CellIndex[];
```

- ノード: マスインデックス（0〜8）
- エッジ: 1手につき1本、`moveIndex` をエッジ属性として持つ
- サイクル検出は graphology の `hasCycle` またはDFSで実装する

#### 1-4. `src/engine/quantum-tictactoe/victory.ts`

勝利判定ロジック。collapse 完了後に呼び出される前提で実装する。

- 縦・横・斜めの8ラインをチェック
- 両者同時成立の場合は `moveIndex` が小さい方の勝ち

```typescript
export function checkVictory(cells: Cell[]): Player | 'draw' | null;
```

#### 1-5. `src/engine/quantum-tictactoe/collapse.ts`

収束処理。**再帰禁止、BFS/DFSキューで実装すること。**

- サイクルを構成するマスのリストと `CollapseMove`（`targetCell` + `pairCell`）を受け取り、連鎖的に確定処理を行う
- `targetCell` にマークを確定 → `pairCell` から連鎖をBFSで展開

```typescript
export function resolveCollapse(cells: Cell[], cycleNodes: CellIndex[], choice: CollapseMove): Cell[];
```

#### 1-6. `src/engine/quantum-tictactoe/QuantumTTTEngine.ts`

`GameEngine` インターフェースの実装。上記モジュールを組み合わせてゲームフローを制御する。

- `applyMove(PlaceMove)`: 量子マーク配置 → サイクル検出 → サイクルあれば `phase='collapsed'`
- `applyMove(CollapseMove)`: 収束処理 → 勝利判定 → フェーズ更新
- `getLegalMoves()`: フェーズに応じて `PlaceMove[]` または `CollapseMove[]` を返す

#### 1-7. テスト

各モジュールに対して `*.test.ts` を同ディレクトリに配置する。

| テストファイル | 主なケース |
|---|---|
| `entanglement.test.ts` | エッジ追加、サイクルなし、サイクルあり |
| `victory.test.ts` | X勝ち、O勝ち、引き分け、両者同時成立 |
| `collapse.test.ts` | 単純収束、2連鎖、3連鎖 |
| `QuantumTTTEngine.test.ts` | 正常ゲームフロー、不正手の拒否 |

```bash
npm run test -- --run src/engine/
```

---

## Phase 2: Zustand ストア + 基本UI（配置のみ）

### 前提

Phase 1 の全テストがパスしていること。

### 実装内容

#### 2-1. `src/store/gameStore.ts`

```typescript
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
```

#### 2-2. UI コンポーネント（最小限）

- `src/ui/App.tsx`
- `src/ui/components/GameBoard.tsx` — 3×3グリッド
- `src/ui/components/Cell.tsx` — 量子マーク表示、合法手ハイライト
- `src/ui/components/QuantumMark.tsx` — マーク表示（X₁, O₂ 形式）

### 完了条件

- 2マス選択で量子マークを置ける
- 合法手外のマスはクリックしても何も起きない
- 収束フローはまだ動かなくてよい（`phase='collapsed'` のままでも可）

---

## Phase 3: 収束UI

### 実装内容

- `phase='collapsed'` 時に収束候補マスをハイライト表示
- 相手プレイヤーが候補マスをクリックして `CollapseMove` を送信
- 連鎖収束のアニメーション（任意）
- `src/ui/components/TurnIndicator.tsx` — フェーズ表示含む

### 完了条件

- 収束フローが最後まで正しく動作する
- 勝者表示が出る

---

## Phase 4: もつれネットワーク可視化

### 実装内容

- `src/ui/components/EntanglementOverlay.tsx` — SVGでマス間の関係を線描画
- `GameBoard` の上にオーバーレイとして重ねる

### 完了条件

- 量子マークを置くたびに対応するマス間に線が引かれる
- 収束後は解消された線が消える

---

## Phase 5: 棋譜記録・再生

### 実装内容

#### 5-1. `src/engine/kifu/KifuRecorder.ts`

- `applyMove` 直後に `toKifuEntry` を呼び出して `KifuEntry` を積む
- スナップショットは applyMove 後（収束・勝利判定完了後）の `BoardState`

#### 5-2. `src/engine/kifu/KifuReplayer.ts`

- インデックス指定で `KifuEntry` を返すユーティリティとして実装
- ゲームエンジン・ストアへの依存なし。ストアの `replayIndex` が位置を管理する

#### 5-3. `src/ui/components/KifuPanel.tsx`

- 手順リスト表示（クリックでその時点に移動）
- JSONエクスポートボタン
- JSONインポート（ファイル読み込み）

### 完了条件

- JSONエクスポート・インポートが動作する
- 再生中に1手ずつ進む・戻るができる
- 再生中はゲームへの入力が無効化されている

---

## 未確定事項との対応まとめ

| 質問 | 影響フェーズ | 対応方針 |
|------|------------|---------|
| Q1: `CollapseMove` フィールド | Phase 1（型定義・collapse.ts） | ✅ 解決済み（`resolveChoice` → `pairCell`） |
| Q2: 収束候補マスの表現 | Phase 1（BoardState）・Phase 3（UI） | ✅ 解決済み（`pendingCollapseTargets` を追加） |
| Q3: `getWinner()` の要否 | Phase 1（GameEngine.ts） | ✅ 解決済み（削除、`BoardState.winner` に統一） |
| Q4: `KifuReplayer` インターフェース | Phase 5 | ✅ 解決済み（インデックス→KifuEntry を返すユーティリティ） |
| Q5: `toKifuEntry` スナップショットタイミング | Phase 5 | ✅ 解決済み（applyMove 直後） |
