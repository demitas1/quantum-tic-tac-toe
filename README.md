# Quantum Tic-Tac-Toe

## 必要環境

- Node.js 20 以上

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開く。

## テスト

```bash
npm run test                          # 全テスト（watch モード）
npm run test -- --run                 # 全テスト（1回実行）
npm run test -- --run src/engine/    # エンジン単体テストのみ
```

## ビルド

```bash
npm run build
```

成果物は `dist/` に出力される。
