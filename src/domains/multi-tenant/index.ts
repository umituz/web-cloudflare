/**
 * Multi-Tenant Domain
 * @description Multi-tenant support for managing multiple D1, R2, KV, and Vectorize bindings
 *
 * @example
 * ```typescript
 * import { multiTenantService } from '@umituz/web-cloudflare/multi-tenant';
 *
 * // Register a new tenant
 * const tenant = await multiTenantService.registerTenant({
 *   name: 'Acme Corp',
 *   slug: 'acme',
 *   domain: 'acme.example.com',
 *   config: {
 *     d1Bindings: ['DB'],
 *     r2Bindings: ['STORAGE'],
 *     kvNamespaces: ['CACHE'],
 *   },
 * });
 *
 * // Bind resources
 * multiTenantService.bindD1(tenant.id, 'DB', env.DB);
 * multiTenantService.bindR2(tenant.id, 'STORAGE', env.STORAGE);
 * multiTenantService.bindKV(tenant.id, 'CACHE', env.CACHE);
 *
 * // Resolve tenant from request
 * const result = await multiTenantService.resolveTenant(request);
 * if (result) {
 *   const context = multiTenantService.getTenantContext(result.tenant.id);
 *   // Use tenant-specific bindings
 * }
 *
 * // Execute operation with tenant context
 * await multiTenantService.withTenant(tenant.id, async (context) => {
 *   const db = context.d1?.get('DB');
 *   // Use tenant-specific database
 * });
 * ```
 */

export * from './entities';
export * from './types';
export * from './services';
