/**
 * FileUpload Component
 * @description File upload component for R2 with progress tracking
 */

import React, { useCallback } from 'react';
import { useFileUpload, type UploadOptions } from '../hooks/useFileUpload';

export interface FileUploadProps extends UploadOptions {
  onUploadComplete?: (data: { key: string; url: string }) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  dropzoneText?: string;
  showProgress?: boolean;
  children?: React.ReactNode;
}

/**
 * FileUpload component for R2 uploads
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadError,
  accept = '*/*',
  multiple = false,
  disabled = false,
  className = '',
  dropzoneText = 'Drag and drop files here or click to select',
  showProgress = true,
  children,
  ...uploadOptions
}) => {
  const { uploadState, selectFile, uploadFile, clearFile } = useFileUpload(uploadOptions);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((file: File) => {
    selectFile(file);
  }, [selectFile]);

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  /**
   * Handle click
   */
  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  /**
   * Auto-upload when file is selected
   */
  React.useEffect(() => {
    if (uploadState.file && !uploadState.error && !uploadState.isLoading) {
      uploadFile()
        .then(() => {
          if (uploadState.url && uploadState.key) {
            onUploadComplete?.({ url: uploadState.url, key: uploadState.key });
          }
        })
        .catch(() => {
          onUploadError?.(uploadState.error || 'Upload failed');
        });
    }
  }, [uploadState.file, uploadState.error, uploadState.isLoading, uploadState.url, uploadState.key, uploadState.error, uploadFile, onUploadComplete, onUploadError]);

  return (
    <div className={`file-upload ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      <div
        className={`file-upload-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? '#f0f0f0' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        {children || (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <div style={{ fontSize: '16px', color: '#666' }}>
              {dropzoneText}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              {accept !== '*/*' && `Accepted: ${accept}`}
            </div>
          </>
        )}
      </div>

      {showProgress && uploadState.file && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              {uploadState.file.name}
            </span>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {uploadState.progress}%
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${uploadState.progress}%`,
                height: '100%',
                backgroundColor: uploadState.error ? '#f44336' : '#4caf50',
                transition: 'width 0.3s',
              }}
            />
          </div>

          {uploadState.error && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#f44336' }}>
              {uploadState.error}
            </div>
          )}

          {uploadState.isLoading && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Uploading...
            </div>
          )}

          {uploadState.url && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#4caf50' }}>
              ✓ Upload complete
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Simple file upload button component
 */
export const FileUploadButton: React.FC<
  Omit<FileUploadProps, 'dropzoneText' | 'showProgress' | 'children'> & {
    buttonText?: string;
    buttonClassName?: string;
  }
> = ({
  buttonText = 'Upload File',
  buttonClassName = '',
  onUploadComplete,
  ...props
}) => {
  return (
    <FileUpload
      {...props}
      onUploadComplete={(data) => {
        onUploadComplete?.(data);
      }}
      dropzoneText=""
      showProgress={false}
    >
      <button
        type="button"
        className={buttonClassName}
        disabled={props.disabled}
        style={{
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: '#4caf50',
          color: 'white',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        {buttonText}
      </button>
    </FileUpload>
  );
};
