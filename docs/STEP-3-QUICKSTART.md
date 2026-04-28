# 🚀 STEP 3 Quick Start Guide

## TL;DR

**Before STEP 3:**

```javascript
// Host gets paid → can withdraw immediately → fraud detected → money gone 💸
wallet.ucoins += salary;
```

**After STEP 3:**

```javascript
// Host gets paid → funds locked 3 days → fraud detection window ✅
wallet.lockedUcoins += salary; // 🔒 LOCKED
// ... 3 days later ...
wallet.withdrawableUcoins += salary; // 🔓 UNLOCKED
```

---

## What You Need to Know

### For Backend Developers

**1. Wallet Structure Changed:**

```javascript
// OLD
{ ucoins: 20000 }

// NEW
{
  ucoins: 20000,              // Total (backward compatible)
  lockedUcoins: 12000,        // Cannot withdraw
  withdrawableUcoins: 8000    // Can withdraw
}
```

**2. Always Check Withdrawable Balance:**

```javascript
// ❌ WRONG
if (wallet.ucoins >= amount) {
  /* withdraw */
}

// ✅ CORRECT
if (wallet.withdrawableUcoins >= amount) {
  /* withdraw */
}
```

**3. Use Helper Function:**

```javascript
const { checkWithdrawalEligibility } = require("./utils/withdrawalEligibility");

const result = await checkWithdrawalEligibility(userId, 10000);
if (!result.eligible) {
  return res.status(400).json({ error: result.reason });
}
```

---

### For Frontend Developers

**Update Wallet Display:**

```jsx
// Show split balance
<div>
  <div>Total: {wallet.ucoins} U-coins</div>
  <div>Available: {wallet.withdrawableUcoins} U-coins ✅</div>
  <div>Locked: {wallet.lockedUcoins} U-coins 🔒</div>
  {wallet.lockedUcoins > 0 && <small>Unlocks: {nextUnlockDate}</small>}
</div>
```

**Withdrawal Form:**

```jsx
<input
  type="number"
  max={wallet.withdrawableUcoins} // ← Use withdrawable, not total
  placeholder={`Max: ${wallet.withdrawableUcoins}`}
/>;
{
  wallet.lockedUcoins > 0 && (
    <p>
      💡 {wallet.lockedUcoins} U-coins locked until {date}
    </p>
  );
}
```

---

### For Product/Support Team

**When User Asks: "Why can't I withdraw?"**

**Answer:**

> "Your recent salary of X U-coins is locked for 3 days as a security measure. This protects both you and the platform from fraud and chargebacks. Your funds will be automatically unlocked on [DATE] and available for withdrawal."

**Key Points:**

- Locked period: 3 days (configurable)
- Auto-unlocks: No action needed from user
- Reason: Fraud protection & chargeback window
- Emergency unlock: Admin can override if needed

---

## API Changes

### Withdrawal Endpoint (Update Required)

**Before:**

```javascript
app.post("/api/withdraw", async (req, res) => {
  const { amount } = req.body;
  const wallet = await Wallet.findOne({ userId });

  if (wallet.ucoins < amount) {
    // ❌ WRONG
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // Process withdrawal...
});
```

**After:**

```javascript
app.post("/api/withdraw", async (req, res) => {
  const { amount } = req.body;
  const { eligible, reason, available, locked } =
    await checkWithdrawalEligibility(userId, amount);

  if (!eligible) {
    // ✅ CORRECT
    return res.status(400).json({
      error: reason,
      available,
      locked,
    });
  }

  // Process withdrawal...
});
```

---

### New Admin APIs

**1. Check Lock Status:**

```bash
GET /api/admin/wallet-lock-status/:userId
```

**2. Manual Unlock (Emergency):**

```bash
POST /api/admin/transactions/:id/unlock
Body: { "reason": "Emergency payout approved" }
```

**3. Re-lock (Fraud):**

```bash
POST /api/admin/transactions/:id/relock
Body: { "reason": "Fraud investigation" }
```

---

## Deployment Steps

### 1. Pre-Deploy Checklist

- [ ] Backup database: `mongodump --db usefuns`
- [ ] Review policy: Ensure `lockDays` is set (default: 3)
- [ ] Test migration script: `node migrations/step3-wallet-locking.js --dry-run`

### 2. Deploy

```bash
git pull
npm install
pm2 restart usefuns-server
```

### 3. Run Migration

```bash
node migrations/step3-wallet-locking.js
```

**Migration Does:**

- Adds `lockedUcoins` and `withdrawableUcoins` to all wallets
- Sets existing balances to `withdrawableUcoins` (grandfathered)
- Validates balance integrity

### 4. Verify

```bash
# Check cron registered
# Look for: "✅ Wallet unlock scheduler initialized"

# Check logs
tail -f logs/wallet-unlock.log

# Test admin API
curl http://localhost:3000/api/admin/wallet-lock-status/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Monitoring

### Daily Checks

1. **Cron Execution** (2 AM daily)

   ```bash
   tail -f logs/wallet-unlock.log
   ```

   Look for: "✅ Unlocked X transactions"

2. **Balance Integrity**

   - Run: `node scripts/verify-wallet-integrity.js`
   - Check: `ucoins = lockedUcoins + withdrawableUcoins`

3. **User Complaints**
   - Monitor "can't withdraw" tickets
   - Explain lock period clearly

### Alerts to Set Up

- Cron doesn't run for 25+ hours
- Unlock failure rate > 5%
- Wallet balance mismatch detected
- High re-lock rate (fraud indicator)

---

## Troubleshooting

### Issue: User can't withdraw

**Diagnosis:**

```bash
GET /api/admin/wallet-lock-status/:userId
```

**Solution:**

- If funds locked: Explain lock period
- If emergency: Admin unlock with reason
- If fraud suspected: Investigate before unlocking

---

### Issue: Cron not running

**Check:**

```bash
pm2 logs usefuns-server | grep "wallet unlock"
```

**Fix:**

```bash
# Restart server
pm2 restart usefuns-server

# Verify cron registered
# Should see: "✅ Wallet unlock scheduler initialized"
```

---

### Issue: Balance mismatch

**Diagnosis:**

```javascript
wallet.ucoins !== wallet.lockedUcoins + wallet.withdrawableUcoins;
```

**Fix:**

```javascript
// Manual correction
wallet.ucoins = wallet.lockedUcoins + wallet.withdrawableUcoins;
await wallet.save();
```

---

## Testing Scenarios

### Test 1: Normal Flow (Dev/Staging)

```bash
1. Trigger salary payout for test host
2. Check wallet: lockedUcoins should increase
3. Try withdrawal: Should fail with clear message
4. Fast-forward time (or wait)
5. Run unlock manually: node scripts/unlock-now.js
6. Check wallet: withdrawableUcoins should increase
7. Try withdrawal: Should succeed
```

### Test 2: Admin Override

```bash
1. Trigger salary payout (locked)
2. Admin calls unlock API with reason
3. Verify immediate unlock
4. Check transaction.unlockedBy = "admin"
```

### Test 3: Fraud Re-lock

```bash
1. Wait for auto-unlock
2. Detect "fraud" (simulate)
3. Admin calls relock API with reason
4. Verify funds moved back to locked
5. Try withdrawal: Should fail
```

---

## Configuration

### Policy Settings (Database)

```javascript
{
  type: "hostSalary",
  hostSalary: {
    // ... existing fields ...
    unlockRules: {
      lockDays: 3,        // Change this to adjust lock period
      autoUnlock: true    // Set false to require manual admin unlock
    }
  }
}
```

**To change lock period:**

```javascript
await Policy.findOneAndUpdate(
  { type: "hostSalary" },
  { $set: { "hostSalary.unlockRules.lockDays": 7 } }
);
```

---

## Performance

### Expected Load

- **Payout**: +10ms (1 extra field update)
- **Unlock Cron**: ~1000 transactions in <5 seconds
- **Query**: No impact (indexed)

### Database Indexes

```javascript
// Already added in code
Transaction.index({ status: 1, lockedUntil: 1 });
Wallet.index({ userId: 1, withdrawableUcoins: 1 });
```

---

## Security

### Key Protections

1. **Transaction Atomicity**: All operations use MongoDB sessions
2. **Balance Validation**: Checks before every commit
3. **Audit Trail**: Every action logged with who/what/when/why
4. **Admin Reasons**: Required for manual overrides

### Access Control

- Admin APIs: Require `authenticate` + `isAdmin` middleware
- Unlock/relock: Admin-only operations
- User APIs: Can only view own lock status

---

## FAQ

**Q: What happens to existing user balances?**  
A: Migration sets them to `withdrawableUcoins` (immediately available).

**Q: Can we change lock period after deploy?**  
A: Yes, update policy in database. Existing locks use original period.

**Q: What if user has urgent emergency?**  
A: Admin can manually unlock with documented reason.

**Q: Does this affect gift balance or diamonds?**  
A: No, only applies to salary U-coins. Diamonds/beans unchanged.

**Q: What if cron fails for a day?**  
A: Next run catches up automatically (finds ALL eligible transactions).

**Q: Can host see when funds unlock?**  
A: Yes, via `/api/wallet-lock-status` endpoint (add to UI).

**Q: What happens during reversal if host withdrew?**  
A: Smart deduction: withdrawable first, then locked. If insufficient, mark as disputed.

---

## Support Resources

**Documentation:**

- Full Guide: `docs/STEP-3-WALLET-LOCKING.md`
- Implementation: `docs/STEP-3-IMPLEMENTATION-SUMMARY.md`

**Code Files:**

- Service: `services/walletUnlock.service.js`
- Scheduler: `scheduler/walletUnlock.scheduler.js`
- Helper: `utils/withdrawalEligibility.js`
- Migration: `migrations/step3-wallet-locking.js`

**Admin APIs:**

- Unlock: POST `/api/admin/transactions/:id/unlock`
- Re-lock: POST `/api/admin/transactions/:id/relock`
- Status: GET `/api/admin/wallet-lock-status/:userId`

---

## Success Indicators

### Week 1

- ✅ Cron runs daily without errors
- ✅ No wallet balance integrity issues
- ✅ User complaints < 10% of users
- ✅ Admin override rate < 5%

### Week 2-4

- ✅ Fraud recovery rate > 80%
- ✅ Reversal success rate > 90%
- ✅ System stability > 99%
- ✅ User education complete (less "why locked" questions)

---

## 🎯 Next Steps

**Immediate (This Week):**

1. Update withdrawal UI
2. Integrate eligibility checks
3. Monitor first cron run
4. Train support team

**Next (Week 2):**

1. Move to STEP 4: Dispute System
2. Or STEP 5: Monitoring & Alerts
3. Continue with fraud prevention roadmap

---

**Questions?** Check full documentation or contact tech lead.

**Issues?** Open ticket with:

- User ID
- Transaction ID
- Lock status (`GET /admin/wallet-lock-status/:userId`)
- Expected vs actual behavior
