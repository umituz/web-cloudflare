/**
 * useFileUpload Hook
 * @description File upload hook for R2 with progress tracking
 */

import { useState, useCallback } from 'react';
import { APIClient } from '../utils/api-client';

export interface UploadOptions {
  baseURL?: string;
  path?: string;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  metadata?: Record<string, string>;
}

export interface UploadState {
  file: File | null;
  progress: number;
  isLoading: boolean;
  error: string | null;
  url: string | null;
  key: string | null;
}

export interface UseFileUploadReturn {
  uploadState: UploadState;
  selectFile: (file: File) => void;
  uploadFile: () => Promise<void>;
  clearFile: () => void;
  resetState: () => void;
}

/**
 * File upload hook for R2
 */
export function useFileUpload(options: UploadOptions = {}): UseFileUploadReturn {
  const {
    baseURL = '',
    path = '/api/upload',
    maxSize = 100 * 1024 * 1024, // 100MB default
    allowedTypes = [],
    metadata = {},
  } = options;

  const client = new APIClient({ baseURL });

  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    progress: 0,
    isLoading: false,
    error: null,
    url: null,
    key: null,
  });

  /**
   * Validate file
   */
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }

    return null;
  }, [maxSize, allowedTypes]);

  /**
   * Select file
   */
  const selectFile = useCallback((file: File): void => {
    const error = validateFile(file);

    setUploadState({
      file,
      progress: 0,
      isLoading: false,
      error,
      url: null,
      key: null,
    });
  }, [validateFile]);

  /**
   * Upload file
   */
  const uploadFile = useCallback(async () => {
    if (!uploadState.file || uploadState.error) {
      return;
    }

    setUploadState((prev) => ({
      ...prev,
      isLoading: true,
      progress: 0,
      error: null,
    }));

    try {
      const response = await client.uploadFile(
        path,
        uploadState.file,
        (progress) => {
          setUploadState((prev) => ({
            ...prev,
            progress,
          }));
        },
        {
          headers: {
            'X-File-Metadata': JSON.stringify(metadata),
          },
        }
      );

      setUploadState({
        file: uploadState.file,
        progress: 100,
        isLoading: false,
        error: null,
        url: response.data.url,
        key: response.data.key,
      });
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));
      throw error;
    }
  }, [uploadState.file, uploadState.error, path, metadata, client]);

  /**
   * Clear selected file
   */
  const clearFile = useCallback((): void => {
    setUploadState({
      file: null,
      progress: 0,
      isLoading: false,
      error: null,
      url: null,
      key: null,
    });
  }, []);

  /**
   * Reset state
   */
  const resetState = useCallback((): void => {
    setUploadState({
      file: null,
      progress: 0,
      isLoading: false,
      error: null,
      url: null,
      key: null,
    });
  }, []);

  return {
    uploadState,
    selectFile,
    uploadFile,
    clearFile,
    resetState,
  };
}

/**
 * Multiple file upload hook
 */
export function useMultipleFileUpload(options: UploadOptions = {}) {
  const [files, setFiles] = useState<Array<{
    id: string;
    file: File;
    progress: number;
    isLoading: boolean;
    error: string | null;
    url: string | null;
    key: string | null;
  }>>([]);

  const client = new APIClient({ baseURL: options.baseURL || '' });

  /**
   * Select multiple files
   */
  const selectFiles = useCallback((fileList: FileList): void => {
    const newFiles = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      progress: 0,
      isLoading: false,
      error: null,
      url: null,
      key: null,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  /**
   * Upload all files
   */
  const uploadAll = useCallback(async () => {
    const uploadPromises = files.map(async (fileItem) => {
      try {
        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileItem.id
              ? { ...item, isLoading: true, error: null }
              : item
          )
        );

        const response = await client.uploadFile(
          options.path || '/api/upload',
          fileItem.file,
          (progress) => {
            setFiles((prev) =>
              prev.map((item) =>
                item.id === fileItem.id
                  ? { ...item, progress }
                  : item
              )
            );
          }
        );

        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileItem.id
              ? {
                  ...item,
                  progress: 100,
                  isLoading: false,
                  url: response.data.url,
                  key: response.data.key,
                }
              : item
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((item) =>
            item.id === fileItem.id
              ? {
                  ...item,
                  isLoading: false,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : item
          )
        );
      }
    });

    await Promise.all(uploadPromises);
  }, [files, client, options.path]);

  /**
   * Remove file
   */
  const removeFile = useCallback((id: string): void => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Clear all files
   */
  const clearAll = useCallback((): void => {
    setFiles([]);
  }, []);

  return {
    files,
    selectFiles,
    uploadAll,
    removeFile,
    clearAll,
  };
}
