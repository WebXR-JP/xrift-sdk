# @xrift/sdk

XRift プラットフォーム向けユニバーサル API クライアント。Node.js とブラウザの両環境で動作します。

## インストール

```bash
npm install @xrift/sdk
```

## 基本的な使い方

```typescript
import { XriftClient } from '@xrift/sdk';

const client = new XriftClient({ token: 'your-token' });
```

### ワールドアップロード

```typescript
import fs from 'node:fs/promises';
import { XriftClient, getMimeType } from '@xrift/sdk';
import type { UploadFile } from '@xrift/sdk';

const client = new XriftClient({ token: 'your-token' });

// ファイルを読み込んで UploadFile[] を作成
const data = await fs.readFile('./dist/index.html');
const files: UploadFile[] = [
  {
    remotePath: 'index.html',
    size: data.byteLength,
    contentType: getMimeType('index.html'),
    data,
  },
];

const result = await client.worlds.upload(files, {
  name: 'My World',
  description: 'A cool world',
  physics: { gravity: 9.8 },
  onProgress: (p) => console.log(`${p.completed}/${p.total}`),
});

console.log(`World ID: ${result.worldId}`);
```

### アイテムアップロード

```typescript
const result = await client.items.upload(files, {
  name: 'My Item',
  onProgress: (p) => console.log(`${p.completed}/${p.total}`),
});
```

### 既存ワールド/アイテムの更新

```typescript
// worldId / itemId を指定すると更新になる
await client.worlds.upload(files, {
  worldId: 'existing-world-id',
  name: 'Updated World',
});
```

### 個別操作

```typescript
// ワールド作成
const world = await client.worlds.create();

// 署名付き URL 取得
const urls = await client.worlds.getUploadUrls(world.id, request);

// アップロード完了通知
await client.worlds.complete(world.id, versionId);
```

## ブラウザでの使用

```typescript
// ブラウザでは File API からデータを取得
const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const file = fileInput.files[0];
const data = await file.arrayBuffer();

const uploadFile: UploadFile = {
  remotePath: file.name,
  size: file.size,
  contentType: file.type,
  data,
};
```

## API リファレンス

### `XriftClient`

| オプション | 型 | 必須 | 説明 |
|---|---|---|---|
| `token` | `string` | Yes | 認証トークン |
| `baseUrl` | `string` | No | API ベース URL (デフォルト: `https://api.xrift.net`) |
| `timeout` | `number` | No | タイムアウト ms (デフォルト: 30000) |

### エラー

| クラス | 説明 |
|---|---|
| `XriftSdkError` | 基底エラー |
| `XriftApiError` | HTTP エラー (`statusCode` 付き) |
| `XriftAuthError` | 401 認証エラー |
| `XriftNetworkError` | ネットワーク到達不能 |

## 開発

```bash
npm install
npm run build    # ESM + CJS ビルド
npm test         # テスト実行
```

## 動作環境

- Node.js >= 18.0.0
- モダンブラウザ (ES2022 + Web Crypto API)
