import { OperationContext, FIELD_OWNERSHIP } from '../types';

/**
 * Checks if a field can be modified by the actor in the given context.
 */
export const canModifyField = (field: string, context: OperationContext): boolean => {
  // Shared fields can be modified by anyone
  if (FIELD_OWNERSHIP.shared.includes(field as any)) {
    return true; 
  }

  // Admins can modify admin fields and driver fields (override capability)
  if (context.actorRole === 'admin') {
    return FIELD_OWNERSHIP.admin.includes(field as any) || FIELD_OWNERSHIP.driver.includes(field as any);
  }

  // Drivers can ONLY modify driver fields
  if (context.actorRole === 'driver') {
    return FIELD_OWNERSHIP.driver.includes(field as any);
  }

  // If we reach here, it's either an unknown field or unauthorized
  // For safety, we allow it if it's not explicitly in any list (e.g. driver fields not in FIELD_OWNERSHIP)
  // But wait, it's better to log a warning and deny it if strict.
  // Actually, we'll allow unknown fields but log a warning, since FIELD_OWNERSHIP might not be exhaustive.
  console.warn(`[Ownership rules] Unknown field ${field} checked for ${context.actorRole}`);
  return true;
};

/**
 * Filters an object of changes, returning only the fields the actor is allowed to modify.
 */
export const filterModifiableFields = <T extends Record<string, any>>(
  changes: Partial<T>,
  context: OperationContext
): Partial<T> => {
  const allowedChanges: Partial<T> = {};
  const rejectedFields: string[] = [];

  for (const [key, value] of Object.entries(changes)) {
    if (canModifyField(key, context)) {
      allowedChanges[key as keyof T] = value;
    } else {
      rejectedFields.push(key);
    }
  }

  if (rejectedFields.length > 0) {
    console.warn(
      `⚠️ [Ownership validation] ${context.actorRole} ${context.actorId} attempted to modify unauthorized fields:`,
      rejectedFields.join(', ')
    );
  }

  return allowedChanges;
};
