import type { Driver, OperationContext, Package, SyncOperation } from '../types';
import {
  createPackage,
  updatePackage,
  updateDriver,
  createDriver,
  deletePackage,
  deleteDriver,
  getSyncOperations,
  createSyncOperation,
  markSyncOperationAsSynced,
} from './supabaseDatabase';

import { filterModifiableFields } from './ownershipRules';

const ADMIN_DRIVER_FIELDS = new Set<string>([
  'custom_id',
  'name',
  'phone',
  'vehicle_type',
  'zone',
  'pin_code',
  'is_active',
]);

const filterDriverFields = (changes: Partial<Driver>): Partial<Driver> => {
  return Object.fromEntries(
    Object.entries(changes).filter(([key]) => ADMIN_DRIVER_FIELDS.has(key))
  ) as Partial<Driver>;
};

const stripJsOnlyPackageFields = (pkg: Partial<Package>): Partial<Package> => {
  const {
    statusHistory,
    changedBy,
    archivedByDriver,
    archivedByAdmin,
    _last_modified,
    _version,
    ...rest
  } = pkg as any;
  return rest as Partial<Package>;
};

const stripJsOnlyDriverFields = (driver: Partial<Driver>): Partial<Driver> => {
  const { auditLog, changedBy, archivedByAdmin, _last_modified, _version, ...rest } = driver as any;
  return rest as Partial<Driver>;
};

export const adminCreatePackage = async (
  pkg: Omit<Package, 'id' | 'updated_at' | 'version'>,
  context: OperationContext
): Promise<Package> => {
  const normalized = stripJsOnlyPackageFields(pkg);
  const payload: Partial<Package> = {
    ...normalized,
    created_at: normalized.created_at || context.updatedAt,
    updated_at: context.updatedAt,
  };

  return await createPackage(payload as Omit<Package, 'id' | 'updated_at' | 'version'>);
};

export const adminUpdatePackage = async (
  id: string,
  changes: Partial<Package>,
  context: OperationContext
): Promise<Package> => {
  const filtered = filterModifiableFields(changes, context) as Partial<Package>;
  const payload = stripJsOnlyPackageFields(filtered);
  return await updatePackage(id, {
    ...payload,
    updated_at: context.updatedAt,
  });
};

export const adminArchivePackage = async (
  id: string,
  context: OperationContext
): Promise<Package> => {
  return await updatePackage(id, {
    is_archived: true,
    archived_at: context.updatedAt,
    updated_at: context.updatedAt,
  });
};

export const adminCreateDriver = async (
  driver: Omit<Driver, 'id' | 'updated_at' | 'version'>,
  context: OperationContext
): Promise<Driver> => {
  const payload = stripJsOnlyDriverFields(driver);
  return await createDriver({
    ...payload,
    created_at: payload.created_at || context.updatedAt,
    updated_at: context.updatedAt,
  } as Omit<Driver, 'id' | 'updated_at' | 'version'>);
};

export const adminUpdateDriver = async (
  id: string,
  changes: Partial<Driver>,
  context: OperationContext
): Promise<Driver> => {
  const filtered = filterDriverFields(changes);
  const payload = stripJsOnlyDriverFields(filtered);
  return await updateDriver(id, {
    ...payload,
    updated_at: context.updatedAt,
  });
};

export const adminDeletePackage = async (id: string): Promise<void> => {
  await deletePackage(id);
};

export const adminDeleteDriver = async (id: string): Promise<void> => {
  await deleteDriver(id);
};

export const adminSyncPendingOperations = async (userId: string): Promise<void> => {
  const operations = await getSyncOperations(userId);

  for (const operation of operations) {
    try {
      switch (operation.collection) {
        case 'packages':
          if (operation.type === 'update' && operation.data?.id) {
            await adminUpdatePackage(operation.data.id, operation.data, operation.context!);
          }
          break;
        case 'drivers':
          if (operation.type === 'update' && operation.data?.id) {
            await adminUpdateDriver(operation.data.id, operation.data, operation.context!);
          }
          break;
        default:
          break;
      }

      await markSyncOperationAsSynced(operation.id);
    } catch (error) {
      console.error('adminSyncPendingOperations error:', error);
    }
  }
};

export const adminCreateSyncOperation = async (
  userId: string,
  operation: Omit<SyncOperation, 'id' | 'timestamp'>
): Promise<SyncOperation> => {
  return await createSyncOperation({ ...operation, user_id: userId });
};
