import type { SignedUrlResponse, UploadFile, UploadProgress } from './common.js';

export interface ItemPermissions {
  allowedDomains?: string[];
  allowedCodeRules?: string[];
}

export interface CreateItemRequest {
  // 空のリクエストボディ
}

export interface CreateItemResponse {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemUploadUrlsRequest {
  name: string;
  description?: string;
  thumbnailPath?: string;
  contentHash: string;
  fileSize: number;
  files: Array<{
    path: string;
    contentType: string;
  }>;
  permissions?: ItemPermissions;
}

export interface ItemUploadUrlsResponse {
  uploadUrls: SignedUrlResponse[];
  versionId: string;
  contentHash: string;
  versionNumber: number;
}

export interface CompleteItemUploadRequest {
  versionId: string;
}

export interface CompleteItemUploadResponse {
  versionId: string;
  itemId: string;
  name: string;
  description?: string;
  contentHash: string;
  fileSize: number;
  status: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemUploadOptions {
  itemId?: string;
  name: string;
  description?: string;
  thumbnailPath?: string;
  permissions?: ItemPermissions;
  onProgress?: (progress: UploadProgress) => void;
}

export interface ItemUploadResult {
  itemId: string;
  versionId: string;
  versionNumber: number;
  contentHash: string;
  files: UploadFile[];
}
