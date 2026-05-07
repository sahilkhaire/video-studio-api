// ──────────────────────────────────────────────────────────
// Storage provider types
// ──────────────────────────────────────────────────────────
export enum StorageProviderType {
  LOCAL = 'local',
  S3 = 's3',
}

// ──────────────────────────────────────────────────────────
// File metadata returned after upload
// ──────────────────────────────────────────────────────────
export interface IStoredFile {
  /** Provider-relative key / path used for subsequent operations */
  key: string;
  /** Public or pre-signed URL for download */
  url: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME / content type */
  contentType: string;
  /** ISO timestamp */
  uploadedAt: Date;
}

// ──────────────────────────────────────────────────────────
// Upload options
// ──────────────────────────────────────────────────────────
export interface IUploadOptions {
  /** Target key / relative path (e.g. "videos/my-video.mp4") */
  key: string;
  /** Absolute path of the source file on local disk */
  sourcePath: string;
  /** MIME type */
  contentType?: string;
  /** Whether the object should be publicly accessible (S3 only) */
  isPublic?: boolean;
}

// ──────────────────────────────────────────────────────────
// Provider contract
// ──────────────────────────────────────────────────────────
export interface IStorageProvider {
  /** Upload a file and return its metadata */
  upload(options: IUploadOptions): Promise<IStoredFile>;
  /** Download a stored file to a local path */
  download(key: string, destinationPath: string): Promise<void>;
  /** Delete a stored file */
  delete(key: string): Promise<void>;
  /** Get a public or pre-signed URL (expiry seconds only relevant for S3) */
  getUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Return the provider identifier */
  getProviderName(): string;
}

// ──────────────────────────────────────────────────────────
// DI token
// ──────────────────────────────────────────────────────────
export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
