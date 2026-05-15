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
  supplement_info?: string;
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (last modification)
  version: number; // Semantic versioning (1, 2, 3...)
  is_archived?: boolean;
  archived_at?: string;
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
  pin_code: string;
  is_active: boolean;
  created_at: string; // ISO 8601 UTC timestamp
  updated_at: string; // ISO 8601 UTC timestamp (last modification)
  version: number; // Semantic versioning (1, 2, 3...)
  source?: 'firebase' | 'stored' | 'random' | 'admin-created' | 'local';
  // Deprecated: kept for backward compatibility during migration
  _last_modified?: string;
  _version?: string;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: 'packages' | 'drivers';
  data: any;
  timestamp: string;
  synced: boolean;
}

export interface SyncMetadata {
  lastSync: string;
  pendingCount: number;
}
