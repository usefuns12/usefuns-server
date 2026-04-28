# STEP 4 Integration Checklist & Next Steps

## Critical Integration Tasks

### ⭐ TASK 1: Withdrawal Prevention (CRITICAL)

**Why**: Hosts should NOT be able to withdraw salary from a disputed cycle

**File**: `controllers/wallet.controller.js` or `services/wallet.service.js`

**Code to Add** (in withdrawal validation):

```javascript
async function validateWithdrawalEligibility(userId, cycleId, amount) {
  // Check for active disputes on this cycle
  const activeDispute = await Dispute.findOne({
    referenceId: cycleId,
    raisedBy: userId,
    status: { $in: ["open", "under_review"] },
  });

  if (activeDispute) {
    throw new Error(
      `Cannot withdraw - dispute pending on this cycle. 
       Dispute ID: ${activeDispute._id}, 
       Status: ${activeDispute.status}`
    );
  }

  // Continue with normal validation...
}
```

**Locations to Update**:

1. `/api/wallet/withdraw` endpoint
2. Any batch withdrawal logic
3. Payout calculations (if auto-paying)

**Testing**:

- [ ] Create dispute on cycle
- [ ] Try to withdraw → should fail with clear message
- [ ] Resolve dispute
- [ ] Retry withdraw → should succeed

---

### TASK 2: Notification System Integration

**Why**: Users should be notified when disputes are resolved

**File**: `services/notification.service.js`

**Code to Add**:

```javascript
async function notifyDisputeResolved(dispute) {
  const user = await User.findById(dispute.raisedBy);

  let message, title;

  if (dispute.resolution.action === "recalculate") {
    const adjustment = dispute.recalculation.difference;
    const symbol = adjustment >= 0 ? "+" : "";
    title = "Dispute Resolved - Salary Adjusted";
    message = `Your dispute has been resolved. 
      Your salary has been adjusted by ${symbol}${adjustment} U-coins.
      New balance: ${user.wallet.totalUcoins}`;
  } else if (dispute.resolution.action === "rejected") {
    title = "Dispute Rejected";
    message = `Your dispute has been reviewed and rejected. 
      Reason: ${dispute.resolution.note || "No sufficient evidence"}`;
  } else if (dispute.resolution.action === "manual_adjustment") {
    const amount = dispute.resolution.actionDetails.amount;
    title = "Dispute Approved - Manual Adjustment";
    message = `Your dispute has been approved. 
      You have been credited ${amount} U-coins.`;
  }

  // Send in-app notification
  await Notification.create({
    userId: dispute.raisedBy,
    type: "dispute_resolved",
    title,
    message,
    link: `/disputes/${dispute._id}`,
    read: false,
  });

  // Send push notification (if available)
  if (user.deviceTokens && user.deviceTokens.length > 0) {
    await sendPushNotification(user.deviceTokens, {
      title,
      body: message,
      data: { disputeId: dispute._id.toString() },
    });
  }
}
```

**Where to Call**:

```javascript
// In dispute.controller.js after resolving
await notifyDisputeResolved(dispute);
```

---

### TASK 3: Dashboard Integration

**Why**: Users need visibility into their disputes and adjustments

**Files**: Dashboard components (Angular)

**What to Show**:

1. **Pending Disputes Widget**:

   - Count of open disputes
   - Status of each (open, under_review, resolved)
   - Link to dispute details

2. **Recent Adjustments Widget**:

   - Last 5 adjustments made to wallet
   - Amount, date, reason
   - Link to related dispute

3. **Disputes Page**:
   - List of all disputes (user's own)
   - Filter by status
   - Show details modal
   - Ability to raise new dispute

**API Endpoints Needed**:

```javascript
// Already created
GET /api/disputes/my                    // List my disputes
GET /api/disputes/:id                   // Get details
POST /api/disputes                      // Raise dispute

// Additional helper endpoints
GET /api/disputes/my/pending            // Only open/under_review
GET /api/disputes/my/stats              // { total, open, resolved, rejected }
GET /api/wallet/adjustments             // Last N adjustments
```

---

### TASK 4: Admin Dashboard Integration

**Why**: Admins need UI to manage disputes

**Files**: Admin dashboard components

**What to Show**:

1. **Disputes Queue**:

   - All open disputes
   - Sorted by: newest, oldest, amount (high to low)
   - Quick filter: open, under_review, resolved
   - Search by user/type/reason

2. **Dispute Details Modal**:

   - Show evidence
   - Audit log
   - Previous adjustments to same user
   - Quick action buttons:
     - "Review"
     - "Simulate Recalc"
     - "Approve Recalc"
     - "Reject"
     - "Manual Amount"

3. **Approval Workflow**:

   ```
   Evidence → Simulate → Approve → Auto Adjustment → Notification
   ```

4. **Reporting**:
   - Disputes by host
   - Disputes by agency
   - Common dispute reasons
   - Resolution rate by admin

---

### TASK 5: Update Withdrawal API

**File**: `routes/wallet.routes.js` or wherever withdrawal is handled

**Check**: Does withdrawal API use cycleId?

```javascript
// If yes, add dispute check:
router.post("/withdraw", authenticate, async (req, res) => {
  try {
    const { amount, cycleId } = req.body;

    // NEW: Check for disputes
    if (cycleId) {
      const dispute = await Dispute.findOne({
        referenceId: cycleId,
        raisedBy: req.user._id,
        status: { $in: ["open", "under_review"] },
      });

      if (dispute) {
        return res.status(400).json({
          success: false,
          error: "Cannot withdraw from disputed cycle",
          disputeId: dispute._id,
        });
      }
    }

    // Continue with normal withdrawal...
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

---

### TASK 6: Update Payout Logic

**If**: Auto-payout exists (automatic salary disbursement)

**Check**: `controllers/admin.salary.controller.js` or scheduler

**Add**: Dispute validation before payout

```javascript
async function processMonthlyPayout() {
  const cycles = await HostSalaryCycle.find({
    payoutDate: { $lte: new Date() },
    payoutStatus: "pending",
  });

  for (const cycle of cycles) {
    // Check for disputes
    const dispute = await Dispute.findOne({
      referenceId: cycle._id,
      status: { $in: ["open", "under_review"] },
    });

    if (dispute) {
      // Hold payout
      cycle.payoutStatus = "held";
      cycle.payoutReason = `Dispute in progress: ${dispute._id}`;
      await cycle.save();

      // Notify admin
      console.log(`Payout held for cycle ${cycle._id} due to dispute`);
      continue;
    }

    // Process payout
    await processPayoutForCycle(cycle);
  }
}
```

---

## Optional Enhancements (Phase 2)

### Enhancement 1: Dispute Analytics

**Dashboard Metrics**:

- Total disputes created
- Resolution rate (%)
- Average resolution time
- Common reasons
- Adjustment distribution

```javascript
async function getDisputeAnalytics(startDate, endDate) {
  const disputes = await Dispute.find({
    createdAt: { $gte: startDate, $lte: endDate },
  });

  const stats = {
    total: disputes.length,
    byType: {
      salary: disputes.filter((d) => d.type === "salary").length,
      commission: disputes.filter((d) => d.type === "commission").length,
      withdrawal: disputes.filter((d) => d.type === "withdrawal").length,
    },
    byStatus: {
      open: disputes.filter((d) => d.status === "open").length,
      under_review: disputes.filter((d) => d.status === "under_review").length,
      resolved: disputes.filter((d) => d.status === "resolved").length,
      rejected: disputes.filter((d) => d.status === "rejected").length,
    },
    totalAdjusted: disputes.reduce(
      (sum, d) => sum + (d.recalculation?.difference || 0),
      0
    ),
    avgResolutionTime: calculateAvg(
      disputes
        .filter((d) => d.resolution?.resolvedAt)
        .map((d) => d.resolution.resolvedAt - d.createdAt)
    ),
  };

  return stats;
}
```

---

### Enhancement 2: Dispute Escalation

**Auto-escalate if**:

- Unresolved for 7 days → Mark as "escalated"
- Amount > 10000 U-coins → Notify senior admin
- Same user disputes > 3 times → Flag for review

```javascript
async function escalateAgedDisputes() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const agedDisputes = await Dispute.find({
    status: { $in: ["open", "under_review"] },
    createdAt: { $lt: sevenDaysAgo },
  });

  for (const dispute of agedDisputes) {
    dispute.escalated = true;
    dispute.escalatedAt = new Date();
    await dispute.save();

    // Notify senior admin
    await notificationService.send(
      "senior_admin_group",
      `Dispute escalated: 7 days unresolved. ID: ${dispute._id}`
    );
  }
}

// Schedule this cron job
cron.schedule("0 0 * * *", escalateAgedDisputes); // Daily at midnight
```

---

### Enhancement 3: Dispute Categories

**Add to Dispute Model**:

```javascript
category: {
  type: String,
  enum: [
    'calculation_error',
    'missing_hours',
    'incorrect_diamonds',
    'policy_change',
    'system_error',
    'fraud_suspicion',
    'other'
  ]
}

reason_details: {
  hoursDiscrepancy: Number,    // If missing hours
  diamondDiscrepancy: Number,  // If incorrect diamonds
  suspectedError: String,      // If calculation error
  description: String
}
```

---

## Deployment Checklist

### Before Deploying

- [ ] All database migrations applied
- [ ] Dispute model indexes created
- [ ] Transaction model updated
- [ ] Withdrawal API updated with dispute check
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Code reviewed

### Database Migrations

```javascript
// Create indexes
db.disputes.createIndex({ status: 1, createdAt: -1 });
db.disputes.createIndex({ raisedBy: 1 });
db.disputes.createIndex({ type: 1, referenceId: 1 });

db.transactions.createIndex({ adjustmentRef: 1 });
db.transactions.createIndex({ originalTransactionId: 1 });
```

### Deployment Steps

1. **Backup**:

   ```bash
   # Backup MongoDB
   mongodump --out ./backup/$(date +%Y%m%d)
   ```

2. **Deploy Code**:

   ```bash
   git pull origin main
   npm install
   npm run build
   ```

3. **Migrate Database**:

   ```bash
   npm run migrate
   ```

4. **Restart Services**:

   ```bash
   pm2 restart app
   ```

5. **Verify**:
   - [ ] API endpoints responding
   - [ ] Dispute creation working
   - [ ] Withdrawal prevention working
   - [ ] Logs showing no errors

---

## Monitoring & Alerts

### Key Metrics

```javascript
// Monitor these in production
metrics: {
  disputes_created_per_day: gauge,
  dispute_avg_resolution_time: gauge,
  adjustments_applied: counter,
  wallet_adjustments_failed: counter,
  recalculation_errors: counter
}
```

### Error Handling

```javascript
// Log any issues to monitoring service
try {
  await applyAdjustment(...);
} catch (err) {
  logger.error('Dispute adjustment failed', {
    disputeId,
    error: err.message,
    severity: 'high'
  });

  // Alert admin
  await alertService.send('dispute_adjustment_failed', {
    disputeId,
    errorMessage: err.message
  });
}
```

---

## Timeline

### Immediate (Today)

- ✅ STEP 4 backend complete
- [ ] Review code quality
- [ ] Run full test suite
- [ ] Integration tests
- [ ] Documentation review

### Week 1

- [ ] Integrate with withdrawal API
- [ ] Integrate notifications
- [ ] Admin dashboard UI
- [ ] User dashboard UI
- [ ] QA testing

### Week 2

- [ ] Performance testing
- [ ] Load testing
- [ ] Security audit
- [ ] User acceptance testing

### Week 3

- [ ] Deploy to staging
- [ ] Final QA
- [ ] Deploy to production
- [ ] Monitor for issues

---

## Risk Assessment

### High Risk Items

1. **Withdrawal Prevention Logic**:

   - Risk: Users can't withdraw due to bugs
   - Mitigation: Thorough testing, easy bypass for admin
   - Rollback: Remove dispute check temporarily

2. **Recalculation Accuracy**:

   - Risk: Wrong calculations hurt users
   - Mitigation: Simulation + admin review before applying
   - Rollback: Manual review of recent adjustments

3. **Wallet Adjustments**:
   - Risk: Negative balances or lost funds
   - Mitigation: MongoDB sessions, validation checks
   - Rollback: Audit trail allows reversal

### Medium Risk Items

1. **Notification System**: Not critical, can disable if broken
2. **Admin Dashboard**: Can use API directly if UI breaks
3. **Performance**: May slow down during heavy dispute load

### Low Risk Items

1. **Dispute Creation**: Non-critical, users can email support
2. **Dispute Listing**: Informational only

---

## Success Criteria

After STEP 4 Deployment:

1. **Functional**:

   - [ ] Users can raise disputes
   - [ ] Admins can review and resolve
   - [ ] Wallet adjustments apply correctly
   - [ ] Audit trail complete

2. **Performance**:

   - [ ] API responses < 200ms
   - [ ] Database queries optimized
   - [ ] No N+1 queries

3. **Quality**:

   - [ ] Zero data loss
   - [ ] All tests passing
   - [ ] Error handling works
   - [ ] Edge cases handled

4. **User Experience**:
   - [ ] Clear error messages
   - [ ] Notification system works
   - [ ] Dashboard intuitive
   - [ ] User feedback positive

---

## Next Steps

### Recommended Path Forward

**Option A** (Fraud Prevention First):

1. STEP 5: Monitoring & Alerts (1 week)
2. STEP 6: Fraud & Abuse Protection (1.5 weeks)
3. Then: Dashboard, Performance

**Option B** (User Experience First):

1. Admin Dashboard (1 week)
2. User Dashboard (1 week)
3. STEP 5: Monitoring (1 week)
4. STEP 6: Fraud (1.5 weeks)

**Option C** (Balanced):

1. Admin/User Dashboard (1.5 weeks)
2. STEP 5: Monitoring (1 week)
3. STEP 6: Fraud (1.5 weeks)

---

## STEP 4 Summary

✅ **Complete**:

- Dispute model with full schema
- User APIs (3 endpoints)
- Admin APIs (6 endpoints)
- Recalculation engine (safe, uses snapshot)
- Wallet adjustment logic (lock-aware)
- Transaction tracking (adjustment types)
- Comprehensive documentation
- Testing guide

⏳ **Pending**:

- Withdrawal API integration
- Notification system integration
- Admin dashboard UI
- User dashboard UI
- Performance tuning
- Production deployment

---

## Rollback Plan

If deployment fails:

```bash
# Step 1: Stop server
pm2 stop app

# Step 2: Revert code
git revert HEAD

# Step 3: Restart server
pm2 start app

# Step 4: Verify
curl http://localhost:3000/health

# Step 5: Notify team
# "Rolled back due to [issue]"
```

---

**Ready for STEP 5: Monitoring & Alerts?**

STEP 5 will add:

1. Zero salary detection (2+ cycles)
2. Commission drop alerts
3. Gift spike detection
4. Multi-device host detection
5. Cron failure monitoring
6. Admin notification system
7. Alert tracking & analytics

Let's build those safeguards next! 🚀
