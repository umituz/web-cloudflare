/**
 * Multi-Tenant Service
 * @description Service for managing multiple tenants with isolated resources
 */

import type {
  Tenant,
  TenantConfig,
  TenantContext,
  TenantRoute,
  TenantResolutionResult,
} from '../entities';
import type { IMultiTenantService } from '../types';

export type { Tenant, TenantConfig, TenantContext, TenantRoute, TenantResolutionResult };

// ============================================================
// Tenant Storage
// ============================================================

interface TenantStorage {
  tenants: Map<string, Tenant>;
  routes: Map<string, TenantRoute>;
  contexts: Map<string, TenantContext>;
  currentTenantId: string | null;
}

const tenantStorage: TenantStorage = {
  tenants: new Map(),
  routes: new Map(),
  contexts: new Map(),
  currentTenantId: null,
};

// ============================================================
// Multi-Tenant Service
// ============================================================

export class MultiTenantService implements IMultiTenantService {
  private static instance: MultiTenantService;

  private constructor() {}

  static getInstance(): MultiTenantService {
    if (!MultiTenantService.instance) {
      MultiTenantService.instance = new MultiTenantService();
    }
    return MultiTenantService.instance;
  }

  // ============================================================
  // Tenant Management
  // ============================================================

  async registerTenant(
    tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Tenant> {
    const id = this.generateTenantId();
    const now = Date.now();

    const newTenant: Tenant = {
      id,
      ...tenant,
      createdAt: now,
      updatedAt: now,
    };

    tenantStorage.tenants.set(id, newTenant);

    // Initialize empty context
    tenantStorage.contexts.set(id, {
      tenant: newTenant,
      d1: new Map(),
      r2: new Map(),
      kv: new Map(),
      vectorize: new Map(),
      queues: new Map(),
    });

    return newTenant;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return tenantStorage.tenants.get(tenantId) || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of tenantStorage.tenants.values()) {
      if (tenant.slug === slug) {
        return tenant;
      }
    }
    return null;
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = tenantStorage.tenants.get(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const updatedTenant: Tenant = {
      ...tenant,
      ...updates,
      id: tenantId,
      updatedAt: Date.now(),
    };

    tenantStorage.tenants.set(tenantId, updatedTenant);

    // Update context
    const context = tenantStorage.contexts.get(tenantId);
    if (context) {
      context.tenant = updatedTenant;
    }

    return updatedTenant;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    if (!tenantStorage.tenants.has(tenantId)) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    tenantStorage.tenants.delete(tenantId);
    tenantStorage.routes.delete(tenantId);
    tenantStorage.contexts.delete(tenantId);
  }

  async listTenants(): Promise<Tenant[]> {
    return Array.from(tenantStorage.tenants.values());
  }

  // ============================================================
  // Binding Management
  // ============================================================

  bindD1(tenantId: string, bindingName: string, binding: D1Database): void {
    const context = tenantStorage.contexts.get(tenantId);

    if (!context) {
      throw new Error(`Tenant context not found: ${tenantId}`);
    }

    if (!context.d1) {
      context.d1 = new Map();
    }

    context.d1.set(bindingName, binding);

    // Update tenant config
    const tenant = tenantStorage.tenants.get(tenantId);
    if (tenant) {
      if (!tenant.config.d1Bindings) {
        tenant.config.d1Bindings = [];
      }
      if (!tenant.config.d1Bindings.includes(bindingName)) {
        tenant.config.d1Bindings.push(bindingName);
      }
    }
  }

  bindR2(tenantId: string, bindingName: string, binding: R2Bucket): void {
    const context = tenantStorage.contexts.get(tenantId);

    if (!context) {
      throw new Error(`Tenant context not found: ${tenantId}`);
    }

    if (!context.r2) {
      context.r2 = new Map();
    }

    context.r2.set(bindingName, binding);

    // Update tenant config
    const tenant = tenantStorage.tenants.get(tenantId);
    if (tenant) {
      if (!tenant.config.r2Bindings) {
        tenant.config.r2Bindings = [];
      }
      if (!tenant.config.r2Bindings.includes(bindingName)) {
        tenant.config.r2Bindings.push(bindingName);
      }
    }
  }

  bindKV(tenantId: string, bindingName: string, binding: KVNamespace): void {
    const context = tenantStorage.contexts.get(tenantId);

    if (!context) {
      throw new Error(`Tenant context not found: ${tenantId}`);
    }

    if (!context.kv) {
      context.kv = new Map();
    }

    context.kv.set(bindingName, binding);

    // Update tenant config
    const tenant = tenantStorage.tenants.get(tenantId);
    if (tenant) {
      if (!tenant.config.kvNamespaces) {
        tenant.config.kvNamespaces = [];
      }
      if (!tenant.config.kvNamespaces.includes(bindingName)) {
        tenant.config.kvNamespaces.push(bindingName);
      }
    }
  }

  bindVectorize(tenantId: string, bindingName: string, binding: VectorizeIndex): void {
    const context = tenantStorage.contexts.get(tenantId);

    if (!context) {
      throw new Error(`Tenant context not found: ${tenantId}`);
    }

    if (!context.vectorize) {
      context.vectorize = new Map();
    }

    context.vectorize.set(bindingName, binding);

    // Update tenant config
    const tenant = tenantStorage.tenants.get(tenantId);
    if (tenant) {
      if (!tenant.config.vectorizeIndexes) {
        tenant.config.vectorizeIndexes = [];
      }
      if (!tenant.config.vectorizeIndexes.includes(bindingName)) {
        tenant.config.vectorizeIndexes.push(bindingName);
      }
    }
  }

  bindQueue(tenantId: string, bindingName: string, binding: Queue<any>): void {
    const context = tenantStorage.contexts.get(tenantId);

    if (!context) {
      throw new Error(`Tenant context not found: ${tenantId}`);
    }

    if (!context.queues) {
      context.queues = new Map();
    }

    context.queues.set(bindingName, binding);

    // Update tenant config
    const tenant = tenantStorage.tenants.get(tenantId);
    if (tenant) {
      if (!tenant.config.queueNames) {
        tenant.config.queueNames = [];
      }
      if (!tenant.config.queueNames.includes(bindingName)) {
        tenant.config.queueNames.push(bindingName);
      }
    }
  }

  getTenantContext(tenantId: string): TenantContext | null {
    return tenantStorage.contexts.get(tenantId) || null;
  }

  // ============================================================
  // Tenant Routing
  // ============================================================

  async resolveTenant(request: Request): Promise<TenantResolutionResult | null> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Check for hostname-based routing
    for (const [tenantId, route] of tenantStorage.routes.entries()) {
      if (route.hostname && hostname === route.hostname) {
        const tenant = tenantStorage.tenants.get(tenantId);
        if (tenant) {
          return { tenant, route };
        }
      }

      // Check header-based routing
      if (route.header) {
        const headerValue = request.headers.get(route.header);
        if (headerValue === tenantId) {
          const tenant = tenantStorage.tenants.get(tenantId);
          if (tenant) {
            return { tenant, route };
          }
        }
      }

      // Check query-based routing
      if (route.query) {
        const queryValue = url.searchParams.get(route.query);
        if (queryValue === tenantId) {
          const tenant = tenantStorage.tenants.get(tenantId);
          if (tenant) {
            return { tenant, route };
          }
        }
      }

      // Check path-based routing
      if (route.path) {
        const pathMatch = url.pathname.match(route.path);
        if (pathMatch) {
          const tenant = tenantStorage.tenants.get(tenantId);
          if (tenant) {
            return { tenant, route };
          }
        }
      }
    }

    return null;
  }

  setTenantRoute(tenantId: string, route: TenantRoute): void {
    if (!tenantStorage.tenants.has(tenantId)) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    tenantStorage.routes.set(tenantId, route);
  }

  getTenantRoute(tenantId: string): TenantRoute | null {
    return tenantStorage.routes.get(tenantId) || null;
  }

  // ============================================================
  // Tenant Isolation
  // ============================================================

  async withTenant<T>(
    tenantId: string,
    operation: (context: TenantContext) => Promise<T>
  ): Promise<T> {
    const previousTenantId = tenantStorage.currentTenantId;

    try {
      tenantStorage.currentTenantId = tenantId;

      const context = tenantStorage.contexts.get(tenantId);

      if (!context) {
        throw new Error(`Tenant context not found: ${tenantId}`);
      }

      return await operation(context);
    } finally {
      tenantStorage.currentTenantId = previousTenantId;
    }
  }

  getCurrentTenantId(): string | null {
    return tenantStorage.currentTenantId;
  }

  setCurrentTenantId(tenantId: string): void {
    if (!tenantStorage.tenants.has(tenantId)) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    tenantStorage.currentTenantId = tenantId;
  }

  clearCurrentTenantId(): void {
    tenantStorage.currentTenantId = null;
  }

  // ============================================================
  // Tenant Data Operations
  // ============================================================

  getTenantKVKey(tenantId: string, key: string): string {
    const tenant = tenantStorage.tenants.get(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return `${tenant.slug}:${key}`;
  }

  getTenantR2Prefix(tenantId: string): string {
    const tenant = tenantStorage.tenants.get(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return `${tenant.slug}/`;
  }

  getTenantD1Table(tenantId: string, tableName: string): string {
    const tenant = tenantStorage.tenants.get(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return `${tenant.slug}_${tableName}`;
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private generateTenantId(): string {
    return `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Create singleton instance
export const multiTenantService = MultiTenantService.getInstance();
