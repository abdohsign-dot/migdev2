/**
 * Conflict Detection Utility
 * 
 * Detects and resolves conflicts when the same record is edited
 * concurrently on different devices or in different sync cycles.
 */

import { Package, Driver } from '../types';

/**
 * Conflict types
 */
export type ConflictType = 'version_mismatch' | 'timestamp_mismatch' | 'content_change' | 'no_conflict';

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge' | 'manual';

/**
 * Conflict information
 */
export interface ConflictInfo {
  type: ConflictType;
  hasConflict: boolean;
  local: {
    version: number;
    updatedAt: string;
    data: any;
  };
  remote: {
    version: number;
    updatedAt: string;
    data: any;
  };
  recommendation: ConflictResolutionStrategy;
  reason: string;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  mergedData: any;
  conflictingFields: string[];
  notes: string;
}

/**
 * Detect conflicts between local and remote packages
 */
export const detectPackageConflict = (
  local: Package,
  remote: Package
): ConflictInfo => {
  // Check if IDs match
  if (local.id !== remote.id) {
    return {
      type: 'no_conflict',
      hasConflict: false,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: 'local',
      reason: 'Different packages - no conflict',
    };
  }

  // Check version mismatch
  if (local.version !== remote.version) {
    const localTime = new Date(local.updated_at || (local as any)._last_modified || 0).getTime();
    const remoteTime = new Date(remote.updated_at || (remote as any)._last_modified || 0).getTime();
    const isLocalNewer = localTime > remoteTime;

    return {
      type: 'version_mismatch',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: isLocalNewer ? 'local' : 'remote',
      reason: `Version mismatch: local v${local.version} vs remote v${remote.version}. ${isLocalNewer ? 'Local' : 'Remote'} is newer.`,
    };
  }

  // Same version - check timestamps
  const localTime = new Date(local.updated_at || (local as any)._last_modified || 0).getTime();
  const remoteTime = new Date(remote.updated_at || (remote as any)._last_modified || 0).getTime();

  if (localTime !== remoteTime) {
    const isLocalNewer = localTime > remoteTime;

    return {
      type: 'timestamp_mismatch',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: isLocalNewer ? 'local' : 'remote',
      reason: `Same version but different timestamps. ${isLocalNewer ? 'Local' : 'Remote'} is newer.`,
    };
  }

  // Same version and timestamp - check content
  const contentChanged = hasContentChanged(local, remote);

  if (contentChanged) {
    return {
      type: 'content_change',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: 'manual',
      reason: 'Same version and timestamp but content differs - manual resolution needed',
    };
  }

  // No conflict
  return {
    type: 'no_conflict',
    hasConflict: false,
    local: {
      version: local.version,
      updatedAt: local.updated_at,
      data: local,
    },
    remote: {
      version: remote.version,
      updatedAt: remote.updated_at,
      data: remote,
    },
    recommendation: 'local',
    reason: 'No conflict detected',
  };
};

/**
 * Detect conflicts between local and remote drivers
 */
export const detectDriverConflict = (
  local: Driver,
  remote: Driver
): ConflictInfo => {
  // Check if IDs match
  if (local.id !== remote.id) {
    return {
      type: 'no_conflict',
      hasConflict: false,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: 'local',
      reason: 'Different drivers - no conflict',
    };
  }

  // Check version mismatch
  if (local.version !== remote.version) {
    const localTime = new Date(local.updated_at || (local as any)._last_modified || 0).getTime();
    const remoteTime = new Date(remote.updated_at || (remote as any)._last_modified || 0).getTime();
    const isLocalNewer = localTime > remoteTime;

    return {
      type: 'version_mismatch',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: isLocalNewer ? 'local' : 'remote',
      reason: `Version mismatch: local v${local.version} vs remote v${remote.version}. ${isLocalNewer ? 'Local' : 'Remote'} is newer.`,
    };
  }

  // Same version - check timestamps
  const localTime = new Date(local.updated_at || (local as any)._last_modified || 0).getTime();
  const remoteTime = new Date(remote.updated_at || (remote as any)._last_modified || 0).getTime();

  if (localTime !== remoteTime) {
    const isLocalNewer = localTime > remoteTime;

    return {
      type: 'timestamp_mismatch',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: isLocalNewer ? 'local' : 'remote',
      reason: `Same version but different timestamps. ${isLocalNewer ? 'Local' : 'Remote'} is newer.`,
    };
  }

  // Same version and timestamp - check content
  const contentChanged = hasContentChanged(local, remote);

  if (contentChanged) {
    return {
      type: 'content_change',
      hasConflict: true,
      local: {
        version: local.version,
        updatedAt: local.updated_at,
        data: local,
      },
      remote: {
        version: remote.version,
        updatedAt: remote.updated_at,
        data: remote,
      },
      recommendation: 'manual',
      reason: 'Same version and timestamp but content differs - manual resolution needed',
    };
  }

  // No conflict
  return {
    type: 'no_conflict',
    hasConflict: false,
    local: {
      version: local.version,
      updatedAt: local.updated_at,
      data: local,
    },
    remote: {
      version: remote.version,
      updatedAt: remote.updated_at,
      data: remote,
    },
    recommendation: 'local',
    reason: 'No conflict detected',
  };
};

/**
 * Check if content has changed (excluding metadata)
 */
const hasContentChanged = (local: any, remote: any): boolean => {
  // Fields to ignore (metadata)
  const ignoreFields = ['id', 'version', 'created_at', 'updated_at', '_last_modified', '_version'];

  // Get all keys
  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  // Compare each field
  for (const key of allKeys) {
    if (ignoreFields.includes(key)) continue;

    const localValue = local[key];
    const remoteValue = remote[key];

    // Deep comparison
    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      return true;
    }
  }

  return false;
};

/**
 * Get conflicting fields
 */
export const getConflictingFields = (local: any, remote: any): string[] => {
  const ignoreFields = ['id', 'version', 'created_at', 'updated_at', '_last_modified', '_version'];
  const conflictingFields: string[] = [];

  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  for (const key of allKeys) {
    if (ignoreFields.includes(key)) continue;

    const localValue = local[key];
    const remoteValue = remote[key];

    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      conflictingFields.push(key);
    }
  }

  return conflictingFields;
};

/**
 * Resolve conflict using strategy
 */
export const resolveConflict = (
  local: any,
  remote: any,
  strategy: ConflictResolutionStrategy
): ConflictResolution => {
  const conflictingFields = getConflictingFields(local, remote);

  let mergedData: any;
  let notes: string;

  switch (strategy) {
    case 'local':
      mergedData = { ...local };
      notes = `Resolved using local version. Conflicting fields: ${conflictingFields.join(', ')}`;
      break;

    case 'remote':
      mergedData = { ...remote };
      notes = `Resolved using remote version. Conflicting fields: ${conflictingFields.join(', ')}`;
      break;

    case 'merge':
      mergedData = mergeConflicts(local, remote);
      notes = `Merged both versions. Conflicting fields: ${conflictingFields.join(', ')}`;
      break;

    case 'manual':
      mergedData = { ...local };
      notes = `Manual resolution required. Conflicting fields: ${conflictingFields.join(', ')}`;
      break;

    default:
      mergedData = { ...local };
      notes = 'Unknown strategy - using local version';
  }

  return {
    resolved: strategy !== 'manual',
    strategy,
    mergedData,
    conflictingFields,
    notes,
  };
};

/**
 * Merge conflicts intelligently
 */
const mergeConflicts = (local: any, remote: any): any => {
  const merged = { ...local };
  const ignoreFields = ['id', 'version', 'created_at', 'updated_at', '_last_modified', '_version'];

  // Ensure version is a valid number
  const localVersion = typeof local.version === 'number' ? local.version : 1;
  const remoteVersion = typeof remote.version === 'number' ? remote.version : 1;

  // For each field in remote
  for (const key in remote) {
    if (ignoreFields.includes(key)) continue;

    const localValue = local[key];
    const remoteValue = remote[key];

    // If values are different, prefer non-null/non-empty values
    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      // Prefer remote if local is empty/null
      if (!localValue && remoteValue) {
        merged[key] = remoteValue;
      }
      // Prefer local if remote is empty/null
      else if (localValue && !remoteValue) {
        merged[key] = localValue;
      }
      // Both have values - keep local (conservative approach)
      else if (localValue && remoteValue) {
        merged[key] = localValue;
      }
    }
  }

  // Update metadata to reflect merge
  merged.version = Math.max(localVersion, remoteVersion) + 1;
  merged.updated_at = new Date().toISOString();

  return merged;
};

/**
 * Detect batch conflicts
 */
export const detectBatchConflicts = (
  localItems: Package[] | Driver[],
  remoteItems: Package[] | Driver[]
): ConflictInfo[] => {
  const conflicts: ConflictInfo[] = [];

  // Create map of remote items by ID
  const remoteMap = new Map<string, Package | Driver>(
    remoteItems.map(item => [item.id, item] as [string, Package | Driver])
  );

  // Check each local item
  for (const localItem of localItems) {
    const remoteItem = remoteMap.get(localItem.id);

    if (remoteItem) {
      const conflict = detectPackageConflict(localItem as Package, remoteItem as Package);
      if (conflict.hasConflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
};

/**
 * Format conflict info for display
 */
export const formatConflictInfo = (conflict: ConflictInfo): string => {
  return `
Conflict Type: ${conflict.type}
Reason: ${conflict.reason}
Recommendation: ${conflict.recommendation}

Local:
  Version: ${conflict.local.version}
  Updated: ${conflict.local.updatedAt}

Remote:
  Version: ${conflict.remote.version}
  Updated: ${conflict.remote.updatedAt}
  `.trim();
};

/**
 * Log conflict for debugging
 */
export const logConflict = (conflict: ConflictInfo, context?: string): void => {
  console.warn(`⚠️ Conflict Detected${context ? ` (${context})` : ''}:`);
  console.warn(formatConflictInfo(conflict));
};

/**
 * Check if conflict is critical (requires manual intervention)
 */
export const isCriticalConflict = (conflict: ConflictInfo): boolean => {
  return conflict.type === 'content_change' && conflict.recommendation === 'manual';
};

/**
 * Get conflict severity (0-100)
 */
export const getConflictSeverity = (conflict: ConflictInfo): number => {
  if (!conflict.hasConflict) return 0;

  switch (conflict.type) {
    case 'version_mismatch':
      return 30; // Low severity - can auto-resolve
    case 'timestamp_mismatch':
      return 40; // Low-medium severity
    case 'content_change':
      return 80; // High severity - needs attention
    default:
      return 0;
  }
};
