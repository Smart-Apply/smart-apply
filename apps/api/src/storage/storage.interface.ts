export interface StorageProvider {
  /**
   * Upload a file to storage
   * @param key - Unique storage key/path for the file
   * @param buffer - File content as buffer
   * @param mimeType - MIME type of the file
   * @returns Promise with the storage key
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Download a file from storage
   * @param key - Storage key/path of the file
   * @returns Promise with file buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   * @param key - Storage key/path of the file
   * @returns Promise<void>
   */
  delete(key: string): Promise<void>;

  /**
   * Get a signed URL for temporary file access (Azure SAS or local path)
   * @param key - Storage key/path of the file
   * @param expiresInSeconds - URL expiration time in seconds
   * @returns Promise with signed URL
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;

  /**
   * Check if storage is healthy
   * @returns Promise<boolean>
   */
  healthCheck(): Promise<boolean>;
}
