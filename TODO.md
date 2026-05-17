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
- [x] Create role-based navigation wrapper
- [x] Separate admin screens into `/admin` folder
- [x] Separate driver screens into `/driver` folder
- [x] Move `Login` screen into `/auth` folder and update auth imports
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
- `src/navigation/RoleBasedNavigator.tsx`, `src/navigation/AdminNavigator.tsx`, and `src/navigation/DriverNavigator.tsx` were created and wired into `App.tsx`.
- `src/screens/auth/LoginScreen.tsx` was updated to remove direct driver-stack navigation and rely on auth/role state.

## Known remaining compile issues
- None currently known.

## Recommended next actions
1. Update all admin screens to use `useAdminStore`.
2. Update all driver screens to use `useDriverStore`.
3. Add operation context to every DB operation.
4. Add tombstones and immutable history tracking.
5. Add integration tests for role switch listener cleanup, auth-based navigation, sync queue partitioning, and offline recovery.
