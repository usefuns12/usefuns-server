# STEP 4 Developer's Quick Start

## Getting Started in 5 Minutes

### 1. Understand the Flow (2 min)

```
User Raises Dispute
    ↓
Admin Reviews + Simulates
    ↓
Admin Resolves (3 options: recalc, reject, manual)
    ↓
Wallet Updated Automatically
    ↓
User Notified
```

### 2. Test It (3 min)

```bash
# 1. Create dispute
curl -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "salary",
    "referenceId": "cycle_001",
    "reason": "Hours incorrect",
    "evidence": ["proof.png"]
  }'
# Save the disputeId from response

# 2. Simulate recalculation (as admin)
curl http://localhost:3000/api/disputes/{disputeId}/simulate-recalculation \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Resolve with recalculation
curl -X PATCH http://localhost:3000/api/disputes/{disputeId}/resolve/recalculate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "note": "Recalculated" }'
```

---

## File Location Guide

### Models

```
models/
├── Dispute.js ......................... NEW - Dispute schema
└── Transaction.js ................... MODIFIED - Added adjustment types
```

### Services

```
services/
├── recalculation.service.js ......... NEW - Safe recalculation
└── walletAdjustment.service.js ....... NEW - Wallet updates
```

### Controllers & Routes

```
controllers/
└── dispute.controller.js ............ NEW - 11 endpoints

routes/
└── dispute.routes.js ................ NEW - Route definitions

app.js ............................... MODIFIED - Registered routes
```

---

## API Quick Reference

### User: Create Dispute

```javascript
// POST /api/disputes
const dispute = {
  type: "salary", // Or "commission", "withdrawal"
  referenceId: "cycle_123", // ObjectId of disputed cycle
  reason: "Calculation error",
  evidence: ["url1", "url2"],
};
```

### User: Get My Disputes

```javascript
// GET /api/disputes/my?status=open&page=1
// Response: { disputes: [...], pagination: {...} }
```

### Admin: List All

```javascript
// GET /api/disputes/admin/all?status=under_review
// Response: { disputes: [...] }
```

### Admin: Simulate (DRY RUN)

```javascript
// GET /api/disputes/{id}/simulate-recalculation
// Response: { simulation: { oldAmount, newAmount, difference, ... } }
// NO SIDE EFFECTS - Just preview!
```

### Admin: Resolve

```javascript
// Option 1: Auto recalculate
PATCH /api/disputes/{id}/resolve/recalculate
{ "note": "Verified and recalculated" }

// Option 2: Manual amount
PATCH /api/disputes/{id}/resolve/approve
{ "adjustmentAmount": 2000, "note": "Goodwill adjustment" }

// Option 3: Reject
PATCH /api/disputes/{id}/resolve/reject
{ "note": "No evidence found" }
```

---

## Code Organization

### dispute.controller.js (400+ lines)

**User Functions**:

```javascript
exports.raiseDispute = async (req, res) => { ... }
exports.getMyDisputes = async (req, res) => { ... }
exports.getDisputeDetails = async (req, res) => { ... }
```

**Admin Functions**:

```javascript
exports.listDisputesAdmin = async (req, res) => { ... }
exports.reviewDispute = async (req, res) => { ... }
exports.simulateRecalculationAdmin = async (req, res) => { ... }
exports.resolveWithRecalculation = async (req, res) => { ... }
exports.rejectDispute = async (req, res) => { ... }
exports.approveDisputeAdjustment = async (req, res) => { ... }
```

### recalculation.service.js (140 lines)

```javascript
// Safe recalculation using policySnapshot
async recalculateSalaryFromDispute(cycleId, reason) {
  // 1. Get cycle with policySnapshot (never changes)
  // 2. Recalculate using same policy
  // 3. Return: { oldAmount, newAmount, difference, policyUsed }
}

async simulateRecalculation(type, referenceId) {
  // Dry run - no side effects
}
```

### walletAdjustment.service.js (220 lines)

```javascript
// Smart wallet adjustments
async applySalaryAdjustment(userId, amount, reason, disputeId) {
  // Smart deduction: withdrawable first, then locked
  // Creates transaction (never deletes)
  // Uses MongoDB session for atomicity
}

async reverseWithdrawal(withdrawalTxnId, reason, disputeId) {
  // Reverse withdrawal, credit back to wallet
}
```

---

## Common Tasks

### Task 1: Check Dispute Status

```javascript
// In controller or service
const dispute = await Dispute.findById(disputeId)
  .populate("raisedBy", "email name")
  .populate("resolution.resolvedBy", "email");

console.log(`Status: ${dispute.status}`);
console.log(`Raised by: ${dispute.raisedBy.email}`);
```

### Task 2: Get Wallet Impact

```javascript
// After resolution
const txn = await Transaction.findById(dispute.recalculation.transactionId);

console.log(`Amount adjusted: ${txn.amount}`);
console.log(`Old balance: ${txn.meta.oldBalance}`);
console.log(`New balance: ${txn.meta.newBalance}`);
```

### Task 3: Audit Trail

```javascript
// See all actions on dispute
const dispute = await Dispute.findById(disputeId);
dispute.auditLog.forEach((entry) => {
  console.log(`${entry.timestamp} - ${entry.action} by admin`);
  console.log(`  Note: ${entry.note}`);
});
```

### Task 4: Find Disputes for User

```javascript
// Get all disputes for a specific user
const disputes = await Dispute.find({
  raisedBy: userId,
  status: { $ne: "rejected" }, // Exclude rejected
})
  .sort({ createdAt: -1 })
  .limit(10);
```

---

## Database Queries

### Find Unresolved Disputes

```javascript
db.disputes.find({
  status: { $in: ["open", "under_review"] },
});
```

### Find Disputes by Amount

```javascript
db.disputes
  .find({
    impactAmount: { $gt: 5000 },
  })
  .sort({ impactAmount: -1 });
```

### Find Adjustments Made

```javascript
db.transactions
  .find({
    type: { $in: ["salaryAdjustment", "commissionAdjustment"] },
  })
  .sort({ createdAt: -1 });
```

### Get Audit Trail for Dispute

```javascript
db.disputes.aggregate([
  { $match: { _id: ObjectId("...") } },
  { $unwind: "$auditLog" },
  { $sort: { "auditLog.timestamp": -1 } },
]);
```

---

## Error Handling

### Common Errors & Solutions

**Error**: "Dispute already exists"

```javascript
// User tried to create duplicate dispute
// Solution: Check if open dispute exists first
const existing = await Dispute.findOne({
  referenceId,
  raisedBy: userId,
  status: { $ne: "rejected" },
});
```

**Error**: "Cannot find salary cycle"

```javascript
// Reference doesn't exist
// Solution: Validate referenceId before creating dispute
const cycle = await HostSalaryCycle.findById(referenceId);
if (!cycle) throw new Error("Cycle not found");
```

**Error**: "Wallet adjustment failed"

```javascript
// Balance issue or DB error
// Solution: Check wallet balance, use MongoDB session
const wallet = await Wallet.findById(userId);
if (wallet.withdrawableUcoins < amount) {
  // Handle insufficient balance
}
```

---

## Testing Commands

### Test User Dispute

```bash
# Create test user
USER_ID="test_host_001"
USER_TOKEN="eyJhbGc..." # Valid JWT

# Create salary cycle first
CYCLE_ID="cycle_001"

# Raise dispute
DISPUTE_ID=$(curl -s -X POST http://localhost:3000/api/disputes \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"salary\",\"referenceId\":\"$CYCLE_ID\",\"reason\":\"Test\",\"evidence\":[]}" \
  | jq -r '.data.dispute._id')

echo "Created dispute: $DISPUTE_ID"

# Get dispute details
curl http://localhost:3000/api/disputes/$DISPUTE_ID \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Test Admin Workflow

```bash
# Test as admin
ADMIN_TOKEN="eyJhbGc..." # Admin JWT

# Get all disputes
curl http://localhost:3000/api/disputes/admin/all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Simulate recalculation
curl http://localhost:3000/api/disputes/$DISPUTE_ID/simulate-recalculation \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Resolve
curl -X PATCH http://localhost:3000/api/disputes/$DISPUTE_ID/resolve/recalculate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Verified"}'
```

---

## Debugging Tips

### Enable Logging

```javascript
// In services/recalculation.service.js
console.log("Calculating salary...", { cycleId, oldAmount, newAmount });

// In services/walletAdjustment.service.js
console.log("Adjusting wallet...", { userId, amount, before, after });

// In dispute.controller.js
console.log("Resolving dispute...", { disputeId, action });
```

### Check Database State

```javascript
// In MongoDB shell
// See all disputes
db.disputes.find().pretty();

// See adjustment transactions
db.transactions.find({ type: "salaryAdjustment" }).pretty();

// See wallet state
db.wallets.find({ _id: "user_001" }).pretty();

// See dispute audit trail
db.disputes.findOne({ _id: ObjectId("...") }).auditLog;
```

### Verify Audit Trail

```javascript
// Get full dispute history
const dispute = await Dispute.findById(disputeId);
console.log(JSON.stringify(dispute.auditLog, null, 2));

// Should show:
// - created (by user)
// - reviewed (by admin)
// - resolved (by admin with action)
```

---

## Performance Tips

### Query Optimization

```javascript
// Good - Uses index
Dispute.find({ status: "open", createdAt: -1 });

// Bad - No index on raisedBy + createdAt
Dispute.find({ raisedBy, createdAt: -1 });
// Add: db.disputes.createIndex({ raisedBy: 1, createdAt: -1 })
```

### Bulk Operations

```javascript
// Instead of looping, use bulk
const ops = disputes.map((d) => ({
  updateOne: {
    filter: { _id: d._id },
    update: { $set: { status: "under_review" } },
  },
}));
await Dispute.collection.bulkWrite(ops);
```

### Pagination

```javascript
// Always use pagination for large result sets
const page = req.query.page || 1;
const limit = 20;
const skip = (page - 1) * limit;

const disputes = await Dispute.find(query)
  .skip(skip)
  .limit(limit)
  .sort({ createdAt: -1 });
```

---

## Deployment Checklist

### Before Deploy

- [ ] All code committed
- [ ] Tests passing
- [ ] No console.log() left
- [ ] Error handling complete
- [ ] Documentation updated

### During Deploy

```bash
# 1. Create indexes
db.disputes.createIndex({ status: 1, createdAt: -1 })
db.disputes.createIndex({ raisedBy: 1 })

# 2. Backup
mongodump --out backup

# 3. Deploy code
git pull
npm install
npm run build

# 4. Restart
pm2 restart app
```

### After Deploy

- [ ] Test all endpoints
- [ ] Check error logs
- [ ] Verify database state
- [ ] Monitor metrics
- [ ] Wait 1 hour before next deploy

---

## Integration Reminders

### ⭐ CRITICAL: Withdrawal Prevention

```javascript
// Add this to withdrawal endpoint BEFORE deploying!
const dispute = await Dispute.findOne({
  referenceId: cycleId,
  status: { $in: ["open", "under_review"] },
});

if (dispute) {
  throw new Error("Cannot withdraw - dispute pending");
}
```

### Integration TODOs

- [ ] Add dispute check to withdrawal API
- [ ] Add notification system integration
- [ ] Add dashboard UI
- [ ] Add payout logic check

See `STEP-4-INTEGRATION-CHECKLIST.md` for full details.

---

## Resources

### Documentation Files

1. **STEP-4-DISPUTE-SYSTEM.md** - Full system design
2. **STEP-4-TESTING-GUIDE.md** - Test scenarios
3. **STEP-4-INTEGRATION-CHECKLIST.md** - Integration tasks
4. **STEP-4-IMPLEMENTATION-SUMMARY.md** - What was built

### Code Files

1. `models/Dispute.js` - Data model
2. `services/recalculation.service.js` - Recalculation logic
3. `services/walletAdjustment.service.js` - Wallet updates
4. `controllers/dispute.controller.js` - API handlers
5. `routes/dispute.routes.js` - Route definitions

---

## Quick Reference: Key Files

### To understand the data model

→ `models/Dispute.js`

### To understand how recalculation works

→ `services/recalculation.service.js`

### To understand wallet adjustments

→ `services/walletAdjustment.service.js`

### To see all API endpoints

→ `controllers/dispute.controller.js`

### To see route definitions

→ `routes/dispute.routes.js`

### To see full API examples

→ `docs/STEP-4-DISPUTE-SYSTEM.md`

---

## Next Steps

1. **Integrate**: Add withdrawal prevention (CRITICAL!)
2. **Test**: Run full test suite
3. **Deploy**: To staging environment
4. **QA**: Verify all functionality
5. **Monitor**: Track metrics
6. **Enhance**: Add Phase 2 features

---

**You're all set! Happy coding! 🚀**

Questions? Check the full documentation:

- System design → STEP-4-DISPUTE-SYSTEM.md
- Testing guide → STEP-4-TESTING-GUIDE.md
- Integration → STEP-4-INTEGRATION-CHECKLIST.md
