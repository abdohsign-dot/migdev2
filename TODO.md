# Project TODO

## Current status

### Completed
- [x] Create operation context type definition
- [x] Create `useAdminStore` - separate admin state
- [x] Create `useDriverStore` - separate driver state
- [x] Create `useSyncStore` - centralized sync queue
- [x] Create `useContextStore` - track operation context
- [x] Add `statusHistory` to `Package` model
- [x] Add `auditLog` to `Driver` model
- [x] Create `adminSync` utility - role-specific logic
- [x] Create `driverSync` utility - role-specific logic
- [x] Refactor `supabaseRealtime` - role-isolated listeners
- [x] Partition local database by role (storage partitioning implemented)
- [x] Wire driver-specific sync queue partitioning through local and shared sync helpers

### In progress / next
- [x] Update `useAuthStore` - add cleanup on logout
- [ ] Create role-based navigation wrapper
- [ ] Separate admin screens into `/admin` folder
- [ ] Separate driver screens into `/driver` folder
- [ ] Update all admin screens to use `useAdminStore`
- [ ] Update all driver screens to use `useDriverStore`
- [x] Enforce field ownership rules in sync logic
- [ ] Add operation context to every DB operation
- [ ] Add tombstones for deleted records
- [ ] Update conflict detection with context awareness
- [ ] Add immutable history tracking
- [ ] Test listener cleanup on role switch
- [ ] Create comprehensive integration tests

## Last updates
- `ARCHITECTURE_PLAN.md` was updated to mark completed phases and reshape the remaining work.
- `src/utils/localDatabase.ts` now uses role-partitioned storage keys for admin and driver packages, sync queues, and last sync timestamps.
- `src/utils/supabaseSync.ts` now supports driver-scoped queue keys and `processSyncQueue(driverId)`.
- `src/hooks/useLocalDatabase.ts` now forwards `driverId` into `addToSyncQueue(...)` and periodic queue processing.
- `src/store/useAuthStore.ts` now cleans up Realtime listeners and role-specific partitions on logout.
- `src/utils/ownershipRules.ts` was added to validate role-based field modifications.
- `src/utils/adminSync.ts` and `src/utils/driverSync.ts` now use `filterModifiableFields` to strictly enforce role ownership over modified fields.

## Known remaining compile issues
- None currently known.

## Recommended next actions
1. Implement role-based navigation and move screens into `/admin` and `/driver` folders.
2. Add tombstone and history tracking utilities.
3. Add tests for role switch listener cleanup, sync queue partitioning, and offline recovery.
