import { HttpClient } from './http-client.js';
import { ITEMS_BASE_PATH } from '../constants.js';
import { calculateContentHash } from '../hash.js';
import type {
  CreateItemResponse,
  ItemUploadUrlsRequest,
  ItemUploadUrlsResponse,
  CompleteItemUploadRequest,
  CompleteItemUploadResponse,
  ItemUploadOptions,
  ItemUploadResult,
} from '../types/items.js';
import type { UploadFile } from '../types/common.js';

export class ItemsApi {
  constructor(private readonly http: HttpClient) {}

  async create(): Promise<CreateItemResponse> {
    const response = await this.http.post<CreateItemResponse>(ITEMS_BASE_PATH, {});
    return response.data;
  }

  async getUploadUrls(
    itemId: string,
    request: ItemUploadUrlsRequest,
  ): Promise<ItemUploadUrlsResponse> {
    const response = await this.http.post<ItemUploadUrlsResponse>(
      `${ITEMS_BASE_PATH}/${itemId}/upload-urls`,
      request,
    );
    return response.data;
  }

  async complete(
    itemId: string,
    versionId: string,
  ): Promise<CompleteItemUploadResponse> {
    const request: CompleteItemUploadRequest = { versionId };
    const response = await this.http.post<CompleteItemUploadResponse>(
      `${ITEMS_BASE_PATH}/${itemId}/complete`,
      request,
    );
    return response.data;
  }

  /**
   * アイテムアップロードの統合フロー
   */
  async upload(
    files: UploadFile[],
    options: ItemUploadOptions,
  ): Promise<ItemUploadResult> {
    // 1. アイテム ID の決定 (既存 or 新規作成)
    let itemId: string;
    if (options.itemId) {
      itemId = options.itemId;
    } else {
      const created = await this.create();
      itemId = created.id;
    }

    // 2. contentHash 計算
    const hashFiles = files.map((f) => ({ remotePath: f.remotePath, data: f.data }));
    const contentHash = await calculateContentHash(hashFiles, {
      permissions: options.permissions,
    });

    // 3. fileSize 計算
    const fileSize = files.reduce((sum, f) => sum + f.size, 0);

    // 4. 署名付き URL 取得
    const uploadUrlsRequest: ItemUploadUrlsRequest = {
      name: options.name,
      description: options.description,
      thumbnailPath: options.thumbnailPath,
      contentHash,
      fileSize,
      files: files.map((f) => ({
        path: f.remotePath,
        contentType: f.contentType,
      })),
      permissions: options.permissions,
    };

    const urlsResponse = await this.getUploadUrls(itemId, uploadUrlsRequest);

    // 5. ファイルアップロード
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const signedUrl = urlsResponse.uploadUrls[i];

      options.onProgress?.({
        completed: i,
        total: files.length,
        currentFile: file.remotePath,
      });

      await this.http.putExternal(signedUrl.uploadUrl, file.data, {
        'Content-Type': file.contentType,
      });
    }

    options.onProgress?.({
      completed: files.length,
      total: files.length,
      currentFile: '',
    });

    // 6. 完了通知
    await this.complete(itemId, urlsResponse.versionId);

    return {
      itemId,
      versionId: urlsResponse.versionId,
      versionNumber: urlsResponse.versionNumber,
      contentHash,
      files,
    };
  }
}
