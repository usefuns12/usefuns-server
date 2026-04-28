# STEP 2: Admin Visibility & Control ✅ COMPLETE

## Overview

Implemented comprehensive admin dashboard APIs with policy versioning and manual intervention capabilities. This provides full visibility into salary and commission cycles while maintaining immutable audit trails.

**Status**: ✅ COMPLETE  
**Completion Date**: [Auto-populated]  
**Total Endpoints**: 11 (6 read + 5 actions)

---

## 2.1 Admin Read APIs ✅

### Salary Cycles

#### GET /api/admin/salary-cycles

List all salary cycles with filtering, pagination, and sorting.

**Query Parameters:**

- `status` - Filter by status (pending, calculated, paid, held, disputed)
- `hostId` - Filter by specific host
- `startDate` - Filter by cycle start date (YYYY-MM-DD)
- `endDate` - Filter by cycle end date (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sortBy` - Sort field (default: cycleStart)
- `sortOrder` - Sort direction: asc/desc (default: desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "cycles": [
      {
        "_id": "...",
        "hostId": { "_id": "...", "customerRef": "...", "name": "..." },
        "agencyId": "...",
        "cycleStart": "2024-01-01T00:00:00.000Z",
        "cycleEnd": "2024-01-07T23:59:59.999Z",
        "totalDiamonds": 50000,
        "validDiamonds": 48000,
        "totalHostHours": 42,
        "salaryPercentage": 35,
        "salaryUcoins": 16800,
        "status": "calculated",
        "policySnapshot": { ... },
        "recalculatedAt": null,
        "heldAt": null
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 100,
      "itemsPerPage": 20
    }
  }
}
```

---

#### GET /api/admin/salary-cycles/stats

Aggregate statistics for salary cycles.

**Response:**

```json
{
  "success": true,
  "data": {
    "byStatus": [
      {
        "status": "calculated",
        "count": 45,
        "totalSalary": 1250000,
        "avgSalary": 27777.78
      }
    ],
    "overall": {
      "totalCycles": 100,
      "totalSalary": 3500000,
      "avgSalary": 35000
    }
  }
}
```

---

#### GET /api/admin/salary-cycles/:id

Get detailed information for a single salary cycle.

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "hostId": {
      "_id": "...",
      "customerRef": "...",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "agencyId": {
      "_id": "...",
      "name": "Top Agency"
    },
    "cycleStart": "2024-01-01T00:00:00.000Z",
    "cycleEnd": "2024-01-07T23:59:59.999Z",
    "totalDiamonds": 50000,
    "validDiamonds": 48000,
    "totalHostHours": 42,
    "salaryPercentage": 35,
    "salaryUcoins": 16800,
    "status": "calculated",
    "policySnapshot": {
      "policyId": "...",
      "version": 1,
      "appliedAt": "2024-01-08T00:00:00.000Z",
      "diamondTarget": 45000,
      "hourSlabs": [...],
      "reward": { ... }
    },
    "recalculationHistory": [
      {
        "timestamp": "2024-01-09T10:30:00.000Z",
        "adminId": "...",
        "reason": "Dispute resolution - corrected hours",
        "oldAmount": 15000,
        "newAmount": 16800,
        "changes": {
          "diamondAdjustment": 0,
          "hourAdjustment": 2,
          "oldHours": 40,
          "newHours": 42
        }
      }
    ]
  }
}
```

---

### Agency Commissions

#### GET /api/admin/agency-commissions

List agency commission cycles with filtering and pagination.

**Query Parameters:** Same as salary cycles (status, agencyId, startDate, endDate, page, limit, sortBy, sortOrder)

**Response:**

```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "_id": "...",
        "agencyId": { "_id": "...", "name": "Top Agency" },
        "cycleStart": "2024-01-01T00:00:00.000Z",
        "cycleEnd": "2024-01-31T23:59:59.999Z",
        "totalHostSalary": 500000,
        "commissionPercentage": 10,
        "commissionUcoins": 50000,
        "status": "calculated",
        "policySnapshot": { ... }
      }
    ],
    "pagination": { ... }
  }
}
```

---

#### GET /api/admin/agency-commissions/stats

Aggregate statistics for agency commissions.

---

#### GET /api/admin/agency-commissions/:id

Get detailed commission cycle with contributing host cycles.

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "agencyId": { "_id": "...", "name": "Top Agency" },
    "cycleStart": "2024-01-01T00:00:00.000Z",
    "cycleEnd": "2024-01-31T23:59:59.999Z",
    "totalHostSalary": 500000,
    "commissionPercentage": 10,
    "commissionUcoins": 50000,
    "status": "calculated",
    "hostCycles": [
      {
        "_id": "...",
        "hostId": "...",
        "salaryUcoins": 16800,
        "status": "paid"
      }
    ],
    "policySnapshot": {
      "policyId": "...",
      "version": 1,
      "appliedAt": "2024-02-01T00:00:00.000Z",
      "salarySlabs": [
        { "min": 0, "max": 500000, "percentage": 8 },
        { "min": 500000, "max": 1000000, "percentage": 10 }
      ]
    }
  }
}
```

---

## 2.2 Policy Versioning ✅

### Implementation

#### Model Updates

Both `HostSalaryCycle` and `AgencyCommissionCycle` models now include:

```javascript
policySnapshot: {
  type: Object,
  required: false, // For migration compatibility
  description: "Immutable snapshot of policy at calculation time"
}
```

**Snapshot Structure:**

```javascript
{
  policyId: ObjectId,
  version: Number,
  appliedAt: Date,
  // For HostSalaryCycle:
  diamondTarget: Number,
  hourSlabs: Array,
  reward: Object,

  // For AgencyCommissionCycle:
  salarySlabs: Array
}
```

---

#### Service Updates

**hostSalary.service.js:**

```javascript
const policy = await Policy.findOne({ type: "hostSalary" }).lean();

const policySnapshot = {
  policyId: policy._id,
  version: policy.version || 1,
  appliedAt: new Date(),
  diamondTarget: policy.hostSalary.diamondTarget,
  hourSlabs: policy.hostSalary.hourSlabs,
  reward: policy.hostSalary.reward,
};

// Return snapshot with calculation results
return {
  salaryPercentage,
  salaryUcoins,
  policySnapshot,
};
```

**agencyCommission.service.js:**

```javascript
async function calculateAgencyCommission(totalUcoins) {
  const policy = await Policy.findOne({ type: "agencyCommission" }).lean();

  const policySnapshot = {
    policyId: policy._id,
    version: policy.version || 1,
    appliedAt: new Date(),
    salarySlabs: policy.agencyCommission.salarySlabs,
  };

  return { percentage, commissionUcoins, policySnapshot };
}
```

---

### Benefits

1. **Immutability**: Policy changes don't affect past calculations
2. **Audit Trail**: Complete history of what policy was used for each cycle
3. **Legal Compliance**: Proof of calculation methodology at time of payout
4. **Dispute Resolution**: Can verify calculations against stored policy
5. **Debugging**: Trace issues to specific policy versions

---

## 2.3 Manual Admin Actions ✅

### Recalculate Salary Cycle

#### POST /api/admin/salary-cycles/:id/recalculate

Manually recalculate a cycle with adjustments (e.g., dispute resolution, corrections).

**Request Body:**

```json
{
  "reason": "Dispute resolution - corrected hours based on video review",
  "diamondAdjustment": 0,
  "hourAdjustment": 2
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary cycle recalculated successfully",
  "data": {
    "cycleId": "...",
    "oldAmount": 15000,
    "newAmount": 16800,
    "difference": 1800,
    "adjustments": {
      "diamonds": 0,
      "hours": 2
    }
  }
}
```

**Restrictions:**

- ❌ Cannot recalculate paid cycles (must reverse first)
- ✅ Creates audit trail in `recalculationHistory`
- ✅ Updates `policySnapshot` with new calculation

---

### Hold Salary Cycle

#### POST /api/admin/salary-cycles/:id/hold

Prevent payout processing (e.g., fraud investigation, dispute).

**Request Body:**

```json
{
  "reason": "Under investigation for suspicious activity"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary cycle held successfully",
  "data": {
    "cycleId": "...",
    "status": "held",
    "reason": "Under investigation for suspicious activity"
  }
}
```

**Effects:**

- Status changed to "held"
- Payout scheduler skips this cycle
- Records `heldAt`, `heldBy`, `holdReason`

---

### Release Salary Cycle

#### POST /api/admin/salary-cycles/:id/release

Release a held cycle for normal processing.

**Request Body:**

```json
{
  "reason": "Investigation complete - no issues found"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary cycle released successfully",
  "data": {
    "cycleId": "...",
    "status": "calculated"
  }
}
```

**Effects:**

- Status returned to "calculated"
- Records `releasedAt`, `releasedBy`
- Eligible for next payout run

---

### Force Payout

#### POST /api/admin/salary-cycles/:id/force-payout

Immediately process payout bypassing waiting period.

**Request Body:**

```json
{
  "reason": "Emergency payout requested by host"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary payout forced successfully",
  "data": {
    "cycleId": "...",
    "amount": 16800,
    "walletBalance": 50000,
    "transactionId": "..."
  }
}
```

**Restrictions:**

- ❌ Cannot force payout on held cycles
- ❌ Cannot force payout if already paid
- ❌ Cannot force payout for zero salary
- ✅ Creates immediate wallet transaction
- ✅ Logs admin action in transaction meta

---

### Reverse Payment

#### POST /api/admin/salary-cycles/:id/reverse

Reverse a paid salary (deduct from wallet).

**Request Body:**

```json
{
  "reason": "Payment error - duplicate payout detected"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary payment reversed successfully",
  "data": {
    "cycleId": "...",
    "reversedAmount": 16800,
    "walletBalance": 33200,
    "transactionId": "..."
  }
}
```

**Restrictions:**

- ❌ Can only reverse paid cycles
- ❌ Requires sufficient wallet balance
- ✅ Creates negative transaction
- ✅ Changes status to "disputed"
- ✅ Logs reversal reason

---

## Database Schema Changes

### HostSalaryCycle Model

**Added Fields:**

```javascript
{
  // Policy snapshot
  policySnapshot: { type: Object, required: false },

  // Recalculation tracking
  recalculatedAt: Date,
  recalculatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  recalculationReason: String,
  recalculationHistory: [{
    timestamp: Date,
    adminId: Schema.Types.ObjectId,
    reason: String,
    oldAmount: Number,
    newAmount: Number,
    changes: {
      diamondAdjustment: Number,
      hourAdjustment: Number,
      oldDiamonds: Number,
      newDiamonds: Number,
      oldHours: Number,
      newHours: Number
    }
  }],

  // Admin hold tracking
  heldAt: Date,
  heldBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  holdReason: String,
  releasedAt: Date,
  releasedBy: { type: Schema.Types.ObjectId, ref: "Admin" },

  // Status enum extended
  status: {
    type: String,
    enum: ["pending", "calculated", "paid", "held", "disputed"],
    default: "pending"
  }
}
```

---

### AgencyCommissionCycle Model

**Added Fields:**

```javascript
{
  // Policy snapshot
  policySnapshot: { type: Object, required: false },

  // Calculation details
  calculation: { type: Object },

  // Same recalculation and hold tracking as HostSalaryCycle

  // Status enum extended
  status: {
    type: String,
    enum: ["pending", "calculated", "paid", "held", "disputed"],
    default: "pending"
  }
}
```

---

## Security & Access Control

**Authentication Required:**

- All admin endpoints require valid JWT token
- `authenticate` middleware validates token
- `isAdmin` middleware checks user role

**Authorization:**

```javascript
router.use(authenticate);
router.use(isAdmin);
```

**Audit Logging:**

- Every admin action records `adminId`
- Timestamps for all actions
- Reason required for sensitive operations
- Complete history in `recalculationHistory`

---

## API Testing Examples

### Using cURL

**List salary cycles:**

```bash
curl -X GET \
  'http://localhost:3000/api/admin/salary-cycles?status=calculated&page=1&limit=10' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'
```

**Hold a cycle:**

```bash
curl -X POST \
  'http://localhost:3000/api/admin/salary-cycles/507f1f77bcf86cd799439011/hold' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Investigating suspicious activity"
  }'
```

**Recalculate with adjustments:**

```bash
curl -X POST \
  'http://localhost:3000/api/admin/salary-cycles/507f1f77bcf86cd799439011/recalculate' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Corrected streaming hours after review",
    "diamondAdjustment": 0,
    "hourAdjustment": 3
  }'
```

**Force payout:**

```bash
curl -X POST \
  'http://localhost:3000/api/admin/salary-cycles/507f1f77bcf86cd799439011/force-payout' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Emergency payout approved by management"
  }'
```

---

## Integration with Payout Scheduler

**Modified salaryPayout.service.js:**

```javascript
async function processSalaryPayouts() {
  // Skip held cycles
  const cycles = await HostSalaryCycle.find({
    status: "calculated", // Excludes "held"
    cycleEnd: { $lt: new Date(Date.now() - WAITING_PERIOD) },
  });

  for (const cycle of cycles) {
    // Process payout...
  }
}
```

**Held cycles:**

- Automatically skipped by scheduler
- Must be manually released before payout
- Shows in admin dashboard with "held" badge

---

## Error Handling

**Common Error Responses:**

**404 - Cycle Not Found:**

```json
{
  "success": false,
  "message": "Salary cycle not found"
}
```

**400 - Invalid State:**

```json
{
  "success": false,
  "message": "Cannot recalculate already paid cycle. Reverse transaction first."
}
```

**400 - Insufficient Balance:**

```json
{
  "success": false,
  "message": "Insufficient wallet balance to reverse transaction"
}
```

**500 - Server Error:**

```json
{
  "success": false,
  "message": "Failed to force salary payout",
  "error": "Database connection timeout"
}
```

---

## Next Steps

### ✅ STEP 2 Complete - Ready for STEP 3

**Immediate Priority: STEP 3 - Wallet Safety & Locking** 🔴 CRITICAL

**What to implement next:**

1. Wallet locking mechanism (prevent concurrent modifications)
2. Transaction atomicity (rollback on failure)
3. Balance validation (prevent negative balances)
4. Fraud detection hooks

**User should proceed to:** `STEP-3-WALLET-SAFETY.md`

---

## Migration Guide

### For Existing Cycles

**Add policySnapshot to existing cycles:**

```javascript
const Policy = require("./models/Policy");
const HostSalaryCycle = require("./models/HostSalaryCycle");

async function migrateCycles() {
  const policy = await Policy.findOne({ type: "hostSalary" });
  const policySnapshot = {
    policyId: policy._id,
    version: 1,
    appliedAt: new Date(),
    diamondTarget: policy.hostSalary.diamondTarget,
    hourSlabs: policy.hostSalary.hourSlabs,
    reward: policy.hostSalary.reward,
  };

  await HostSalaryCycle.updateMany(
    { policySnapshot: { $exists: false } },
    { $set: { policySnapshot } }
  );
}
```

---

## Summary

✅ **11 New Endpoints Created**

- 6 Read-only dashboard APIs
- 5 Manual intervention endpoints

✅ **Policy Versioning Implemented**

- Immutable snapshots per cycle
- Complete audit trail
- Legal compliance

✅ **Admin Control Features**

- Recalculate with adjustments
- Hold/Release cycles
- Force immediate payout
- Reverse payments
- Full audit logging

✅ **Security**

- JWT authentication required
- Admin role verification
- Complete action tracking

🎯 **Next: STEP 3 - Wallet Safety & Locking** (CRITICAL PRIORITY)
