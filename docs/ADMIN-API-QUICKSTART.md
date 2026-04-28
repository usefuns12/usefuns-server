# Admin API Quick Reference

## Authentication

All admin APIs require:

1. Valid JWT token in Authorization header
2. Admin role on user account

```bash
Authorization: Bearer YOUR_ADMIN_TOKEN
```

---

## Common Workflows

### 1. Review Pending Salaries

**Get all calculated cycles awaiting payout:**

```bash
GET /api/admin/salary-cycles?status=calculated&sortBy=cycleEnd&sortOrder=asc
```

**Check specific host's cycles:**

```bash
GET /api/admin/salary-cycles?hostId=507f1f77bcf86cd799439011
```

---

### 2. Investigate Disputes

**View cycle details:**

```bash
GET /api/admin/salary-cycles/:cycleId
```

**Check if previously recalculated:**

```json
// Response includes:
"recalculationHistory": [
  {
    "timestamp": "2024-01-09T10:30:00.000Z",
    "adminId": "...",
    "reason": "Previous dispute",
    "oldAmount": 15000,
    "newAmount": 16800
  }
]
```

**Hold cycle during investigation:**

```bash
POST /api/admin/salary-cycles/:cycleId/hold
{
  "reason": "Investigating reported irregularities"
}
```

---

### 3. Correct Calculation Errors

**Recalculate with hour correction:**

```bash
POST /api/admin/salary-cycles/:cycleId/recalculate
{
  "reason": "Corrected hours based on stream logs",
  "hourAdjustment": 3,
  "diamondAdjustment": 0
}
```

**Recalculate with diamond correction:**

```bash
POST /api/admin/salary-cycles/:cycleId/recalculate
{
  "reason": "Removed fraudulent diamonds",
  "diamondAdjustment": -5000,
  "hourAdjustment": 0
}
```

---

### 4. Emergency Payouts

**Force immediate payout:**

```bash
POST /api/admin/salary-cycles/:cycleId/force-payout
{
  "reason": "Emergency payout approved by CEO"
}
```

**Effects:**

- Immediately credits host wallet
- Bypasses waiting period
- Creates transaction record
- Marks cycle as paid

---

### 5. Handle Payment Errors

**Reverse duplicate payment:**

```bash
POST /api/admin/salary-cycles/:cycleId/reverse
{
  "reason": "Duplicate payment detected - system error"
}
```

**Restrictions:**

- Only works if wallet has sufficient balance
- Deducts exact amount from wallet
- Changes cycle status to "disputed"

**After reversal:**

- Recalculate if needed
- Release cycle for normal processing

---

### 6. Release Held Cycles

**After investigation complete:**

```bash
POST /api/admin/salary-cycles/:cycleId/release
```

**Cycle returns to "calculated" status and will be picked up by next payout run.**

---

## Dashboard Views

### Overview Statistics

```bash
GET /api/admin/salary-cycles/stats
```

**Returns:**

```json
{
  "byStatus": [
    { "status": "calculated", "count": 45, "totalSalary": 1250000 },
    { "status": "paid", "count": 200, "totalSalary": 5000000 },
    { "status": "held", "count": 3, "totalSalary": 75000 }
  ],
  "overall": {
    "totalCycles": 248,
    "totalSalary": 6325000,
    "avgSalary": 25504.03
  }
}
```

---

### Agency Commission Stats

```bash
GET /api/admin/agency-commissions/stats
```

---

## Status Workflow

```
pending → calculated → paid
            ↓           ↑
          held    → released (back to calculated)
            ↓
          disputed (after reversal)
```

**Status Meanings:**

- **pending**: Cycle created, not yet calculated
- **calculated**: Ready for payout after waiting period
- **paid**: Successfully paid out
- **held**: Blocked by admin (investigation, dispute)
- **disputed**: Payment reversed, under review

---

## Filters & Pagination

### Date Range Filter

```bash
GET /api/admin/salary-cycles?startDate=2024-01-01&endDate=2024-01-31
```

### Status Filter

```bash
GET /api/admin/salary-cycles?status=held
```

### Pagination

```bash
GET /api/admin/salary-cycles?page=2&limit=50
```

### Sorting

```bash
GET /api/admin/salary-cycles?sortBy=salaryUcoins&sortOrder=desc
```

### Combined Example

```bash
GET /api/admin/salary-cycles?status=calculated&startDate=2024-01-01&page=1&limit=20&sortBy=cycleEnd&sortOrder=asc
```

---

## Policy Snapshots

Every cycle stores the exact policy used for calculation:

```json
"policySnapshot": {
  "policyId": "...",
  "version": 1,
  "appliedAt": "2024-01-08T00:00:00.000Z",
  "diamondTarget": 45000,
  "hourSlabs": [
    { "min": 0, "max": 30, "percentage": 25 },
    { "min": 30, "max": 60, "percentage": 30 },
    { "min": 60, "max": Infinity, "percentage": 35 }
  ],
  "reward": { "type": "ucoins", "value": 2000 }
}
```

**Why snapshots?**

- Policy changes don't affect past cycles
- Complete audit trail
- Legal proof of calculation
- Dispute resolution

---

## Common Issues & Solutions

### Issue: "Cannot recalculate already paid cycle"

**Solution:** Reverse payment first, then recalculate

```bash
# 1. Reverse
POST /api/admin/salary-cycles/:id/reverse
{ "reason": "Need to correct calculation" }

# 2. Recalculate
POST /api/admin/salary-cycles/:id/recalculate
{ "reason": "Corrected hours", "hourAdjustment": 2 }

# 3. Force payout if needed
POST /api/admin/salary-cycles/:id/force-payout
{ "reason": "Reprocessing after correction" }
```

---

### Issue: "Insufficient wallet balance to reverse"

**Solution:** Cannot reverse if host spent the money

**Options:**

1. Request host to add funds to wallet
2. Create manual adjustment transaction
3. Mark as disputed and handle offline

---

### Issue: Cycle stuck in "held" status

**Solution:** Release it

```bash
POST /api/admin/salary-cycles/:id/release
```

---

## Best Practices

### Always Provide Clear Reasons

```bash
✅ GOOD: "Dispute resolved - video evidence confirmed 42 hours streamed"
❌ BAD: "Fixed"
```

### Check History Before Actions

```bash
# View full cycle details including history
GET /api/admin/salary-cycles/:id
```

### Use Hold Instead of Delete

```bash
# Never delete cycles - use hold
POST /api/admin/salary-cycles/:id/hold
{ "reason": "Fraudulent activity detected" }
```

### Verify Wallet Balance Before Reverse

```bash
# Check cycle amount vs wallet balance
GET /api/admin/salary-cycles/:id
# Then check wallet
GET /api/v1/wallet/:userId
```

---

## Error Messages

| Code | Message                               | Solution                                      |
| ---- | ------------------------------------- | --------------------------------------------- |
| 404  | Salary cycle not found                | Check cycle ID                                |
| 400  | Cannot recalculate already paid cycle | Reverse first                                 |
| 400  | Cycle is already held                 | Already held, release or use different action |
| 400  | Cannot force payout on held cycle     | Release first                                 |
| 400  | Insufficient wallet balance           | Cannot reverse, handle offline                |
| 401  | Unauthorized                          | Check JWT token                               |
| 403  | Forbidden                             | Check admin role                              |

---

## Testing Endpoints

### Using Postman

1. Create environment variable: `ADMIN_TOKEN`
2. Set Authorization header: `Bearer {{ADMIN_TOKEN}}`
3. Import collection from `postman/admin-api.json`

### Using cURL

```bash
# Set token once
export TOKEN="your_admin_token_here"

# Then use in requests
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/salary-cycles
```

---

## Support & Escalation

**For technical issues:**

- Check server logs: `logs/error.log`
- Check database: MongoDB Compass
- Review policy snapshot in cycle document

**For business decisions:**

- Document all admin actions with clear reasons
- Keep communication records with hosts
- Escalate to management for large adjustments

---

## Quick Command Reference

```bash
# List all cycles
GET /admin/salary-cycles

# Get cycle details
GET /admin/salary-cycles/:id

# Get statistics
GET /admin/salary-cycles/stats

# Hold cycle
POST /admin/salary-cycles/:id/hold

# Release cycle
POST /admin/salary-cycles/:id/release

# Recalculate
POST /admin/salary-cycles/:id/recalculate

# Force payout
POST /admin/salary-cycles/:id/force-payout

# Reverse payment
POST /admin/salary-cycles/:id/reverse

# Agency commissions (same pattern)
GET /admin/agency-commissions
GET /admin/agency-commissions/:id
GET /admin/agency-commissions/stats
```
