export interface OperationContext {
  actorId: string;
  actorRole: 'admin' | 'driver';
  operationId: string;
  deviceId: string;
  updatedAt: string; // ISO 8601 UTC timestamp
  source?: 'app' | 'background_sync' | 'migration';
}

export interface StatusHistoryEntry {
  status: Package['status'];
  changedAt: string; // ISO 8601 UTC timestamp
  changedBy: OperationContext;
  reason?: string;
}

export interface AuditLogEntry {
  action: string;
  timestamp: string; // ISO 8601 UTC timestamp
  actor: OperationContext;
  changes: Record<string, any>;
  result: 'success' | 'failed';
}

export const FIELD_OWNERSHIP = {
  admin: [
    'assigned_to',
    'assigned_at',
    'accepted_at',
    'price',
    'is_paid',
    'customer_name',
    'customer_address',
    'customer_phone',
    'customer_phone_2',
    'sender_name',
    'sender_company',
    'sender_phone',
    'date_of_arrive',
    'description',
    'weight',
    'limit_date',
    'limit_time',
    'supplement_info',
    'zone',
    'pricing',
    'client_info',
    'assignment',
  ] as const,
  driver: [
    'status',
    'gps_lat',
    'gps_lng',
    'delivered_at',
    'return_reason',
    'completion_notes',
    'is_archived',
    'archived_by_driver',
  ] as const,
  shared: [
    'id',
    'created_at',
    'updated_at',
    'version',
    'changedBy',
    'statusHistory',
    'auditLog',
  ] as const,
} as const;

export interface Package {
  id: string;
  ref_number: string;
  status: 'Pending' | 'Assigned' | 'In Transit' | 'Delivered' | 'Returned' | 'Archived';
  customer_name?: string; // Made optional
  customer_address?: string; // Made optional
  customer_phone?: string;
  customer_phone_2?: string;
  sender_name?: string;
  sender_company?: string;
  sender_phone?: string;
  date_of_arrive?: string;
  description?: string;
  weight?: string;
  price: number;
  is_paid: boolean;
  limit_date?: string; // Made optional
  limit_time?: string; // HH:mm
  gps_lat?: number;
  gps_lng?: number;
  assigned_to?: string;
  assigned_at?: string;
  accepted_at?: string;
  delivered_at?: string;
  return_reason?: string;
  completion_notes?: string;
  supplement_info?: string;
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (last modification)
  version: number; // Semantic versioning (1, 2, 3...)
  is_archived?: boolean;
  archived_at?: string;
  archivedByDriver?: boolean;
  archivedByAdmin?: boolean;
  statusHistory: StatusHistoryEntry[];
  changedBy?: OperationContext;
  // Deprecated: kept for backward compatibility during migration
  _last_modified?: string;
  _version?: string;
}

export interface Driver {
  id: string;
  custom_id?: string; // Custom driver ID (e.g., DRV-XXXXXX) for backward compatibility
  name: string;
  phone: string;
  vehicle_type: string;
  zone?: string;
  pin_code: string;
  is_active: boolean;
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (last modification)
  version: number; // Semantic versioning (1, 2, 3...)
  source?: 'firebase' | 'stored' | 'random' | 'admin-created' | 'local';
  auditLog: AuditLogEntry[];
  changedBy?: OperationContext;
  archivedByAdmin?: boolean;
  // Deprecated: kept for backward compatibility during migration
  _last_modified?: string;
  _version?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: 'packages' | 'drivers';
  data: any;
  context?: OperationContext;
  timestamp: string;
  synced: boolean;
}

export interface SyncMetadata {
  lastSync: string;
  pendingCount: number;
}
