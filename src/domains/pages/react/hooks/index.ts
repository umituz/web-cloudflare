/**
 * React Hooks
 * @description Barrel export for all React hooks
 */

export { useAuth } from './useAuth';
export type {
  User,
  AuthState,
  LoginCredentials,
  SignUpCredentials,
  UseAuthOptions,
  UseAuthReturn,
} from './useAuth';

export { useAPIClient, useFetch, useMutation } from './useAPIClient';
export type {
  UseAPIClientOptions,
  APIRequestState,
  UseAPIClientReturn,
  GenerateTextOptions,
} from './useAPIClient';

export { useFileUpload, useMultipleFileUpload } from './useFileUpload';
export type {
  UploadOptions,
  UploadState,
  UseFileUploadReturn,
} from './useFileUpload';

export { useAI, useAIChat, useAIRAG } from './useAI';
export type {
  AIMessage,
  AIRequestOptions,
  AIResponse,
  AIState,
  UseAIOptions,
  UseAIReturn,
} from './useAI';

export { useWorkflow, useBatchWorkflow } from './useWorkflow';
export type {
  WorkflowStep,
  WorkflowExecution,
  WorkflowState,
  UseWorkflowOptions,
  UseWorkflowReturn,
} from './useWorkflow';
