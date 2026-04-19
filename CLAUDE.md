# @xrift/sdk

## プロジェクト概要

XRift プラットフォーム向けユニバーサル SDK。ワールド/アイテムの API 操作とファイルアップロードを提供する。
Node.js とブラウザの両環境で動作。外部依存ゼロ (fetch ベース)。

## 技術スタック

- TypeScript (strict mode)
- ESM + CJS デュアルビルド
- Vitest でテスト
- fetch API (axios 不使用)

## ビルド・テスト

```bash
npm run build        # ESM + CJS デュアルビルド
npm run build:esm    # ESM のみ
npm run build:cjs    # CJS のみ
npm test             # vitest run
npm run test:watch   # vitest (watch mode)
```

## ディレクトリ構造

```
src/
├── index.ts              # エントリーポイント (全パブリック API の re-export)
├── client.ts             # XriftClient クラス (worlds, items をまとめる)
├── constants.ts          # API パス定数、デフォルト値
├── errors.ts             # エラークラス階層 (XriftSdkError → XriftApiError, XriftAuthError, XriftNetworkError)
├── hash.ts               # SHA-256 ハッシュ計算 (Node.js: node:crypto, ブラウザ: Web Crypto API)
├── api/
│   ├── http-client.ts    # fetch ベース HTTP クライアント
│   ├── worlds.ts         # WorldsApi (create, getUploadUrls, complete, upload)
│   └── items.ts          # ItemsApi (create, getUploadUrls, complete, upload)
├── types/
│   ├── index.ts          # 型の re-export
│   ├── common.ts         # 共通型 (PhysicsConfig, FileData, UploadFile 等)
│   ├── worlds.ts         # ワールド関連型
│   └── items.ts          # アイテム関連型
└── utils/
    └── mime.ts           # MIME タイプ判定
```

## 設計方針

- **ファイルデータの抽象化**: CLI の `UploadFileInfo` (localPath ベース) ではなく `UploadFile` (data: FileData) を使用。呼び出し側がファイル読み込みを行い、バイナリデータを渡す
- **ユニバーサルハッシュ**: `hash.ts` はランタイム検出で node:crypto / Web Crypto API を自動切替。xrift-cli の `hash.ts` と同一結果を返す (互換性テストあり)
- **HttpClient**: fetch ベースの薄いラッパー。エラーを `XriftApiError` / `XriftAuthError` / `XriftNetworkError` に変換
- **高レベル API**: `WorldsApi.upload()` / `ItemsApi.upload()` が作成→ハッシュ計算→URL取得→アップロード→完了通知の全フローを統合

## xrift-cli との関係

- SDK は xrift-cli から API 通信レイヤーを切り出したもの
- 型定義は CLI の `src/types/index.ts` から移植・再整理
- contentHash の計算ロジックは CLI の `src/lib/hash.ts` と互換
- CLI 側のリファクタリング (SDK への移行) は別タスク
