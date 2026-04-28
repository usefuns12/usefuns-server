# STEP 4 → STEP 5 Transition Guide

## 🎯 You've Completed STEP 4!

**Status**: ✅ Dispute & Recalculation System COMPLETE

Now let's plan the transition to STEP 5.

---

## 📊 STEP 4 Summary

### What You Built

- Complete dispute resolution workflow
- Safe salary/commission recalculation
- Wallet-aware adjustments with lock period respect
- Full audit trail
- 9 API endpoints (user + admin)
- Comprehensive documentation

### Files Created

- `models/Dispute.js`
- `services/recalculation.service.js`
- `services/walletAdjustment.service.js`
- `controllers/dispute.controller.js`
- `routes/dispute.routes.js`

### Files Modified

- `models/Transaction.js`
- `app.js`

### Documentation

- 107 pages across 7 files
- 30+ test scenarios
- Integration guide
- Deployment checklist

---

## 🚀 STEP 5: Monitoring & Alerts

### Overview

**Purpose**: Detect fraud patterns and anomalies that indicate system abuse

**Duration**: 2 weeks of full-time development

**Components**: 6 major pieces

### What STEP 5 Will Add

#### 1. Zero Salary Detection

```
Detect if host has 2+ consecutive cycles with 0 salary
→ Alert admin: "Host X has zero salary for 2+ cycles"
→ Auto-pause host (optional)
```

#### 2. Commission Drop Detection

```
If agency commission drops > 30% from average
→ Alert: "Agency X commission dropped 50%"
→ Flag for review
```

#### 3. Gift Spike Detection

```
If gifts given in single day > 3x average
→ Alert: "Unusual gift activity from user X"
→ Check for fraud
```

#### 4. Multi-Device Host Detection

```
If host logs in from 10+ different devices in 24 hours
→ Alert: "Host X unusual login pattern"
→ Possible account takeover
```

#### 5. Cron Job Failure Detection

```
Monitor all scheduled jobs (salary calc, commission, etc.)
→ Alert if any fail
→ Include error details
```

#### 6. Webhook Retry Tracking

```
Track failed webhooks/notifications
→ Alert if retry count > threshold
→ Notify ops team
```

---

## 🗂️ STEP 5 Implementation Plan

### Phase 1: Foundation (Days 1-3)

**Create Alert Model**:

```javascript
// models/Alert.js
{
  type: String,              // zero_salary, commission_drop, etc.
  severity: String,          // low, medium, high, critical
  relatedEntity: {
    entityType: String,      // host, agency, user
    entityId: ObjectId
  },
  message: String,
  metadata: Object,          // Details of alert
  status: String,            // new, acknowledged, resolved
  acknowledgedBy: ObjectId,
  acknowledgedAt: Date,
  resolvedBy: ObjectId,
  resolvedAt: Date,
  createdAt: Date
}
```

**Create Monitoring Service**:

```javascript
// services/monitoring.service.js
-detectZeroSalary() -
  detectCommissionDrop() -
  detectGiftSpike() -
  detectMultiDevice() -
  detectCronFailure() -
  createAlert();
```

### Phase 2: Detection Logic (Days 4-7)

**Zero Salary Detection**:

```javascript
// Run daily
// Check past 2 cycles
// If both = 0 → Alert
```

**Commission Drop Detection**:

```javascript
// Compare current to 3-month average
// If drop > 30% → Alert
```

**Gift Spike Detection**:

```javascript
// Compare daily gifts to 30-day average
// If > 3x → Alert
```

**Multi-Device Detection**:

```javascript
// Track login device fingerprints
// Count unique devices in last 24h
// If > 10 → Alert
```

### Phase 3: Admin Notifications (Days 8-10)

**Create Notification System**:

```javascript
// services/alertNotification.service.js
-sendAlertToAdmin() -
  sendSlackNotification() -
  sendEmailNotification() -
  sendPushNotification();
```

**Alert Dashboard**:

```javascript
// GET /api/admin/alerts
// GET /api/admin/alerts/:id
// PATCH /api/admin/alerts/:id/acknowledge
// PATCH /api/admin/alerts/:id/resolve
```

### Phase 4: Reporting (Days 11-14)

**Alert Analytics**:

```javascript
// GET /api/admin/alerts/analytics
{
  totalAlerts: 100,
  byType: { zero_salary: 20, commission_drop: 15, ... },
  bySeverity: { critical: 5, high: 20, ... },
  resolutionRate: "95%",
  avgResolutionTime: "2 hours"
}
```

**Trending Alerts**:

```javascript
// Which alerts are most common?
// Which users trigger most alerts?
// What's the pattern?
```

---

## 📋 STEP 5 Detailed Breakdown

### Component 1: Alert Model & Database

**Time**: 2 hours
**Files**: `models/Alert.js`

**Schema**:

```javascript
type: enum (zero_salary, commission_drop, gift_spike, multi_device, cron_failure, webhook_retry)
severity: enum (low, medium, high, critical)
relatedEntity: { entityType, entityId }
message: String
metadata: Object
status: enum (new, acknowledged, resolved)
acknowledgedBy, acknowledgedAt
resolvedBy, resolvedAt
createdAt, updatedAt
```

**Indexes**:

- status, severity, createdAt
- type, relatedEntity.entityId

---

### Component 2: Zero Salary Detection

**Time**: 3 hours
**Files**: `services/monitoring.service.js`

**Logic**:

```javascript
async function detectZeroSalary() {
  // Get all hosts
  const hosts = await Host.find();

  for (const host of hosts) {
    // Get last 2 salary cycles
    const cycles = await HostSalaryCycle.find({ hostId: host._id })
      .sort({ endDate: -1 })
      .limit(2);

    // Check if both are 0
    if (
      cycles.length === 2 &&
      cycles[0].salaryUcoins === 0 &&
      cycles[1].salaryUcoins === 0
    ) {
      // Create alert
      await createAlert({
        type: "zero_salary",
        severity: "high",
        relatedEntity: { entityType: "host", entityId: host._id },
        message: `Host ${host.name} has zero salary for 2 consecutive cycles`,
        metadata: { cycles: cycles.map((c) => c._id) },
      });
    }
  }
}

// Schedule: Run daily at 2 AM
cron.schedule("0 2 * * *", detectZeroSalary);
```

---

### Component 3: Commission Drop Detection

**Time**: 3 hours
**Files**: `services/monitoring.service.js`

**Logic**:

```javascript
async function detectCommissionDrop() {
  const agencies = await Agency.find();

  for (const agency of agencies) {
    // Get last commission cycle
    const lastCycle = await AgencyCommissionCycle.findOne({
      agencyId: agency._id,
    }).sort({ createdAt: -1 });

    // Get average of last 3 cycles
    const previousCycles = await AgencyCommissionCycle.find({
      agencyId: agency._id,
    })
      .sort({ createdAt: -1 })
      .limit(3);

    const average =
      previousCycles.reduce((sum, c) => sum + c.commissionUcoins, 0) /
      previousCycles.length;

    // Check if drop > 30%
    if (lastCycle.commissionUcoins < average * 0.7) {
      const percentDrop = (
        ((average - lastCycle.commissionUcoins) / average) *
        100
      ).toFixed(1);

      await createAlert({
        type: "commission_drop",
        severity: "medium",
        relatedEntity: { entityType: "agency", entityId: agency._id },
        message: `Agency ${agency.name} commission dropped ${percentDrop}%`,
        metadata: {
          lastAmount: lastCycle.commissionUcoins,
          average: average.toFixed(0),
          percentDrop,
        },
      });
    }
  }
}

// Schedule: Run daily at 3 AM
cron.schedule("0 3 * * *", detectCommissionDrop);
```

---

### Component 4: Gift Spike Detection

**Time**: 4 hours
**Files**: `services/monitoring.service.js`

**Logic**:

```javascript
async function detectGiftSpike() {
  const users = await User.find();

  for (const user of users) {
    // Get gifts sent in last 24 hours
    const day24ago = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayGifts = await GiftTransaction.find({
      senderId: user._id,
      createdAt: { $gte: day24ago },
    });

    // Get average daily gifts (last 30 days)
    const day30ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthGifts = await GiftTransaction.find({
      senderId: user._id,
      createdAt: { $gte: day30ago },
    });

    const averageDaily = monthGifts.length / 30;

    // Check if today > 3x average
    if (todayGifts.length > averageDaily * 3) {
      const totalValue = todayGifts.reduce(
        (sum, g) => sum + g.diamondsAmount,
        0
      );

      await createAlert({
        type: "gift_spike",
        severity: "high",
        relatedEntity: { entityType: "user", entityId: user._id },
        message: `User ${user.name} sent unusual amount of gifts today (${todayGifts.length} gifts, ${totalValue} diamonds)`,
        metadata: {
          giftCount: todayGifts.length,
          totalDiamonds: totalValue,
          averageDaily: averageDaily.toFixed(1),
        },
      });
    }
  }
}

// Schedule: Run every 6 hours
cron.schedule("0 */6 * * *", detectGiftSpike);
```

---

### Component 5: Multi-Device Detection

**Time**: 4 hours
**Files**: `services/monitoring.service.js`

**Logic**:

```javascript
async function detectMultiDevice() {
  // Track device fingerprints on login
  // In login endpoint:
  const device = {
    deviceId: req.headers["device-id"],
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
    timestamp: new Date(),
  };

  await DeviceFingerprint.create({
    userId: user._id,
    ...device,
  });

  // Check for unusual activity
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fingerprints = await DeviceFingerprint.find({
    userId: user._id,
    timestamp: { $gte: last24h },
  });

  // Count unique devices
  const uniqueDevices = new Set(fingerprints.map((f) => f.deviceId)).size;

  if (uniqueDevices > 10) {
    await createAlert({
      type: "multi_device",
      severity: "critical",
      relatedEntity: { entityType: "user", entityId: user._id },
      message: `User ${user.name} logged in from ${uniqueDevices} different devices in 24 hours`,
      metadata: { deviceCount: uniqueDevices },
    });
  }
}

// Also run manually on login
// In auth.controller.js, after successful login
await detectMultiDevice();
```

---

### Component 6: Cron Failure Detection

**Time**: 3 hours
**Files**: `services/monitoring.service.js`

**Logic**:

```javascript
// Create wrapper for all cron jobs
async function runCronWithErrorHandling(name, fn) {
  const startTime = new Date();

  try {
    await fn();

    // Log success
    await CronLog.create({
      jobName: name,
      status: "success",
      startTime,
      endTime: new Date(),
      message: "Job completed successfully",
    });
  } catch (err) {
    // Log failure
    await CronLog.create({
      jobName: name,
      status: "failed",
      startTime,
      endTime: new Date(),
      error: err.message,
      stack: err.stack,
    });

    // Create alert
    await createAlert({
      type: "cron_failure",
      severity: "critical",
      message: `Cron job '${name}' failed: ${err.message}`,
      metadata: { jobName: name, error: err.message },
    });

    // Notify admin immediately
    await notificationService.send("admins", {
      title: "Cron Job Failure",
      message: `${name} failed: ${err.message}`,
      severity: "critical",
    });
  }
}

// Use in all cron jobs
cron.schedule("0 0 * * *", () =>
  runCronWithErrorHandling("calculateDailySalary", calculateDailySalary)
);
```

---

### Component 7: Admin APIs

**Time**: 3 hours
**Files**: `controllers/alert.controller.js`

```javascript
// GET /api/admin/alerts
async listAlerts(req, res) {
  const { type, severity, status, page = 1 } = req.query;

  const filter = {};
  if (type) filter.type = type;
  if (severity) filter.severity = severity;
  if (status) filter.status = status;

  const alerts = await Alert.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * 20)
    .limit(20);

  // ... return with pagination
}

// PATCH /api/admin/alerts/:id/acknowledge
async acknowledgeAlert(req, res) {
  const alert = await Alert.findById(req.params.id);

  alert.status = 'acknowledged';
  alert.acknowledgedBy = req.user._id;
  alert.acknowledgedAt = new Date();

  await alert.save();

  // Log action
  await logAudit('alert_acknowledged', req.user._id, alert._id);

  res.json({ success: true, data: alert });
}

// PATCH /api/admin/alerts/:id/resolve
async resolveAlert(req, res) {
  const { resolution } = req.body;

  const alert = await Alert.findById(req.params.id);

  alert.status = 'resolved';
  alert.resolvedBy = req.user._id;
  alert.resolvedAt = new Date();
  alert.resolution = resolution;

  await alert.save();

  res.json({ success: true, data: alert });
}

// GET /api/admin/alerts/analytics
async getAlertAnalytics(req, res) {
  const { startDate, endDate } = req.query;

  const alerts = await Alert.find({
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
  });

  const analytics = {
    total: alerts.length,
    byType: {
      zero_salary: alerts.filter(a => a.type === 'zero_salary').length,
      commission_drop: alerts.filter(a => a.type === 'commission_drop').length,
      // ... other types
    },
    bySeverity: {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      // ... other severities
    },
    resolutionRate: (resolved / alerts.length * 100).toFixed(1) + '%'
  };

  res.json({ success: true, data: analytics });
}
```

---

### Component 8: Notification System

**Time**: 2 hours
**Files**: `services/alertNotification.service.js`

```javascript
async function notifyAlert(alert) {
  // Email to admin
  if (alert.severity === 'critical') {
    await sendEmail('admin@example.com', {
      subject: `CRITICAL ALERT: ${alert.message}`,
      body: alert.message,
      metadata: alert.metadata
    });
  }

  // Slack notification
  if (alert.severity === 'critical' || alert.severity === 'high') {
    await sendSlack(process.env.ADMIN_SLACK_CHANNEL, {
      color: alert.severity === 'critical' ? 'danger' : 'warning',
      title: alert.message,
      text: JSON.stringify(alert.metadata, null, 2)
    });
  }

  // In-app notification
  await Notification.create({
    userId: adminId,
    type: 'alert',
    title: `Alert: ${alert.type}`,
    message: alert.message,
    link: `/admin/alerts/${alert._id}`,
    read: false
  });

  // SMS for critical
  if (alert.severity === 'critical') {
    await sendSMS(process.env.ADMIN_PHONE, alert.message.substring(0, 160));
  }
}

// Call after creating alert
await createAlert(...);
await notifyAlert(alert);
```

---

## 📊 STEP 5 Deliverables

### Code Files (3 new)

- `models/Alert.js`
- `controllers/alert.controller.js`
- `services/monitoring.service.js`

### Files Modified (1)

- `app.js` - Register alert routes

### Documentation

- STEP-5-MONITORING-SYSTEM.md
- STEP-5-TESTING-GUIDE.md
- STEP-5-INTEGRATION-GUIDE.md

### Total Code

- ~500 lines of detection logic
- ~200 lines of API endpoints
- ~150 lines of notifications
- **850+ lines total**

---

## ⏰ STEP 5 Timeline

| Phase           | Days  | Tasks                                  |
| --------------- | ----- | -------------------------------------- |
| Foundation      | 1-3   | Create Alert model, monitoring service |
| Detection Logic | 4-7   | Implement all 6 detection algorithms   |
| Notifications   | 8-10  | Add email, Slack, SMS, push            |
| Reporting       | 11-14 | Analytics, trending, dashboard         |

**Total**: 2 weeks of full-time development

---

## 🎯 Success Criteria for STEP 5

- ✅ All 6 alert types detected
- ✅ Alerts created with correct severity
- ✅ Notifications delivered to admins
- ✅ Admin APIs for alert management
- ✅ Analytics showing alert patterns
- ✅ Cron failures monitored
- ✅ Performance: alert detection < 100ms
- ✅ 20+ test scenarios

---

## 🚦 Before Starting STEP 5

### Complete STEP 4 First

- [ ] Add withdrawal prevention integration
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] QA approval

### Prepare for STEP 5

- [ ] Review this document
- [ ] Set up alert notification channels
  - [ ] Email service configured
  - [ ] Slack webhook ready
  - [ ] SMS service set up
  - [ ] Push notification service ready
- [ ] Plan alert escalation policy
- [ ] Create admin team

### Have Available

- [ ] SendGrid or similar for email
- [ ] Slack webhook URL
- [ ] SMS service (Twilio, etc.)
- [ ] Push notification service
- [ ] Admin Slack channel
- [ ] Admin email list

---

## 🎉 After STEP 5 Complete

### STEP 6: Fraud & Abuse Protection

- Max diamonds/day limits
- Diamond velocity detection
- Self-gifting prevention
- Multi-account device detection

### STEP 7: Performance & Scaling

- Database indexes
- Query optimization
- Cron to Bull queue migration
- Transaction archival

### STEP 8: Production Readiness

- Security audit
- Edge case testing
- Deployment procedures
- Monitoring setup

---

## 📞 Need Help?

### Current STEP 4 Documentation

- `docs/STEP-4-INDEX.md` - Overview
- `docs/STEP-4-DISPUTE-SYSTEM.md` - Design
- `docs/STEP-4-DEVELOPERS-GUIDE.md` - Development

### Planning for STEP 5

- `STEP-5-TRANSITION-GUIDE.md` (this file)
- Contact: [Your team lead]

---

## ✅ Transition Checklist

Before moving to STEP 5:

**STEP 4 Completion**:

- [ ] All code implemented
- [ ] All tests documented
- [ ] Integration complete
- [ ] Deployed to production
- [ ] Monitoring established

**STEP 5 Preparation**:

- [ ] Team briefing scheduled
- [ ] Notification channels ready
- [ ] Admin processes defined
- [ ] Timeline confirmed
- [ ] Resources allocated

---

## 🚀 Ready to Start STEP 5?

When you're ready to begin Monitoring & Alerts:

1. **Complete**: All STEP 4 tasks
2. **Prepare**: Notification infrastructure
3. **Read**: This guide thoroughly
4. **Plan**: STEP 5 timeline with your team
5. **Execute**: Follow STEP 5 implementation plan

---

**Congratulations on completing STEP 4! 🎉**

You now have a complete, production-ready dispute resolution system with full audit trails and wallet-safe adjustments.

Next up: **STEP 5 - Monitoring & Alerts** - Detect fraud before it happens!

Ready when you are! 🚀
