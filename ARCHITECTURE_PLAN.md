# Single App, Two Isolated Architectures - Implementation Plan

> **Goal**: Transform from shared mutable state to role-isolated architecture while keeping both admin & driver in ONE app.

---

## 📋 Executive Summary

### What's Already Done ✅
1. **Role-aware listeners**: `listenToPackages()` & `listenToDriverPackages()` implemented
2. **Backpressure handling**: Updates won't overwhelm UI
3. **Service role for migrations**: Bypass RLS when migrating data
4. **Conflict detection**: Basic conflict logic exists
5. **Version tracking**: Package & Driver have version field
6. **Screen separation**: Admin & driver screens are different
7. **Local DB partitioning**: Role-partitioned local storage implemented
8. **Role-specific sync queue**: driver/admin sync queues wired through local and shared sync utilities

### What's Missing ❌
1. **Operation context**: No tracking of WHO, WHEN, WHERE, WHY
2. **Separate stores**: `useAdminStore()` / `useDriverStore()` exist, but `useAuthStore()` still needs cleanup on logout
3. **Listener cleanup**: Listeners leak across role switches
4. **Field ownership enforcement**: No rules preventing admin/driver field mixing
5. **Immutable history**: Changes don't preserve history
6. **Tombstones**: No archived/deleted state tracking
7. **Sync ownership**: Unclear which logic handles which role in every operation
8. **Navigation isolation**: No role-based navigation wrapper
9. **Audit trails**: No logging of who did what

---

## 🏗️ Recommended Architecture

```
Single App
├── Admin Mode
│   ├── useAdminStore()
│   ├── adminSync logic
│   ├── /admin/* navigation stack
│   └── admin-owned field enforcement
├── Driver Mode
│   ├── useDriverStore()
│   ├── driverSync logic
│   ├── /driver/* navigation stack
│   └── driver-owned field enforcement
├── Shared Core
│   ├── useAuthStore() - auth only
│   ├── useSyncStore() - unified queue
│   ├── useContextStore() - operation tracking
│   ├── Shared models (Package, Driver)
│   └── Shared utilities
└── Role Awareness
    ├── RoleBasedNavigator
    ├── Role-isolated listeners
    ├── Listener cleanup on logout
    └── Context-aware conflict detection
```

---

## 🎯 Seven Golden Rules

### 1. Every Operation Carries Context
```typescript
{
  actorId: 'driver-123',
  actorRole: 'driver',
  operationId: 'uuid-xxx',  // Unique per operation
  deviceId: 'device-abc',
  updatedAt: '2024-05-16T10:00:00Z',
  source: 'app'
}
```

### 2. Separate Stores Completely
```typescript
// ❌ DON'T DO THIS
const data = useAppStore();

// ✅ DO THIS
const adminData = useAdminStore();
const driverData = useDriverStore();
const syncManager = useSyncStore();
```

### 3. Driver Never Edits Admin Fields
```typescript
Admin Owns: assignment, pricing, client_info, zones
Driver Owns: status, location, completion_notes

// Enforced in:
// - canModifyField(field, context)
// - Field ownership validator
// - Supabase RLS policies
```

### 4. Use Role-Isolated Listeners
```typescript
// When admin logs in:
listenToAdminPackages()     // ONLY admin data

// When driver logs in:
cleanupListeners('admin')   // Remove admin listeners
listenToDriverMissions()    // NEW driver listeners

// On logout:
cleanupListeners('admin')
cleanupListeners('driver')
// ALL listeners gone
```

### 5. Add Tombstones for Deleted/Archived
```typescript
// Instead of: DELETE * WHERE id = 'xyz'
// Do this:

// Admin deletion
archived_by_admin = true   // Now hidden from UI

// Driver archive
archived_by_driver = true  // Only hides for driver

// Sync logic: ignores tombstones
// But keeps them in DB for reference
```

### 6. Partition Local Database by Role
```typescript
// ❌ BAD: Global namespace
packages: Package[]

// ✅ GOOD: Role-partitioned
{
  admin: {
    drivers: Driver[],
    packages: Package[],
    zones: Zone[],
  },
  driver: {
    [driverId]: {
      missions: Package[],
      profile: Driver,
    }
  },
  cache: {
    zones: Zone[],
  }
}
```

### 7. Use Immutable History
```typescript
// ❌ DON'T: Overwrite status silently
package.status = 'Delivered';

// ✅ DO: Preserve history
package = {
  ...package,
  status: 'Delivered',
  statusHistory: [
    ...package.statusHistory,
    {
      status: 'Delivered',
      changedAt: context.updatedAt,
      changedBy: context,
    }
  ]
}
```

---

## 📍 Implementation Roadmap

### Phase 1: Core Types (2-3 hours)
- [x] Add `OperationContext` type
- [x] Add `StatusHistoryEntry` type  
- [x] Add `AuditLogEntry` type
- [x] Add field ownership constants
- [x] Update Package & Driver models

**Deliverable**: [src/types/index.ts](src/types/index.ts) with full context types

---

### Phase 2: Create Stores (3-4 hours)
- [ ] Enhance `useAuthStore()` - add cleanup methods
- [x] Create `useAdminStore()` - admin data & operations
- [x] Create `useDriverStore()` - driver data & operations
- [x] Create `useSyncStore()` - unified queue manager
- [x] Create `useContextStore()` - operation context tracking

**Deliverable**: 
- [src/store/useAdminStore.ts](src/store/useAdminStore.ts)
- [src/store/useDriverStore.ts](src/store/useDriverStore.ts)
- [src/store/useSyncStore.ts](src/store/useSyncStore.ts)
- [src/store/useContextStore.ts](src/store/useContextStore.ts)

---

### Phase 3: Database Schema (2 hours)
- [ ] Add `statusHistory` JSONB to packages table
- [ ] Add `auditLog` JSONB to drivers table
- [ ] Add `changedBy` JSONB to both tables
- [ ] Add `archived_by_admin`, `archived_by_driver` booleans
- [ ] Update RLS policies for field ownership

**Deliverable**: SQL migration files in [migrations/](migrations/)

---

### Phase 4: Role-Isolated Listeners (2-3 hours)
- [x] Refactor `supabaseRealtime.ts`:
  - `listenToAdminPackages()` - admin only
  - `listenToDriverMissions()` - driver only
  - `cleanupListeners(role)` - full cleanup
- [x] Add listener tracking & validation
- [x] Add backpressure per-role

**Deliverable**: Updated [src/utils/supabaseRealtime.ts](src/utils/supabaseRealtime.ts)

---

### Phase 5: Partition Local Database (2-3 hours)
- [x] Create partitioned storage keys
- [x] Update `getPackagesLocally()` - role-aware
- [x] Update `getDriversLocally()` - role-aware
- [ ] Add tombstone filtering
- [ ] Add partition cleanup on logout

**Deliverable**: Updated [src/utils/localDatabase.ts](src/utils/localDatabase.ts)

---

### Phase 6: Role-Specific Sync (3-4 hours)
- [x] Create `src/utils/adminSync.ts`:
  - `syncAdminOperations()` - admin operations only
  - `validateAdminOperation()` - ownership checks
  - Admin field update logic
- [x] Create `src/utils/driverSync.ts`:
  - `syncDriverOperations()` - driver operations only
  - `validateDriverOperation()` - ownership checks
  - Driver field update logic
- [ ] Add context to all operations
- [x] Wire role-specific sync queue partitioning

**Deliverable**:
- [src/utils/adminSync.ts](src/utils/adminSync.ts)
- [src/utils/driverSync.ts](src/utils/driverSync.ts)

---

### Phase 7: Navigation (2 hours)
- [ ] Create `src/navigation/RoleBasedNavigator.tsx` - dispatcher
- [ ] Create `src/navigation/AdminNavigator.tsx` - admin stack
- [ ] Create `src/navigation/DriverNavigator.tsx` - driver stack
- [ ] Create `src/navigation/LoginNavigator.tsx` - login only
- [ ] Reorganize screens into [src/screens/admin/](src/screens/admin/) & [src/screens/driver/](src/screens/driver/)

**Deliverable**: New navigation structure

---

### Phase 8: Screen Refactor (4-5 hours)
Admin screens update to use `useAdminStore()`:
- [ ] AdminDashboardScreen.tsx
- [ ] DriverListScreen.tsx
- [ ] AddDriverScreen.tsx
- [ ] ModifyDriverScreen.tsx
- [ ] AdminPackageListScreen.tsx
- [ ] ChangeAdminPinScreen.tsx

Driver screens update to use `useDriverStore()`:
- [ ] DelivererTaskScreen.tsx
- [ ] PackageListScreen.tsx

**Deliverable**: All screens using role-specific stores & context

---

### Phase 9: Field Ownership Rules (2-3 hours)
- [ ] Create `src/utils/ownershipRules.ts`:
  - `canModifyField(field, context)` - ownership check
  - `filterModifiableFields(changes, context)` - filter by role
  - Ownership constants
- [ ] Apply in all sync operations
- [ ] Add validation logs

**Deliverable**: [src/utils/ownershipRules.ts](src/utils/ownershipRules.ts)

---

### Phase 10: Immutable History (2-3 hours)
- [ ] Create `src/utils/historyTracker.ts`:
  - `addStatusHistory()` - append to statusHistory
  - `addAuditLog()` - append to auditLog
  - History utilities
- [ ] Use in all update operations
- [ ] Never overwrite history

**Deliverable**: [src/utils/historyTracker.ts](src/utils/historyTracker.ts)

---

### Phase 11: Tombstones (1-2 hours)
- [ ] Create `src/utils/tombstones.ts`:
  - `archivePackageByDriver()` - set archived_by_driver
  - `archivePackageByAdmin()` - set archived_by_admin
  - `shouldShowPackage(pkg, context)` - filter logic
- [ ] Apply in all queries
- [ ] Update sync to respect tombstones

**Deliverable**: [src/utils/tombstones.ts](src/utils/tombstones.ts)

---

### Phase 12: Testing & Integration (3-4 hours)
- [ ] Test listener cleanup on role switch
- [ ] Test field ownership enforcement
- [ ] Test history immutability
- [ ] Test tombstone filtering
- [ ] Test sync with context
- [ ] Test offline scenarios
- [ ] Add integration tests

**Deliverable**: Test suite & validation

---

## 🚀 Quick Start Command

To start Phase 1, create the types:

```bash
# You can follow the type definitions in src/types/index.ts
# Add OperationContext, StatusHistoryEntry, AuditLogEntry
# Update Package and Driver models
```

---

## 📊 Success Metrics

✅ **Phase 1-3 Complete**: 
- Types defined
- Stores stubbed
- DB schema ready

✅ **Phase 4-6 Complete**:
- Listeners isolated
- Sync logic separated
- Local DB partitioned

✅ **Phase 7-9 Complete**:
- Navigation working
- Screens refactored
- Ownership enforced

✅ **Phase 10-12 Complete**:
- History tracking
- Tombstones working
- All tests passing
- **NO more shared state**
- **100% operation traceability**
- **Impossible to cross roles**

---

## 🔗 Key Files to Update

### New Files to Create
1. `src/store/useAdminStore.ts`
2. `src/store/useDriverStore.ts`
3. `src/store/useSyncStore.ts`
4. `src/store/useContextStore.ts`
5. `src/utils/adminSync.ts`
6. `src/utils/driverSync.ts`
7. `src/utils/ownershipRules.ts`
8. `src/utils/historyTracker.ts`
9. `src/utils/tombstones.ts`
10. `src/navigation/RoleBasedNavigator.tsx`
11. `src/navigation/AdminNavigator.tsx`
12. `src/navigation/DriverNavigator.tsx`

### Files to Update
1. `src/types/index.ts` - Add context types
2. `src/store/useAuthStore.ts` - Add cleanup methods
3. `src/utils/supabaseRealtime.ts` - Isolate listeners
4. `src/utils/localDatabase.ts` - Partition by role
5. `src/utils/supabaseSync.ts` - Add context
6. `src/utils/conflictDetection.ts` - Context-aware
7. ALL screens - Use role-specific stores
8. `App.tsx` - Use RoleBasedNavigator

### Migrations
1. Add statusHistory column
2. Add auditLog column
3. Add changedBy column
4. Add archived_by_* columns
5. Populate initial values

---

## 💡 Tips & Tricks

### For Context Creation
```typescript
import { useContextStore } from '../store/useContextStore';

const { createContext } = useContextStore();
const context = createContext(actorId, actorRole);
```

### For Field Ownership Checks
```typescript
import { canModifyField } from '../utils/ownershipRules';

if (!canModifyField(fieldName, context)) {
  throw new Error(`${context.actorRole} cannot modify ${fieldName}`);
}
```

### For History Tracking
```typescript
import { addStatusHistory } from '../utils/historyTracker';

const updated = addStatusHistory(pkg, newStatus, context);
await upsertPackageServiceRole(updated);
```

### For Listener Cleanup
```typescript
import { cleanupListeners } from '../utils/supabaseRealtime';

useEffect(() => {
  return () => {
    cleanupListeners('admin');
    cleanupListeners('driver');
  };
}, []);
```

---

## 📚 References

- **Rule Engine**: [FIELD_OWNERSHIP](src/types/index.ts)
- **Operation Context**: [OperationContext](src/types/index.ts)
- **History Types**: [StatusHistoryEntry](src/types/index.ts)
- **Listener Management**: [supabaseRealtime.ts](src/utils/supabaseRealtime.ts)
- **Sync Logic**: [adminSync.ts](src/utils/adminSync.ts) & [driverSync.ts](src/utils/driverSync.ts)

---

## ⚠️ Critical Gotchas

### 1. Listener Cleanup MUST Happen on Logout
```typescript
// In useAuthStore logout()
await cleanupListeners('admin');
await cleanupListeners('driver');
```

### 2. Every Operation MUST Have Context
```typescript
// ✅ GOOD
await updatePackageStatus(id, status, context);

// ❌ BAD
await updatePackageStatus(id, status);
```

### 3. History NEVER Gets Overwritten
```typescript
// ✅ GOOD
statusHistory.push(newEntry);

// ❌ BAD
statusHistory = [newEntry];
```

### 4. Local DB Must Be Role-Partitioned
```typescript
// ✅ GOOD
const driverPackages = await getPackagesLocally({ role: 'driver', driverId });

// ❌ BAD
const allPackages = await getPackagesLocally();
```

### 5. Tombstones Never Deleted
```typescript
// ✅ GOOD
archivedByDriver = true;  // Mark as deleted

// ❌ BAD
await deletePackage(id);   // Actually removes from DB
```

---

## 📞 Questions?

See detailed breakdown in:
- [Implementation Roadmap](ARCHITECTURE_PLAN.md#-implementation-roadmap)
- Session memory files:
  - `/memories/session/architecture-analysis.md`
  - `/memories/session/implementation-roadmap.md`
  - `/memories/session/before-after-comparison.md`

---

**Status**: 📝 Planning Phase  
**Last Updated**: 2024-05-16  
**Estimated Duration**: 30-40 hours (4 sprints)  
**Priority**: High (Foundation for scalability)
