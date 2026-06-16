import { HttpClient } from './http-client.js';
import { WORLDS_BASE_PATH } from '../constants.js';
import { calculateContentHash } from '../hash.js';
import type {
  CreateWorldResponse,
  WorldUploadUrlsRequest,
  WorldUploadUrlsResponse,
  CompleteWorldUploadRequest,
  CompleteWorldUploadResponse,
  WorldUploadOptions,
  WorldUploadResult,
} from '../types/worlds.js';
import type { UploadFile } from '../types/common.js';

export class WorldsApi {
  constructor(private readonly http: HttpClient) {}

  private async create(): Promise<CreateWorldResponse> {
    const response = await this.http.post<CreateWorldResponse>(WORLDS_BASE_PATH, {});
    return response.data;
  }

  private async getUploadUrls(
    worldId: string,
    request: WorldUploadUrlsRequest,
  ): Promise<WorldUploadUrlsResponse> {
    const response = await this.http.post<WorldUploadUrlsResponse>(
      `${WORLDS_BASE_PATH}/${worldId}/upload-urls`,
      request,
    );
    return response.data;
  }

  private async complete(
    worldId: string,
    versionId: string,
  ): Promise<CompleteWorldUploadResponse> {
    const request: CompleteWorldUploadRequest = { versionId };
    const response = await this.http.post<CompleteWorldUploadResponse>(
      `${WORLDS_BASE_PATH}/${worldId}/complete`,
      request,
    );
    return response.data;
  }

  /**
   * ワールドアップロードの統合フロー
   */
  async upload(
    files: UploadFile[],
    options: WorldUploadOptions,
  ): Promise<WorldUploadResult> {
    // 1. ワールド ID の決定 (既存 or 新規作成)
    let worldId: string;
    if (options.worldId) {
      worldId = options.worldId;
    } else {
      const created = await this.create();
      worldId = created.id;
    }

    // 2. contentHash 計算
    const hashFiles = files.map((f) => ({ remotePath: f.remotePath, data: f.data }));
    const contentHash = await calculateContentHash(hashFiles, {
      physics: options.physics,
      camera: options.camera,
      permissions: options.permissions,
      outputBufferType: options.outputBufferType,
    });

    // 3. fileSize 計算
    const fileSize = files.reduce((sum, f) => sum + f.size, 0);

    // 4. 署名付き URL 取得
    const uploadUrlsRequest: WorldUploadUrlsRequest = {
      name: options.name,
      description: options.description,
      thumbnailPath: options.thumbnailPath,
      physics: options.physics,
      camera: options.camera,
      permissions: options.permissions,
      outputBufferType: options.outputBufferType,
      contentHash,
      fileSize,
      files: files.map((f) => ({
        path: f.remotePath,
        contentType: f.contentType,
      })),
    };

    const urlsResponse = await this.getUploadUrls(worldId, uploadUrlsRequest);

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
    await this.complete(worldId, urlsResponse.versionId);

    return {
      worldId,
      versionId: urlsResponse.versionId,
      versionNumber: urlsResponse.versionNumber,
      contentHash,
      files,
    };
  }
}
