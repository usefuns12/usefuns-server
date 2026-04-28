# STEP 1️⃣ - End-to-End Validation Guide

## Overview

This document provides instructions for running comprehensive validation tests on the salary and commission system before deploying to production.

## Test Scripts

### Host Salary Validation Tests

Tests different combinations of diamonds, hours, and scenarios.

```bash
npm run test:salary
```

**Test Scenarios Covered:**

1. ✅ Host with 15k diamonds + 15 hours → 100% salary
2. ✅ Host with 15k diamonds + 12 hours → 70% salary
3. ✅ Host with 15k diamonds + 5 hours → 30% salary
4. ✅ Host with 0 diamonds → 0% salary (no payout)
5. ✅ Cross-country gifts → Ignored (isValidForSalary = false)

**What It Tests:**

- Salary calculation logic with policy slabs
- Hour multiplier effects on final salary
- Diamond validation (must be ≥ threshold)
- Country code validation (same country only)
- Wallet crediting (ucoins)
- Transaction record creation

---

### Agency Commission Validation Tests

Tests different agency sizes and host completion scenarios.

```bash
npm run test:commission
```

**Test Scenarios Covered:**

1. ✅ Agency with 1 host earning salary
2. ✅ Agency with 10 hosts with varying earnings
3. ✅ Agency with mixed hosts (5 complete, 5 incomplete)

**What It Tests:**

- Commission calculation from aggregated host salaries
- Slab-based commission percentages
- Multi-host aggregation
- Agency owner wallet crediting
- Transaction record creation

---

### Run All Salary System Tests

```bash
npm run test:salary-system
```

This runs both host salary and agency commission tests sequentially.

---

## Pre-Test Checklist

### ✅ Database Setup

- [ ] MongoDB is running and accessible
- [ ] Database name matches `config/database.js`
- [ ] Database is empty or in test mode (will create test data)

### ✅ Policy Configuration

- [ ] Run `npm run seed:policies` to create default policies
  ```bash
  npm run seed:policies
  ```
- [ ] Verify Policy document exists in database:
  ```javascript
  // From MongoDB shell or client
  db.policies.findOne({ type: "hostSalary" });
  ```

### ✅ Models Are Loaded

- [ ] All models in `models/` are properly exported in `models/index.js`
- [ ] Key models: Host, Customer, Agency, HostSalaryCycle, AgencyCommissionCycle, Policy

### ✅ Services Are Functional

- [ ] All service files exist in `services/`
- [ ] Services export their functions correctly
- [ ] No syntax errors in service files

---

## Running Tests Step-by-Step

### 1. Start with Policy Seeding

```bash
npm run seed:policies
```

Expected output:

```
✅ Policy seeded successfully
✅ hostSalary slabs created
✅ agencyCommission slabs created
```

### 2. Run Host Salary Tests

```bash
npm run test:salary
```

Expected output:

```
📋 TEST 1: 15k diamonds + 15 hours → 100% salary
✓ Salary calculated: {...}
✓ Expected salary: XXXX, Actual: XXXX
✓ Payout completed: {...}
✓ Wallet balance: XXXX U-coins
✓ Assert: Wallet balance matches

📋 TEST 2: 15k diamonds + 12 hours → 70% salary
...

🎯 VALIDATION REPORT - HOST SALARY SYSTEM
✅ Passed: 5
❌ Failed: 0
📋 Total: 5

🎉 ALL TESTS PASSED! System is production-ready.
```

### 3. Run Agency Commission Tests

```bash
npm run test:commission
```

Expected output:

```
📋 TEST 1: Agency with 1 host → Commission correct
✓ Host salary: XXXX U-coins
✓ Agency commission: XXXX U-coins
✓ Owner wallet credited: XXXX U-coins

📋 TEST 2: Agency with 10 hosts → Commission aggregated
...

🎯 AGENCY COMMISSION VALIDATION REPORT
✅ Passed: 3
❌ Failed: 0
📋 Total: 3

🎉 ALL AGENCY TESTS PASSED! Commission system is production-ready.
```

---

## Interpreting Test Results

### ✅ All Tests Pass

**What it means:** Your salary system is correctly:

- Calculating host salary based on diamonds and hours
- Applying hour multipliers
- Ignoring cross-country gifts
- Crediting wallets with U-coins
- Creating transaction audit records
- Aggregating commissions across multiple hosts
- Paying agency owners correctly

**Next steps:** Proceed to STEP 2 (Admin Dashboard) and STEP 3 (Wallet Safety)

---

### ❌ A Test Fails

#### Test 1 Fails: "15k + 15h = 100%"

**Likely causes:**

- Policy not seeded (run `npm run seed:policies`)
- Host.customerRef not pointing to valid customer
- Wallet model doesn't have `ucoins` field
- Service throwing error in salary calculation

**Debug steps:**

1. Check MongoDB logs
2. Verify Policy document: `db.policies.find()`
3. Check Host model has `customerRef` field
4. Verify Wallet model includes `ucoins` field

---

#### Test 5 Fails: "Cross-country ignored"

**Likely causes:**

- `isValidForSalary` flag not being set correctly in giftTracking
- Gift validation logic not comparing country codes properly

**Debug steps:**

1. Check giftTracking.service.js line: `isValidForSalary: sender.countryCode === room.countryCode`
2. Verify GiftTransaction documents have `isValidForSalary` field
3. Check if gifts are being counted in salary calculation

---

#### Test 2/3 Fails: "Commission aggregation"

**Likely causes:**

- Agency.ownerUserId not matching customer ID
- CommissionCalculation not summing host salaries correctly
- Commission payout using wrong user ID field

**Debug steps:**

1. Verify Agency.ownerUserId format matches Wallet.userId
2. Check AgencyCommissionCycle has `agencyId` field
3. Review commissionCalculation.service.js aggregation logic

---

## Manual Testing

If automated tests don't work, manually test each component:

### Test Host Salary (Manual)

```javascript
// In Node.js REPL or app context
const Host = require("./models/Host");
const HostSalaryCycle = require("./models/HostSalaryCycle");
const hostSalaryService = require("./services/hostSalary.service");

const host = await Host.findById("HOST_ID");
const cycle = await HostSalaryCycle.findById("CYCLE_ID");
const salary = await hostSalaryService.calculateHostSalary(host._id, cycle);
console.log(salary);
```

Expected response:

```javascript
{
  salaryUcoins: 150000,
  diamondMultiplier: 1.0,
  hourMultiplier: 1.0,
  eligibleDiamonds: 15000,
  calculatedAt: "2025-12-30T10:00:00.000Z"
}
```

---

### Test Wallet Credit (Manual)

```javascript
const Wallet = require("./models/Wallet");
const salaryPayoutService = require("./services/salaryPayout.service");

const cycle = await HostSalaryCycle.findById("CYCLE_ID");
const result = await salaryPayoutService.payHostSalary(cycle._id);
console.log(result);

// Verify wallet
const wallet = await Wallet.findOne({ userId: "CUSTOMER_ID" });
console.log(wallet.ucoins); // Should equal cycle.salaryUcoins
```

---

## Performance Baseline

After tests pass, note these baseline metrics:

| Metric                       | Value   | Notes                     |
| ---------------------------- | ------- | ------------------------- |
| Host salary calculation time | < 100ms | Single host, 15k diamonds |
| 10-host commission calc      | < 500ms | Aggregate 10 cycles       |
| Wallet update time           | < 50ms  | Upsert operation          |
| Transaction creation         | < 30ms  | Per payout                |

---

## Cleanup After Testing

The tests create temporary test data. To clean up:

```bash
# Option 1: Drop entire test database
npm run drop:test-db

# Option 2: Manual cleanup (if drop script doesn't exist)
# In MongoDB shell:
db.customers.deleteMany({ userName: /^test_user_/ })
db.hosts.deleteMany({ hostName: /^Test Host/ })
db.agencies.deleteMany({ agencyName: /Test|Multi|Single|Mixed/ })
db.hostsalarycycles.deleteMany({})
db.agencycommissioncycles.deleteMany({})
db.gifttransactions.deleteMany({ senderRef: { $exists: true } })
db.wallets.deleteMany({})
```

---

## Production Deployment Checklist

Before going live, ensure:

- [ ] All 5 host salary tests pass
- [ ] All 3 agency commission tests pass
- [ ] Policy seeding completes successfully
- [ ] No console errors in test output
- [ ] Wallet balances match expected values
- [ ] Transaction records created for each payout
- [ ] Database backup completed
- [ ] Ready for STEP 2 (Admin Dashboard implementation)

---

## Next Steps

Once STEP 1 (Validation) is complete:
→ **STEP 2:** Implement Admin Dashboard (screens for policies, cycles, overrides)
→ **STEP 3:** Add Wallet Safety (locking, withdrawal restrictions)
→ **STEP 4:** Build Dispute & Recalculation System
→ **STEP 5:** Enable Monitoring & Alerts
→ **STEP 6:** Add Fraud & Abuse Protection
→ **STEP 7:** Optimize Performance & Scaling
→ **STEP 8:** Finalize Policy Versioning for Legal Compliance

---

## Support

If tests fail or need debugging:

1. Check `IMPLEMENTATION_SUMMARY.md` for system architecture
2. Review `SALARY_SYSTEM.md` for detailed service documentation
3. Check service error messages in console output
4. Verify all models have required fields
5. Ensure database connection is stable
