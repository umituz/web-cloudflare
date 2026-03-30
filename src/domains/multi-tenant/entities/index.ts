/**
 * Multi-Tenant Entities
 * @description Core entity definitions for multi-tenant support
 */

// ============================================================
// Tenant Configuration
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  config: TenantConfig;
  createdAt: number;
  updatedAt: number;
}

export interface TenantConfig {
  d1Bindings?: string[];
  r2Bindings?: string[];
  kvNamespaces?: string[];
  vectorizeIndexes?: string[];
  queueNames?: string[];
  customDomains?: string[];
}

// ============================================================
// Tenant Context
// ============================================================

export interface TenantContext {
  tenant: Tenant;
  d1?: Map<string, D1Database>;
  r2?: Map<string, R2Bucket>;
  kv?: Map<string, KVNamespace>;
  vectorize?: Map<string, VectorizeIndex>;
  queues?: Map<string, Queue<any>>;
}

// ============================================================
// Tenant Routing
// ============================================================

export interface TenantRoute {
  hostname?: string;
  header?: string;
  query?: string;
  path?: string;
}

export interface TenantResolutionResult {
  tenant: Tenant;
  route: TenantRoute;
}

// ============================================================
// Binding Metadata
// ============================================================

export interface BindingMetadata {
  tenantId: string;
  bindingType: 'd1' | 'r2' | 'kv' | 'vectorize' | 'queue';
  bindingName: string;
  bindingValue: string;
  isDefault?: boolean;
}

// ============================================================
// Tenant Isolation
// ============================================================

export interface TenantIsolationLevel {
  level: 'strict' | 'moderate' | 'shared';
  description: string;
}

export const TENANT_ISOLATION_LEVELS: Record<string, TenantIsolationLevel> = {
  strict: {
    level: 'strict',
    description: 'Each tenant has completely isolated resources (dedicated D1, R2, KV)',
  },
  moderate: {
    level: 'moderate',
    description: 'Tenants share some resources but have isolated data (same D1/R2, different tables/prefixes)',
  },
  shared: {
    level: 'shared',
    description: 'Tenants share all resources with tenant_id filtering',
  },
};
