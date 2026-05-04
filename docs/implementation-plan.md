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

#### 1-1. `src/engine/types.ts` ✅ 完了

全型定義を実装する。Q1・Q2 が解決してから着手すること。

- `Player`, `CellIndex`
- `QuantumMark`, `Cell`, `BoardState`（`pendingCollapseTargets: CellIndex[] | null` を含む）
- `PlaceMove`, `CollapseMove`, `Move`
- `KifuEntry`

#### 1-2. `src/engine/GameEngine.ts` ✅ 完了

抽象インターフェースを定義する。

- `getWinner()` は削除済み。勝者は `BoardState.winner` で参照する
- `toKifuEntry` は `applyMove` 直後に呼び出す（スナップショット = applyMove後の状態）

#### 1-3. `src/engine/quantum-tictactoe/entanglement.ts` ✅ 完了

graphology を使ったもつれネットワーク管理。

```typescript
export function addEntanglement(graph: Graph, cell1: CellIndex, cell2: CellIndex, moveIndex: number): void;
export function detectCycle(graph: Graph): CellIndex[] | null;
export function getEntangledCells(graph: Graph, cell: CellIndex): CellIndex[];
```

- ノード: マスインデックス（0〜8）
- エッジ: 1手につき1本、`moveIndex` をエッジ属性として持つ
- サイクル検出は graphology の `hasCycle` またはDFSで実装する

**実装メモ**

- `detectCycle` は**エッジキーで親エッジを追跡する DFS** で実装。ノードキーで親を追跡すると多重辺（同じ2マスを2手で接続した場合）を誤ってスキップしてしまうため、エッジキーを使う必要がある
- サイクル検出時は `path.slice(cycleStart)` でサイクルを構成するノードのみを抽出して返す（起点より手前のパスは含まない）
- `getEntangledCells` は graphology の `neighbors()` を使用。多重辺があっても重複なく隣接ノードを返す
- グラフは呼び出し側（`QuantumTTTEngine`）が `new Graph({ type: 'undirected' })` で生成して渡す

#### 1-4. `src/engine/quantum-tictactoe/victory.ts` ✅ 完了

勝利判定ロジック。collapse 完了後に呼び出される前提で実装する。

- 縦・横・斜めの8ラインをチェック
- 両者同時成立の場合は `moveIndex` が小さい方の勝ち

```typescript
export function checkVictory(cells: Cell[]): Player | 'draw' | null;
```

**実装メモ**

- 各ラインの「決着 moveIndex」= ライン内の最大 moveIndex（最後に置かれたマーク）
- プレイヤーごとに複数勝利ラインがある場合は決着 moveIndex 最小のラインを採用
- 確定マスの moveIndex は `quantumMarks.find(m => m.player === confirmedBy).moveIndex` で取得（collapse.ts との契約）

#### 1-5. `src/engine/quantum-tictactoe/collapse.ts` ✅ 完了

収束処理。**再帰禁止、BFS/DFSキューで実装すること。**

- サイクルを構成するマスのリストと `CollapseMove`（`targetCell` + `pairCell`）を受け取り、連鎖的に確定処理を行う
- `targetCell` にマークを確定 → `pairCell` から連鎖をBFSで展開

```typescript
export function resolveCollapse(cells: Cell[], cycleNodes: CellIndex[], choice: CollapseMove): Cell[];
```

**実装メモ**

BFS の各ステップ（セル `C` をマーク `M` で確定する場合）:

1. `C.confirmedBy = M.player` に設定
2. `M.pairCell` から同じ `moveIndex` のマークを除去（`M` はそこに land しないため）。除去後 1 マークのみになれば enqueue
3. `C` 内の rejected マーク（`M` 以外）は各自の `pairCell` に land する → 対応マークを enqueue
4. `C.quantumMarks = [M]`（victory.ts との契約）

同一セルが複数回 enqueue されることがある。デキュー時に `confirmedBy !== null` でスキップ。

---

**3パターンのシミュレーション**

##### ケース1：シンプルな3マスサイクル（A-B-C-A）

CollapseMove `{targetCell=A, pairCell=B}` → A を X₁ で確定

| ステップ | 操作 | 状態 |
|---|---|---|
| A を X₁ で確定 | B から X₁ 除去 → enqueue(B, O₂); C へ X₃ cascade → enqueue(C, X₃) | A: ✓X |
| B を O₂ で確定 | C から O₂ 除去 → enqueue(C, X₃)（重複） | B: ✓O |
| C を X₃ で確定 | A は確定済みスキップ | C: ✓X |
| C（重複）スキップ | confirmedBy !== null | — |

##### ケース2：2サイクルが1マスを共有するケース

**有効なゲームプレイでは発生しない。**

理由: 1手（エッジ追加）で生成されるサイクルは追加エッジの両端点を必ず含むため、1手で生成される2サイクルは最低2ノードを共有する。さらに `QuantumTTTEngine` は collapse 後に確定済みノードをエンタングルメントグラフから削除するため、グラフは常に森（サイクルなし）の状態を維持する。

**→ QuantumTTTEngine（1-6）の必須要件：collapse 後に確定済みノードをグラフから削除する**

##### ケース3：サイクルに枝があるケース（A に D への枝）

初期状態:
```
A: [X₁(pair=D), O₂(pair=B), O₄(pair=C)]   ← D は枝先（サイクル外）
B: [O₂(pair=A), X₃(pair=C)]
C: [X₃(pair=B), O₄(pair=A)]
D: [X₁(pair=A)]
```

CollapseMove `{targetCell=A, pairCell=B}` → A を O₂ で確定

| ステップ | 操作 | 状態 |
|---|---|---|
| A を O₂ で確定 | B から O₂ 除去 → enqueue(B, X₃); **枝 X₁ rejected → enqueue(D, X₁)**; O₄ rejected → enqueue(C, O₄) | A: ✓O |
| B を X₃ で確定 | C から X₃ 除去 → enqueue(C, O₄)（重複） | B: ✓X |
| **D を X₁ で確定** | A は確定済みスキップ。他マークなし | **D: ✓X**（枝先が正しく伝播） |
| C を O₄ で確定 | A は確定済みスキップ | C: ✓O |

枝マークは Step3（rejected cascade）により自然に伝播する。アルゴリズムの特別対応は不要。

#### 1-6. `src/engine/quantum-tictactoe/QuantumTTTEngine.ts` ✅ 完了

`GameEngine` インターフェースの実装。上記モジュールを組み合わせてゲームフローを制御する。

- `applyMove(PlaceMove)`: 量子マーク配置 → サイクル検出 → サイクルあれば `phase='collapsed'`
- `applyMove(CollapseMove)`: 収束処理 → 勝利判定 → フェーズ更新
- `getLegalMoves()`: フェーズに応じて `PlaceMove[]` または `CollapseMove[]` を返す

**実装メモ**

- エンタングルメントグラフは `new Graph({ type: 'undirected', multi: true })` で生成。`multi: true` が必須（同一ペアを2手で接続すると即座にサイクルが生成されるため）
- `CollapseMove` 後は `currentPlayer` を切り替えない。サイクル生成（X のターン末）→ 相手（O）が収束選択 → O がそのまま次の PlaceMove を行う、という順序が元論文の規則に従う
- `graph.dropNode()` でノードと全隣接エッジを同時に削除。collapse 後の確定済みノード削除により、グラフは常に森（サイクルなし）の状態を維持する
- `toKifuEntry` 用に `lastAppliedPlayer` を `applyMove` 先頭で記録（applyMove 後は currentPlayer が切り替わっているため）
- `moveIndex` = `state.moveCount`（0-indexed）。PlaceMove ごとにインクリメント。CollapseMove ではインクリメントしない

#### 1-7. テスト ✅ 完了（42 tests passed）

各モジュールに対して `*.test.ts` を同ディレクトリに配置する。

| テストファイル | 主なケース |
|---|---|
| `entanglement.test.ts` | エッジ追加、サイクルなし、3ノードサイクル、非連結グラフ、多重辺サイクル、隣接取得 |
| `victory.test.ts` | X勝ち（行・列・斜め）、O勝ち、ライン未完成、引き分け、両者同時成立（moveIndex比較） |
| `collapse.test.ts` | 3ノードサイクル（2パターン）、枝ありサイクル（枝先への伝播確認）、入力不変性 |
| `QuantumTTTEngine.test.ts` | 初期状態、PlaceMove、サイクル検出・フェーズ遷移、非勝利収束、勝利収束（2パターン）、棋譜エントリ、不正手エラー |

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
