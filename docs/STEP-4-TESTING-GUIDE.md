# STEP 4 Testing & Validation Guide

## Pre-Test Checklist

- [ ] Database: MongoDB running
- [ ] Server: `npm start` running
- [ ] Auth: JWT tokens available for testing
- [ ] Data: Test users (host + admin) with salary cycles created
- [ ] Tools: Postman or similar API client

---

## Setup Test Data

### Create Test Users

```javascript
// Admin user
{
  _id: "admin001",
  email: "admin@test.com",
  role: "admin",
  jwt: "admin_token_here"
}

// Host user
{
  _id: "host001",
  email: "host@test.com",
  role: "host",
  jwt: "host_token_here",
  wallet: {
    totalUcoins: 30000,
    withdrawableUcoins: 10000,
    lockedUcoins: 20000
  }
}

// Agency user
{
  _id: "agency001",
  email: "agency@test.com",
  role: "agency",
  jwt: "agency_token_here",
  wallet: {
    totalUcoins: 50000,
    withdrawableUcoins: 20000,
    lockedUcoins: 30000
  }
}
```

### Create Test Salary Cycle

```javascript
// POST /api/admin/salary-management/cycles
{
  hostId: "host001",
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  salaryUcoins: 15000,
  diamonds: 300,
  hours: 50,
  policySnapshot: {
    policyId: "policy_001",
    version: 1,
    appliedAt: "2025-01-01",
    baseSalary: 200,
    diamondRate: 20,
    hoursRate: 150,
    slabs: [...]
  }
}

Response:
{
  cycleId: "cycle_001"
}
```

---

## Test Suite 1: User Dispute Workflow

### Test 1.1: Raise Salary Dispute

**Endpoint**: `POST /api/disputes`

```bash
curl -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer host_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "salary",
    "referenceId": "cycle_001",
    "reason": "Hours recorded as 50, but I only worked 40 hours",
    "evidence": [
      "https://imgur.com/stream-screenshot.png",
      "Email confirmation shows 40 hours"
    ]
  }'
```

**Expected Response** (201):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_001",
      "type": "salary",
      "referenceId": "cycle_001",
      "raisedBy": "host001",
      "reason": "Hours recorded as 50, but I only worked 40 hours",
      "evidence": [...],
      "status": "open",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Validation**:

- ✅ Status is "open"
- ✅ raisedBy matches current user
- ✅ Dispute saved to DB
- ✅ auditLog has first entry

---

### Test 1.2: Get My Disputes

**Endpoint**: `GET /api/disputes/my`

```bash
curl http://localhost:3000/api/disputes/my \
  -H "Authorization: Bearer host_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "disputes": [
      {
        "_id": "dispute_001",
        "type": "salary",
        "reason": "Hours recorded incorrectly",
        "status": "open",
        "impactAmount": 5000,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1
    }
  }
}
```

**Validation**:

- ✅ Shows only own disputes
- ✅ Pagination working
- ✅ Can filter by status: `?status=open`

---

### Test 1.3: Get Dispute Details

**Endpoint**: `GET /api/disputes/:id`

```bash
curl http://localhost:3000/api/disputes/dispute_001 \
  -H "Authorization: Bearer host_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_001",
      "type": "salary",
      "referenceId": "cycle_001",
      "raisedBy": { _id: "host001", email: "host@test.com" },
      "reason": "Hours incorrect",
      "evidence": [...],
      "status": "open",
      "auditLog": [
        {
          "action": "created",
          "by": "host001",
          "timestamp": "...",
          "changes": {}
        }
      ]
    }
  }
}
```

**Validation**:

- ✅ Cycle details populated
- ✅ Audit log visible
- ✅ User can't access others' disputes (403)

---

### Test 1.4: Verify Dispute Prevents Withdrawal

**Scenario**: After raising dispute, try to withdraw

```bash
# Try to withdraw from disputed cycle
curl -X POST http://localhost:3000/api/wallet/withdraw \
  -H "Authorization: Bearer host_token_here" \
  -d '{ "amount": 5000, "cycleid": "cycle_001" }'
```

**Expected Response** (400):

```json
{
  "success": false,
  "error": "Cannot withdraw - dispute pending on this cycle"
}
```

**Validation**:

- ✅ Withdrawal blocked during dispute
- ✅ User gets clear message

---

## Test Suite 2: Admin Review Workflow

### Test 2.1: List All Disputes

**Endpoint**: `GET /api/disputes/admin/all`

```bash
curl "http://localhost:3000/api/disputes/admin/all?status=open" \
  -H "Authorization: Bearer admin_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "disputes": [
      {
        "_id": "dispute_001",
        "type": "salary",
        "raisedBy": "host001",
        "status": "open",
        "reason": "Hours incorrect"
      }
    ],
    "pagination": { ... }
  }
}
```

**Validation**:

- ✅ Shows all disputes (not just own)
- ✅ Filters by status work
- ✅ Non-admin gets 403

---

### Test 2.2: Review Dispute (Mark Under Review)

**Endpoint**: `PATCH /api/disputes/:id/review`

```bash
curl -X PATCH http://localhost:3000/api/disputes/dispute_001/review \
  -H "Authorization: Bearer admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Checking user'\''s evidence and logs"
  }'
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_001",
      "status": "under_review",
      "auditLog": [
        { "action": "created", ... },
        {
          "action": "reviewed",
          "by": "admin001",
          "timestamp": "2025-01-01T10:00:00Z",
          "note": "Checking user's evidence and logs"
        }
      ]
    }
  }
}
```

**Validation**:

- ✅ Status changed to "under_review"
- ✅ auditLog has review entry
- ✅ Audit includes note

---

### Test 2.3: Simulate Recalculation (DRY RUN)

**Endpoint**: `GET /api/disputes/:id/simulate-recalculation`

```bash
curl "http://localhost:3000/api/disputes/dispute_001/simulate-recalculation" \
  -H "Authorization: Bearer admin_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "simulation": {
      "oldAmount": 15000,
      "newAmount": 12000,
      "difference": -3000,
      "policyUsed": {
        "policyId": "policy_001",
        "version": 1,
        "appliedAt": "2025-01-01",
        "baseSalary": 200,
        "diamondRate": 20
      },
      "metadata": {
        "diamonds": 300,
        "hours": 40, // Corrected from 50
        "breakdown": {
          "baseFor40hrs": 8000,
          "diamonds300": 6000,
          "total": 14000
        }
      }
    }
  }
}
```

**Validation**:

- ✅ Shows difference (-3000)
- ✅ Includes policySnapshot used
- ✅ Doesn't modify wallet/cycle yet
- ✅ Admin can review before confirming

---

### Test 2.4: Resolve with Recalculation

**Endpoint**: `PATCH /api/disputes/:id/resolve/recalculate`

```bash
curl -X PATCH \
  http://localhost:3000/api/disputes/dispute_001/resolve/recalculate \
  -H "Authorization: Bearer admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Verified 40 hours from logs, recalculated"
  }'
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_001",
      "status": "resolved",
      "resolution": {
        "action": "recalculate",
        "resolvedBy": "admin001",
        "resolvedAt": "2025-01-01T10:30:00Z"
      },
      "recalculation": {
        "oldAmount": 15000,
        "newAmount": 12000,
        "difference": -3000,
        "transactionId": "txn_adjustment_001"
      },
      "auditLog": [...]
    }
  }
}
```

**What Happened (Behind Scenes)**:

1. ✅ Used policySnapshot from cycle (never changed)
2. ✅ Recalculated: 40 hrs × 200 + 300 diamonds × 20 = 12000
3. ✅ Computed delta: 12000 - 15000 = -3000
4. ✅ Applied adjustment to wallet: deducted 3000
5. ✅ Created adjustment transaction
6. ✅ Updated cycle.recalculationHistory
7. ✅ Logged everything in auditLog

---

### Test 2.5: Check Wallet After Adjustment

```bash
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer host_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "wallet": {
      "totalUcoins": 27000, // Was 30000, adjusted by -3000
      "withdrawableUcoins": 10000, // Unchanged (deducted from locked)
      "lockedUcoins": 17000, // Was 20000, adjusted by -3000
      "recentAdjustments": [
        {
          "type": "salaryAdjustment",
          "amount": -3000,
          "reason": "Dispute resolution",
          "transactionId": "txn_adjustment_001"
        }
      ]
    }
  }
}
```

**Validation**:

- ✅ Wallet balance updated correctly
- ✅ Deducted from locked balance
- ✅ Recent adjustment visible

---

### Test 2.6: Check Transaction Trail

```bash
curl "http://localhost:3000/api/transactions?type=salaryAdjustment" \
  -H "Authorization: Bearer host_token_here"
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "_id": "txn_adjustment_001",
        "type": "salaryAdjustment",
        "amount": -3000,
        "source": "dispute_adjustment",
        "adjustmentRef": "dispute_001",
        "adjustmentReason": "Recalculation from dispute",
        "originalTransactionId": "txn_salary_001",
        "meta": {
          "oldBalance": 30000,
          "newBalance": 27000,
          "oldLocked": 20000,
          "newLocked": 17000,
          "reason": "Dispute resolution"
        },
        "createdAt": "2025-01-01T10:30:00Z"
      }
    ]
  }
}
```

**Validation**:

- ✅ Adjustment transaction created
- ✅ Links to dispute and original transaction
- ✅ Full audit trail in meta
- ✅ Original salary transaction still exists

---

## Test Suite 3: Edge Cases

### Test 3.1: Reject Dispute

**Endpoint**: `PATCH /api/disputes/:id/resolve/reject`

```bash
curl -X PATCH http://localhost:3000/api/disputes/dispute_002/resolve/reject \
  -H "Authorization: Bearer admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Evidence does not support claim. No adjustment made."
  }'
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_002",
      "status": "rejected",
      "resolution": {
        "action": "rejected",
        "resolvedBy": "admin001",
        "resolvedAt": "2025-01-01T11:00:00Z"
      }
    }
  }
}
```

**Validation**:

- ✅ Status changed to "rejected"
- ✅ Wallet unchanged
- ✅ No transaction created

---

### Test 3.2: Manual Adjustment (Custom Amount)

**Endpoint**: `PATCH /api/disputes/:id/resolve/approve`

```bash
curl -X PATCH http://localhost:3000/api/disputes/dispute_003/resolve/approve \
  -H "Authorization: Bearer admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustmentAmount": 1500,
    "note": "Partial goodwill adjustment approved"
  }'
```

**Expected Response** (200):

```json
{
  "success": true,
  "data": {
    "dispute": {
      "_id": "dispute_003",
      "status": "resolved",
      "resolution": {
        "action": "manual_adjustment",
        "actionDetails": { "amount": 1500 }
      },
      "recalculation": {
        "newAmount": 1500,
        "transactionId": "txn_adjustment_003"
      }
    }
  }
}
```

**Validation**:

- ✅ Custom amount applied (not auto recalc)
- ✅ Adjustment transaction created
- ✅ Wallet credited with 1500

---

### Test 3.3: Negative Adjustment with Withdrawal

**Scenario**: Host earned 20000, withdrew 15000, now disputed

```javascript
// Setup
wallet: {
  totalUcoins: 20000,
  withdrawableUcoins: 5000,   // 20000 - 15000 withdrawn
  lockedUcoins: 15000
}

// Dispute: reduce by 8000
// Expected deduction: 5000 from withdrawable + 3000 from locked
```

**After Resolution**:

```javascript
wallet: {
  totalUcoins: 12000,
  withdrawableUcoins: 0,      // Used entirely
  lockedUcoins: 12000         // Reduced by 3000
}
```

**Validation**:

- ✅ Smart deduction: withdrawable first
- ✅ Then locked
- ✅ Full audit trail

---

### Test 3.4: Large Negative Adjustment (Negative Balance)

**Scenario**: Fraud detected, reverse entire 20000 salary

```javascript
// Setup
wallet: {
  totalUcoins: 20000,
  withdrawableUcoins: 8000,
  lockedUcoins: 12000
}

// Adjustment: -20000
// Deduction: 8000 from withdrawable + 12000 from locked
```

**After Resolution**:

```javascript
wallet: {
  totalUcoins: 0,
  withdrawableUcoins: 0,
  lockedUcoins: 0  // Negative? NO, it becomes 0
}

// But what if user had negative locked?
// Future earnings are held until offset
```

**Validation**:

- ✅ No negative wallet balance errors
- ✅ Both withdrawn + locked deducted
- ✅ Future earnings blocked until offset

---

## Test Suite 4: Commission Disputes

### Test 4.1: Agency Disputes Commission

```bash
# Agency raises dispute on commission
curl -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer agency_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "commission",
    "referenceId": "commission_cycle_001",
    "reason": "Commission calculation appears incorrect for last month",
    "evidence": ["salary_cycle_breakdown.csv"]
  }'
```

**Expected**: Dispute created with type "commission"

### Test 4.2: Simulate Commission Recalculation

```bash
curl "http://localhost:3000/api/disputes/dispute_commission_001/simulate-recalculation" \
  -H "Authorization: Bearer admin_token_here"
```

**Expected**: Shows recalculated commission based on contributing host cycles

---

## Test Suite 5: Authorization & Security

### Test 5.1: User Can't Access Other's Disputes

```bash
# Host1 tries to access Host2's dispute
curl http://localhost:3000/api/disputes/dispute_002 \
  -H "Authorization: Bearer host001_token"
```

**Expected Response** (403):

```json
{
  "success": false,
  "error": "Not authorized to view this dispute"
}
```

**Validation**:

- ✅ Cross-user access denied
- ✅ Clear error message

---

### Test 5.2: Non-Admin Can't Access Admin Endpoints

```bash
# Regular user tries admin endpoint
curl "http://localhost:3000/api/disputes/admin/all" \
  -H "Authorization: Bearer host_token_here"
```

**Expected Response** (403):

```json
{
  "success": false,
  "error": "Admin access required"
}
```

**Validation**:

- ✅ Non-admin blocked
- ✅ Endpoint not accessible

---

### Test 5.3: Unauthenticated Request Blocked

```bash
curl http://localhost:3000/api/disputes/my
```

**Expected Response** (401):

```json
{
  "success": false,
  "error": "Authentication required"
}
```

**Validation**:

- ✅ No token returns 401
- ✅ Invalid token returns 401

---

## Test Suite 6: Error Handling

### Test 6.1: Invalid Dispute Type

```bash
curl -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer host_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invalid_type",
    "referenceId": "cycle_001",
    "reason": "Test"
  }'
```

**Expected Response** (400):

```json
{
  "success": false,
  "error": "Invalid dispute type. Must be: salary, commission, or withdrawal"
}
```

---

### Test 6.2: Reference Not Found

```bash
curl -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer host_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "salary",
    "referenceId": "nonexistent_cycle",
    "reason": "Test"
  }'
```

**Expected Response** (404):

```json
{
  "success": false,
  "error": "Salary cycle not found"
}
```

---

### Test 6.3: Duplicate Dispute

```bash
# Create dispute
POST /api/disputes (success)

# Try to create again on same reference
POST /api/disputes (same referenceId)
```

**Expected Response** (400):

```json
{
  "success": false,
  "error": "Open or pending dispute already exists for this reference"
}
```

---

## Automated Test Script

```javascript
// tests/dispute.test.js
const request = require("supertest");
const app = require("../app");

describe("Dispute System", () => {
  let hostToken, adminToken, disputeId, cycleId;

  before(async () => {
    // Setup: Create users and salary cycle
    hostToken = "host_token_...";
    adminToken = "admin_token_...";
    cycleId = "cycle_001";
  });

  describe("User Disputes", () => {
    it("should raise salary dispute", async () => {
      const res = await request(app)
        .post("/api/disputes")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({
          type: "salary",
          referenceId: cycleId,
          reason: "Hours incorrect",
          evidence: ["proof.png"],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.dispute.status).toBe("open");
      disputeId = res.body.data.dispute._id;
    });

    it("should get my disputes", async () => {
      const res = await request(app)
        .get("/api/disputes/my")
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.disputes).toHaveLength(1);
    });

    it("should get dispute details", async () => {
      const res = await request(app)
        .get(`/api/disputes/${disputeId}`)
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.dispute.status).toBe("open");
    });
  });

  describe("Admin Review", () => {
    it("should simulate recalculation", async () => {
      const res = await request(app)
        .get(`/api/disputes/${disputeId}/simulate-recalculation`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.simulation).toHaveProperty("oldAmount");
      expect(res.body.data.simulation).toHaveProperty("newAmount");
    });

    it("should resolve with recalculation", async () => {
      const res = await request(app)
        .patch(`/api/disputes/${disputeId}/resolve/recalculate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ note: "Verified and recalculated" });

      expect(res.status).toBe(200);
      expect(res.body.data.dispute.status).toBe("resolved");
    });
  });

  describe("Security", () => {
    it("should deny non-admin access to admin endpoints", async () => {
      const res = await request(app)
        .get("/api/disputes/admin/all")
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.status).toBe(403);
    });

    it("should deny unauthenticated access", async () => {
      const res = await request(app).get("/api/disputes/my");

      expect(res.status).toBe(401);
    });
  });
});
```

---

## Performance Testing

### Load Test: 100 Concurrent Disputes

```bash
# Using Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/disputes/my
```

**Expected**:

- Response time: < 200ms
- Success rate: 100%
- No timeouts

### Load Test: Recalculation

```bash
# Simulate 100 concurrent recalculations
for i in {1..100}; do
  curl -X GET \
    "http://localhost:3000/api/disputes/dispute_$i/simulate-recalculation" \
    -H "Authorization: Bearer $TOKEN" &
done
```

**Expected**:

- All complete successfully
- No database connection errors
- Response time: < 500ms per request

---

## Integration Checklist

- [ ] Dispute model indexes created
- [ ] Transaction types extended
- [ ] Recalculation service tested
- [ ] Wallet adjustment tested
- [ ] Routes registered in app.js
- [ ] All tests passing
- [ ] Error handling verified
- [ ] Authorization working
- [ ] Audit logs complete
- [ ] Withdrawal API integration check needed ⭐

---

## Production Deployment

1. **Pre-deployment**:

   - [ ] All tests passing
   - [ ] Database migrations applied
   - [ ] Indexes created for performance
   - [ ] Backup existing data

2. **Deployment**:

   - [ ] Deploy new models
   - [ ] Deploy new services
   - [ ] Deploy new controllers/routes
   - [ ] Restart Node.js server

3. **Post-deployment**:

   - [ ] Monitor dispute creation rate
   - [ ] Check recalculation accuracy
   - [ ] Verify wallet adjustments
   - [ ] Review error logs
   - [ ] Confirm audit trail complete

4. **Integration Tasks**:
   - [ ] Add dispute check to withdrawal API ⭐ CRITICAL
   - [ ] Integrate notification system
   - [ ] Add to dashboard
   - [ ] Create admin UI for dispute management

---

## Success Metrics

After 1 week:

- **Disputes created**: 10+ (should have some)
- **Average resolution time**: < 2 days
- **User satisfaction**: Positive feedback on clarity
- **Zero manual adjustments needed**: All automated correctly

If not met:

- Review logs for failures
- Check calculation accuracy
- Verify wallet adjustments
- Analyze admin workflows

---

**Next Step**: STEP 5 (Monitoring & Alerts)
