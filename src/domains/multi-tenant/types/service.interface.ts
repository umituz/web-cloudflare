
import type { Tenant, TenantContext, TenantRoute, TenantResolutionResult } from '../entities';

export interface IMultiTenantService {

  registerTenant(tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant>;

  getTenant(tenantId: string): Promise<Tenant | null>;

  getTenantBySlug(slug: string): Promise<Tenant | null>;

  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;

  deleteTenant(tenantId: string): Promise<void>;

  listTenants(): Promise<Tenant[]>;


  bindD1(tenantId: string, bindingName: string, binding: D1Database): void;

  bindR2(tenantId: string, bindingName: string, binding: R2Bucket): void;

  bindKV(tenantId: string, bindingName: string, binding: KVNamespace): void;

  bindVectorize(tenantId: string, bindingName: string, binding: VectorizeIndex): void;

  bindQueue(tenantId: string, bindingName: string, binding: Queue<unknown>): void;

  getTenantContext(tenantId: string): TenantContext | null;


  resolveTenant(request: Request): Promise<TenantResolutionResult | null>;

  setTenantRoute(tenantId: string, route: TenantRoute): void;

  getTenantRoute(tenantId: string): TenantRoute | null;


  withTenant<T>(
    tenantId: string,
    operation: (context: TenantContext) => Promise<T>
  ): Promise<T>;

  getCurrentTenantId(): string | null;

  setCurrentTenantId(tenantId: string): void;

  clearCurrentTenantId(): void;


  getTenantKVKey(tenantId: string, key: string): string;

  getTenantR2Prefix(tenantId: string): string;

  getTenantD1Table(tenantId: string, tableName: string): string;
}
