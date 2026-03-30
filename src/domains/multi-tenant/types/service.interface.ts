/**
 * Multi-Tenant Service Interface
 * @description TypeScript interface for MultiTenantService
 */

import type { Tenant, TenantContext, TenantRoute, TenantResolutionResult } from '../entities';

export interface IMultiTenantService {
  // ============================================================
  // Tenant Management
  // ============================================================

  /**
   * Register a new tenant
   */
  registerTenant(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant>;

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Promise<Tenant | null>;

  /**
   * Get tenant by slug
   */
  getTenantBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Update tenant
   */
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): Promise<void>;

  /**
   * List all tenants
   */
  listTenants(): Promise<Tenant[]>;

  // ============================================================
  // Binding Management
  // ============================================================

  /**
   * Bind D1 database for tenant
   */
  bindD1(tenantId: string, bindingName: string, binding: D1Database): void;

  /**
   * Bind R2 bucket for tenant
   */
  bindR2(tenantId: string, bindingName: string, binding: R2Bucket): void;

  /**
   * Bind KV namespace for tenant
   */
  bindKV(tenantId: string, bindingName: string, binding: KVNamespace): void;

  /**
   * Bind Vectorize index for tenant
   */
  bindVectorize(tenantId: string, bindingName: string, binding: VectorizeIndex): void;

  /**
   * Bind Queue for tenant
   */
  bindQueue(tenantId: string, bindingName: string, binding: Queue<any>): void;

  /**
   * Get tenant context with all bindings
   */
  getTenantContext(tenantId: string): TenantContext | null;

  // ============================================================
  // Tenant Routing
  // ============================================================

  /**
   * Resolve tenant from request
   */
  resolveTenant(request: Request): Promise<TenantResolutionResult | null>;

  /**
   * Set tenant routing strategy
   */
  setTenantRoute(tenantId: string, route: TenantRoute): void;

  /**
   * Get tenant route
   */
  getTenantRoute(tenantId: string): TenantRoute | null;

  // ============================================================
  // Tenant Isolation
  // ============================================================

  /**
   * Execute operation with tenant context
   */
  withTenant<T>(
    tenantId: string,
    operation: (context: TenantContext) => Promise<T>
  ): Promise<T>;

  /**
   * Get current tenant ID from context
   */
  getCurrentTenantId(): string | null;

  /**
   * Set current tenant ID
   */
  setCurrentTenantId(tenantId: string): void;

  /**
   * Clear current tenant ID
   */
  clearCurrentTenantId(): void;

  // ============================================================
  // Tenant Data Operations
  // ============================================================

  /**
   * Get tenant-specific key for KV
   */
  getTenantKVKey(tenantId: string, key: string): string;

  /**
   * Get tenant-specific prefix for R2
   */
  getTenantR2Prefix(tenantId: string): string;

  /**
   * Get tenant-specific table name for D1
   */
  getTenantD1Table(tenantId: string, tableName: string): string;
}
