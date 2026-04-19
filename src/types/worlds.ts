import type {
  PhysicsConfig,
  CameraConfig,
  OutputBufferType,
  SignedUrlResponse,
  UploadFile,
  UploadProgress,
} from './common.js';

export interface WorldPermissions {
  allowedDomains?: string[];
  allowedCodeRules?: string[];
}

export interface CreateWorldRequest {
  // 空のリクエストボディ
}

export interface CreateWorldResponse {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorldUploadUrlsRequest {
  name: string;
  description?: string;
  thumbnailPath?: string;
  physics?: PhysicsConfig;
  camera?: CameraConfig;
  permissions?: WorldPermissions;
  outputBufferType?: OutputBufferType;
  contentHash: string;
  fileSize: number;
  files: Array<{
    path: string;
    contentType: string;
  }>;
}

export interface WorldUploadUrlsResponse {
  uploadUrls: SignedUrlResponse[];
  versionId: string;
  contentHash: string;
  versionNumber: number;
}

export interface CompleteWorldUploadRequest {
  versionId: string;
}

export interface CompleteWorldUploadResponse {
  versionId: string;
  worldId: string;
  name: string;
  description?: string;
  contentHash: string;
  fileSize: number;
  status: string;
  versionNumber: number;
  owner: {
    id: string;
    displayName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorldUploadOptions {
  worldId?: string;
  name: string;
  description?: string;
  thumbnailPath?: string;
  physics?: PhysicsConfig;
  camera?: CameraConfig;
  permissions?: WorldPermissions;
  outputBufferType?: OutputBufferType;
  onProgress?: (progress: UploadProgress) => void;
}

export interface WorldUploadResult {
  worldId: string;
  versionId: string;
  versionNumber: number;
  contentHash: string;
  files: UploadFile[];
}
