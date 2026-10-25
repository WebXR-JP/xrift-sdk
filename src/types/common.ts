export interface PhysicsConfig {
  gravity?: number;
  allowInfiniteJump?: boolean;
  /** 浮遊モード（フライモード）を許可するか（デフォルト: true）。ワールド編集モード中は設定に関わらず許可される */
  allowFly?: boolean;
  /** この高さ（Y）を下回るとリスポーンする（デフォルト: -10） */
  respawnThreshold?: number;
}

export interface CameraConfig {
  near?: number;
  far?: number;
}

export type OutputBufferType = 'UnsignedByteType' | 'HalfFloatType' | 'FloatType';

export interface SignedUrlResponse {
  path: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
}

/** SDK 用のファイルデータ型 (ユニバーサル) */
export type FileData = ArrayBuffer | Uint8Array;

/** SDK に渡すアップロードファイル */
export interface UploadFile {
  remotePath: string;
  size: number;
  contentType: string;
  data: FileData;
}

export interface UploadProgress {
  completed: number;
  total: number;
  currentFile: string;
}
