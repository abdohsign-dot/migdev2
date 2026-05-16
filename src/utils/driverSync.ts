import type { OperationContext, Package, SyncOperation } from '../types';
import {
  updatePackage,
  getSyncOperations,
  createSyncOperation,
  markSyncOperationAsSynced,
} from './supabaseDatabase';

import { filterModifiableFields } from './ownershipRules';

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

export const driverUpdateMissionStatus = async (
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

export const driverArchiveMission = async (
  id: string,
  context: OperationContext
): Promise<Package> => {
  return await updatePackage(id, {
    is_archived: true,
    archived_at: context.updatedAt,
    updated_at: context.updatedAt,
  });
};

export const driverSyncPendingOperations = async (userId: string): Promise<void> => {
  const operations = await getSyncOperations(userId);

  for (const operation of operations) {
    try {
      if (operation.collection !== 'packages') {
        continue;
      }

      if (operation.type === 'update' && operation.data?.id) {
        await driverUpdateMissionStatus(operation.data.id, operation.data, operation.context!);
      }

      await markSyncOperationAsSynced(operation.id);
    } catch (error) {
      console.error('driverSyncPendingOperations error:', error);
    }
  }
};

export const driverCreateSyncOperation = async (
  userId: string,
  operation: Omit<SyncOperation, 'id' | 'timestamp'>
): Promise<SyncOperation> => {
  return await createSyncOperation({ ...operation, user_id: userId });
};
