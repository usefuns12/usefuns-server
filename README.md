# UseFuns Platform - Complete API Documentation

**Last Updated:** December 31, 2025  
**Status:** ✅ Production Ready  
**Total Endpoints:** 61

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication & Authorization](#authentication--authorization)
3. [Admin Salary Management](#admin-salary-management)
4. [Dispute Resolution](#dispute-resolution)
5. [Alert Management](#alert-management)
6. [Fraud Detection](#fraud-detection)
7. [KPI & Analytics](#kpi--analytics)
8. [Queue Management](#queue-management)
9. [Policy Configuration](#policy-configuration)
10. [Error Handling](#error-handling)

---

## Getting Started

### Base URL

```
http://localhost:3000/api/v1
```

### Headers Required (All Endpoints)

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {JWT_TOKEN}"
}
```

### Environment Setup

```bash
cd usefuns-server
npm install
npm start
```

---

## Authentication & Authorization

### Login (Get JWT Token)

Every endpoint requires a valid JWT token from authentication middleware.

**Permissions Used:**

- `view_salary` - View salary data
- `manage_salary` - Modify salary data
- `view_disputes` - View disputes
- `manage_disputes` - Resolve disputes
- `view_alerts` - View alerts
- `manage_alerts` - Acknowledge/resolve alerts
- `view_fraud` - View fraud actions
- `manage_fraud` - Create/modify fraud actions
- `view_analytics` - View KPI dashboards
- `view_policies` - View policies
- `manage_policies` - Create/modify policies
- `manage_queues` - Manage background jobs

---

## Admin Salary Management

### 1. List All Salary Records

**Purpose:** Retrieve all salary records with pagination and filtering  
**Where Used:** Admin dashboard salary list  
**Auth Required:** `view_salary`

```http
GET /admin/salary
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20,
  "cycleId": "cy-2025-01",
  "status": "pending",
  "sortBy": "createdAt",
  "order": "desc"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "sal-123",
      "userId": "user-456",
      "cycleId": "cy-2025-01",
      "grossAmount": 5000,
      "netAmount": 4500,
      "deductions": 500,
      "status": "pending",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pages": 8
}
```

---

### 2. Get Salary Settings

**Purpose:** Retrieve global salary system settings  
**Where Used:** Configuration management  
**Auth Required:** `view_salary`

```http
GET /admin/salary/settings
```

**Response:**

```json
{
  "success": true,
  "data": {
    "minSalary": 1000,
    "maxSalary": 50000,
    "defaultTaxRate": 0.1,
    "currencySymbol": "PKR",
    "paymentMethod": "bank_transfer",
    "processingDays": 3
  }
}
```

---

### 3. Get Salary Statistics

**Purpose:** Get salary system KPIs and metrics  
**Where Used:** Dashboard analytics  
**Auth Required:** `view_salary`

```http
GET /admin/salary/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSalariesThisMonth": 250000,
    "averageSalary": 5000,
    "totalUsers": 50,
    "totalProcessed": 45,
    "totalPending": 5,
    "totalFailed": 0,
    "deductionRate": 0.1,
    "lastProcessedDate": "2025-01-15T10:00:00Z"
  }
}
```

---

### 4. Get Pending Approvals

**Purpose:** List salaries waiting for admin approval  
**Where Used:** Admin approval workflow  
**Auth Required:** `manage_salary`

```http
GET /admin/salary/pending-approvals
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "sal-789",
      "userId": "user-456",
      "userName": "John Host",
      "amount": 5000,
      "reason": "Monthly salary",
      "submittedAt": "2025-01-15T08:00:00Z",
      "reviewDeadline": "2025-01-20T23:59:59Z"
    }
  ],
  "pending": 12,
  "total": 50
}
```

---

### 5. Get Salary Cycles

**Purpose:** List all salary payment cycles  
**Where Used:** Cycle management interface  
**Auth Required:** `view_salary`

```http
GET /admin/salary/cycles
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 10,
  "status": "completed"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "cy-2025-01",
      "period": "2025-01",
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z",
      "status": "completed",
      "totalAmount": 250000,
      "totalUsers": 50,
      "processedAt": "2025-02-01T10:00:00Z"
    }
  ]
}
```

---

### 6. Get Current Salary Cycle

**Purpose:** Get the active/current salary cycle details  
**Where Used:** Current period information  
**Auth Required:** `view_salary`

```http
GET /admin/salary/cycles/current
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "cy-2025-01",
    "period": "2025-01",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-31T23:59:59Z",
    "status": "processing",
    "totalAmount": 250000,
    "daysRemaining": 15
  }
}
```

---

### 7. Recalculate Salary Cycle

**Purpose:** Manually trigger salary recalculation for a cycle  
**Where Used:** Admin manual intervention  
**Auth Required:** `manage_salary`

```http
POST /admin/salary/recalculate
```

**Request Body:**

```json
{
  "cycleId": "cy-2025-01",
  "reason": "Policy change adjustment",
  "userId": "user-456",
  "amount": 5500
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary recalculated successfully",
  "data": {
    "cycleId": "cy-2025-01",
    "totalRecalculated": 50,
    "totalAmount": 262500,
    "difference": 12500,
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 8. Process Bulk Salaries

**Purpose:** Process multiple salary records at once  
**Where Used:** Batch salary processing  
**Auth Required:** `manage_salary`

```http
POST /admin/salary/process-bulk
```

**Request Body:**

```json
{
  "salaryIds": ["sal-123", "sal-456", "sal-789"],
  "action": "process",
  "paymentMethod": "bank_transfer",
  "notes": "End of month processing"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Bulk processing initiated",
  "data": {
    "total": 3,
    "processed": 3,
    "failed": 0,
    "totalAmount": 15000,
    "jobId": "job-bulk-2025-01-15"
  }
}
```

---

### 9. Unlock Salary Cycle

**Purpose:** Release a held/frozen salary cycle for processing  
**Where Used:** Cycle state management  
**Auth Required:** `manage_salary`

```http
POST /admin/salary/unlock-cycle
```

**Request Body:**

```json
{
  "cycleId": "cy-2025-01",
  "reason": "Issue resolved, ready to process"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cycle unlocked",
  "data": {
    "cycleId": "cy-2025-01",
    "status": "unlocked",
    "unlockedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 10. Approve Pending Salaries

**Purpose:** Approve all pending salary records  
**Where Used:** Approval workflow completion  
**Auth Required:** `manage_salary`

```http
POST /admin/salary/approve-pending
```

**Request Body:**

```json
{
  "approvalIds": ["sal-123", "sal-456"],
  "approvedBy": "admin-user-id",
  "notes": "Approved by CFO review"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salaries approved",
  "data": {
    "approved": 2,
    "totalAmount": 10000,
    "approvalDate": "2025-01-15T10:00:00Z"
  }
}
```

---

### 11. Update Salary Record

**Purpose:** Edit a specific salary record  
**Where Used:** Salary correction  
**Auth Required:** `manage_salary`

```http
PUT /admin/salary/{salaryId}
```

**URL Parameters:**

```
salaryId: sal-123
```

**Request Body:**

```json
{
  "amount": 5200,
  "reason": "Bonus adjustment",
  "deductions": 520,
  "notes": "Performance bonus"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Salary updated",
  "data": {
    "_id": "sal-123",
    "amount": 5200,
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 12. Delete Salary Record

**Purpose:** Remove a salary record (only for pending records)  
**Where Used:** Salary cancellation  
**Auth Required:** `manage_salary`

```http
DELETE /admin/salary/{salaryId}
```

**URL Parameters:**

```
salaryId: sal-123
```

**Response:**

```json
{
  "success": true,
  "message": "Salary deleted",
  "data": {
    "deletedId": "sal-123",
    "deletedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 13. Export Salary Data

**Purpose:** Export salary records to CSV or PDF  
**Where Used:** Reporting and compliance  
**Auth Required:** `view_salary`

```http
POST /admin/salary/export
```

**Request Body:**

```json
{
  "cycleId": "cy-2025-01",
  "format": "csv",
  "columns": ["userId", "amount", "status", "date"],
  "dateRange": {
    "from": "2025-01-01",
    "to": "2025-01-31"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Export queued",
  "data": {
    "jobId": "export-sal-2025-01-15",
    "format": "csv",
    "estimatedTime": "5 minutes",
    "downloadUrl": "/downloads/salary-export-2025-01-15.csv"
  }
}
```

---

## Dispute Resolution

### 1. List All Disputes (Admin)

**Purpose:** Get all user disputes for admin review  
**Where Used:** Admin dispute dashboard  
**Auth Required:** `manage_disputes`

```http
GET /admin/disputes
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20,
  "status": "pending",
  "sortBy": "createdAt"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "disp-123",
      "userId": "user-456",
      "reason": "Salary miscalculation",
      "description": "My January salary is less than expected",
      "amount": 500,
      "status": "pending",
      "createdAt": "2025-01-10T10:00:00Z"
    }
  ],
  "total": 25,
  "pending": 12
}
```

---

### 2. Get Dispute Details

**Purpose:** View full dispute information with history  
**Where Used:** Dispute review page  
**Auth Required:** `manage_disputes`

```http
GET /admin/disputes/{disputeId}
```

**URL Parameters:**

```
disputeId: disp-123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "disp-123",
    "userId": "user-456",
    "userName": "John Host",
    "reason": "Salary miscalculation",
    "description": "My January salary is less than expected",
    "attachments": ["receipt-url", "screenshot-url"],
    "status": "pending",
    "history": [
      {
        "action": "created",
        "timestamp": "2025-01-10T10:00:00Z",
        "by": "user-456"
      }
    ],
    "createdAt": "2025-01-10T10:00:00Z"
  }
}
```

---

### 3. Submit New Dispute (User)

**Purpose:** User submits a complaint  
**Where Used:** Mobile/web app dispute form  
**Auth Required:** User authenticated

```http
POST /disputes
```

**Request Body:**

```json
{
  "reason": "Salary miscalculation",
  "description": "My January salary is 500 less than expected. I was promised 5000 but received 4500.",
  "amount": 500,
  "attachments": ["url1", "url2"],
  "referenceId": "sal-123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dispute submitted successfully",
  "data": {
    "_id": "disp-123",
    "status": "pending",
    "ticketNumber": "DSP-2025-00123",
    "submittedAt": "2025-01-10T10:00:00Z"
  }
}
```

---

### 4. Review Dispute

**Purpose:** Admin reviews and documents dispute review  
**Where Used:** Admin investigation  
**Auth Required:** `manage_disputes`

```http
POST /admin/disputes/{disputeId}/review
```

**URL Parameters:**

```
disputeId: disp-123
```

**Request Body:**

```json
{
  "findings": "Salary calculation is correct per policy. User received correct amount.",
  "evidence": ["policy-document-url", "calculation-screenshot"],
  "recommendation": "No adjustment needed",
  "notes": "User policy does not apply in this case"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dispute reviewed",
  "data": {
    "_id": "disp-123",
    "status": "under_review",
    "reviewedAt": "2025-01-12T10:00:00Z",
    "findings": "Salary calculation is correct per policy..."
  }
}
```

---

### 5. Simulate Recalculation

**Purpose:** Test salary adjustment without saving  
**Where Used:** Resolution preview  
**Auth Required:** `manage_disputes`

```http
POST /admin/disputes/{disputeId}/recalculate
```

**URL Parameters:**

```
disputeId: disp-123
```

**Request Body:**

```json
{
  "adjustment": 500,
  "reason": "Apply policy correction",
  "effectiveDate": "2025-01-15"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Simulation complete",
  "data": {
    "original": 4500,
    "adjusted": 5000,
    "adjustment": 500,
    "reason": "Apply policy correction"
  }
}
```

---

### 6. Resolve Dispute with Recalculation

**Purpose:** Approve dispute and apply salary adjustment  
**Where Used:** Dispute approval workflow  
**Auth Required:** `manage_disputes`

```http
PUT /admin/disputes/{disputeId}/resolution
```

**URL Parameters:**

```
disputeId: disp-123
```

**Request Body:**

```json
{
  "action": "approve",
  "adjustment": 500,
  "reason": "Policy correction applied",
  "notes": "User was entitled to additional benefits",
  "effectiveDate": "2025-01-15"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dispute resolved",
  "data": {
    "_id": "disp-123",
    "status": "resolved",
    "adjustment": 500,
    "newAmount": 5000,
    "resolvedAt": "2025-01-15T10:00:00Z",
    "resolutionTicket": "RES-2025-00123"
  }
}
```

---

### 7. Reject Dispute

**Purpose:** Deny dispute with explanation  
**Where Used:** Dispute denial  
**Auth Required:** `manage_disputes`

```http
POST /admin/disputes/{disputeId}/reject
```

**URL Parameters:**

```
disputeId: disp-123
```

**Request Body:**

```json
{
  "reason": "Salary calculation is correct per policy",
  "explanation": "User received correct amount based on their employment contract and salary policy.",
  "contactInfo": true,
  "notes": "User can appeal within 30 days if they have new evidence"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dispute rejected",
  "data": {
    "_id": "disp-123",
    "status": "rejected",
    "rejectionReason": "Salary calculation is correct...",
    "rejectedAt": "2025-01-15T10:00:00Z",
    "appealDeadline": "2025-02-15T23:59:59Z"
  }
}
```

---

### 8. Approve Dispute Adjustment

**Purpose:** Final approval for adjustment payment  
**Where Used:** Payment processing  
**Auth Required:** `manage_disputes`

```http
PATCH /admin/disputes/{disputeId}/approve
```

**URL Parameters:**

```
disputeId: disp-123
```

**Request Body:**

```json
{
  "paymentMethod": "bank_transfer",
  "paymentDeadline": "2025-01-20",
  "memo": "Dispute resolution adjustment"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Adjustment approved for payment",
  "data": {
    "_id": "disp-123",
    "status": "payment_approved",
    "paymentId": "pay-456",
    "amount": 500,
    "paymentDeadline": "2025-01-20"
  }
}
```

---

### 9. Get My Disputes (User)

**Purpose:** User views their own disputes  
**Where Used:** User account page  
**Auth Required:** User authenticated

```http
GET /disputes/my
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 10
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "disp-123",
      "reason": "Salary miscalculation",
      "amount": 500,
      "status": "resolved",
      "resolvedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 3,
  "resolved": 1,
  "pending": 2
}
```

---

## Alert Management

### 1. List Alerts

**Purpose:** View all system alerts  
**Where Used:** Alert dashboard  
**Auth Required:** `view_alerts`

```http
GET /admin/alerts
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20,
  "status": "active",
  "severity": "high",
  "type": "fraud_detected",
  "referenceType": "user",
  "sort": "-createdAt"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "alert-123",
      "type": "fraud_detected",
      "severity": "high",
      "title": "Suspicious Gift Activity",
      "message": "User user-456 sent 100 gifts in 1 hour",
      "referenceType": "user",
      "referenceId": "user-456",
      "status": "active",
      "acknowledged": false,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 50,
  "active": 12
}
```

---

### 2. Get Alert Details

**Purpose:** View complete alert information  
**Where Used:** Alert detail page  
**Auth Required:** `view_alerts`

```http
GET /admin/alerts/{alertId}
```

**URL Parameters:**

```
alertId: alert-123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "alert-123",
    "type": "fraud_detected",
    "severity": "high",
    "title": "Suspicious Gift Activity",
    "message": "User user-456 sent 100 gifts in 1 hour",
    "metadata": {
      "userId": "user-456",
      "giftCount": 100,
      "timeframe": "1 hour",
      "averageValue": 50
    },
    "status": "active",
    "acknowledged": false,
    "actions": ["acknowledge", "resolve", "investigate"],
    "timeline": [
      {
        "action": "created",
        "timestamp": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

---

### 3. Get Alert Statistics

**Purpose:** Get alert counts and metrics  
**Where Used:** Dashboard widget  
**Auth Required:** `view_alerts`

```http
GET /admin/alerts/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 250,
    "active": 45,
    "resolved": 195,
    "acknowledged": 120,
    "bySeverity": {
      "critical": 5,
      "high": 15,
      "medium": 25,
      "low": 0
    },
    "byType": {
      "fraud_detected": 10,
      "wallet_anomaly": 15,
      "salary_error": 8,
      "system_health": 12
    },
    "oldestAlert": "2025-01-01T10:00:00Z"
  }
}
```

---

### 4. Acknowledge Alert

**Purpose:** Mark alert as seen but not resolved  
**Where Used:** Alert triage  
**Auth Required:** `manage_alerts`

```http
POST /admin/alerts/{alertId}/acknowledge
```

**URL Parameters:**

```
alertId: alert-123
```

**Request Body:**

```json
{
  "note": "Reviewing this alert now"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Alert acknowledged",
  "data": {
    "_id": "alert-123",
    "status": "active",
    "acknowledged": true,
    "acknowledgedAt": "2025-01-15T10:00:00Z",
    "acknowledgedBy": "admin-user-id"
  }
}
```

---

### 5. Resolve Alert

**Purpose:** Mark alert as investigated and resolved  
**Where Used:** Alert closure  
**Auth Required:** `manage_alerts`

```http
POST /admin/alerts/{alertId}/resolve
```

**URL Parameters:**

```
alertId: alert-123
```

**Request Body:**

```json
{
  "note": "False positive - user account has high gift volume legitimately",
  "actions": ["Reviewed account history", "Confirmed account is legitimate"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Alert resolved",
  "data": {
    "_id": "alert-123",
    "status": "resolved",
    "resolvedAt": "2025-01-15T10:00:00Z",
    "resolvedBy": "admin-user-id",
    "resolutionNote": "False positive - user account has high gift volume legitimately"
  }
}
```

---

### 6. Acknowledge Multiple Alerts

**Purpose:** Bulk acknowledge alerts  
**Where Used:** Bulk triage  
**Auth Required:** `manage_alerts`

```http
POST /admin/alerts/acknowledge-multiple
```

**Request Body:**

```json
{
  "alertIds": ["alert-123", "alert-456", "alert-789"],
  "note": "Reviewing batch of alerts"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Multiple alerts acknowledged",
  "data": {
    "acknowledged": 3,
    "failed": 0,
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 7. Delete Batch of Alerts

**Purpose:** Remove old/resolved alerts  
**Where Used:** Database cleanup  
**Auth Required:** `manage_alerts`

```http
DELETE /admin/alerts/batch
```

**Query Parameters:**

```json
{
  "status": "resolved",
  "daysOld": 30
}
```

**Response:**

```json
{
  "success": true,
  "message": "Batch deleted",
  "data": {
    "deleted": 156,
    "criteria": {
      "status": "resolved",
      "olderThan": "2024-12-16T10:00:00Z"
    }
  }
}
```

---

### 8. Get Entity Alerts

**Purpose:** Get all alerts for a specific user/host  
**Where Used:** Entity profile alerts section  
**Auth Required:** `view_alerts`

```http
GET /admin/alerts/entity/{referenceType}/{referenceId}
```

**URL Parameters:**

```
referenceType: user
referenceId: user-456
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "alert-123",
      "type": "fraud_detected",
      "severity": "high",
      "message": "Suspicious gift activity",
      "createdAt": "2025-01-15T10:00:00Z",
      "status": "active"
    }
  ],
  "total": 5,
  "entity": {
    "type": "user",
    "id": "user-456"
  }
}
```

---

## Fraud Detection

### 1. List Fraud Actions

**Purpose:** View all fraud actions with filters  
**Where Used:** Fraud management dashboard  
**Auth Required:** `view_fraud`

```http
GET /admin/fraud
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20,
  "targetType": "user",
  "status": "active",
  "type": "wallet_freeze",
  "sort": "-createdAt"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "fraud-123",
      "type": "wallet_freeze",
      "targetType": "user",
      "targetRef": "user-456",
      "targetName": "Suspicious User",
      "reason": "Multiple charge backs",
      "status": "active",
      "expiresAt": "2025-02-15T10:00:00Z",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 45,
  "active": 32
}
```

---

### 2. Get Fraud Action Details

**Purpose:** View complete fraud action with audit trail  
**Where Used:** Fraud investigation details  
**Auth Required:** `view_fraud`

```http
GET /admin/fraud/{fraudId}
```

**URL Parameters:**

```
fraudId: fraud-123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "fraud-123",
    "type": "wallet_freeze",
    "targetType": "user",
    "targetRef": "user-456",
    "reason": "Multiple charge backs detected",
    "durationHours": 72,
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "expiresAt": "2025-01-18T10:00:00Z",
    "evidence": [
      "3 chargebacks in 24 hours",
      "Same payment method flagged 5 times"
    ],
    "timeline": [
      {
        "action": "created",
        "by": "system",
        "timestamp": "2025-01-15T10:00:00Z"
      },
      {
        "action": "extended",
        "by": "admin-user-id",
        "timestamp": "2025-01-16T10:00:00Z",
        "reason": "Pattern continues"
      }
    ]
  }
}
```

---

### 3. Get Fraud Actions by Target

**Purpose:** Find all fraud actions for a user/host/device  
**Where Used:** Target investigation  
**Auth Required:** `view_fraud`

```http
GET /admin/fraud/target/{targetType}/{targetRef}
```

**URL Parameters:**

```
targetType: user
targetRef: user-456
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "fraud-123",
      "type": "wallet_freeze",
      "status": "active",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    {
      "_id": "fraud-124",
      "type": "gift_block",
      "status": "released",
      "createdAt": "2025-01-10T10:00:00Z"
    }
  ],
  "total": 2,
  "active": 1,
  "released": 1
}
```

---

### 4. Get Fraud Statistics

**Purpose:** Fraud system KPIs  
**Where Used:** Fraud dashboard metrics  
**Auth Required:** `view_fraud`

```http
GET /admin/fraud/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 150,
    "active": 32,
    "released": 105,
    "permanent": 13,
    "byType": {
      "wallet_freeze": 45,
      "gift_block": 55,
      "device_ban": 25,
      "account_suspend": 25
    },
    "avgDuration": "48 hours",
    "thisMonth": 28,
    "detectionRate": 0.98
  }
}
```

---

### 5. Create Manual Fraud Action

**Purpose:** Admin manually creates fraud action  
**Where Used:** Manual fraud enforcement  
**Auth Required:** `manage_fraud`

```http
POST /admin/fraud/manual
```

**Request Body:**

```json
{
  "type": "wallet_freeze",
  "targetType": "user",
  "targetRef": "user-456",
  "durationHours": 48,
  "reason": "Suspected account compromise - multiple chargebacks",
  "evidence": [
    "3 chargebacks in past 24 hours",
    "Unusual transaction pattern",
    "Flagged by manual review"
  ],
  "notes": "Temporarily freeze wallet pending verification"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Fraud action created",
  "data": {
    "_id": "fraud-123",
    "type": "wallet_freeze",
    "targetType": "user",
    "targetRef": "user-456",
    "status": "active",
    "expiresAt": "2025-01-17T10:00:00Z",
    "createdAt": "2025-01-15T10:00:00Z",
    "createdBy": "admin-user-id"
  }
}
```

---

### 6. Release Fraud Action

**Purpose:** Remove fraud restriction early  
**Where Used:** Appeal approval  
**Auth Required:** `manage_fraud`

```http
POST /admin/fraud/{fraudId}/release
```

**URL Parameters:**

```
fraudId: fraud-123
```

**Request Body:**

```json
{
  "reason": "User provided verification documents - account is legitimate"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Fraud action released",
  "data": {
    "_id": "fraud-123",
    "status": "released",
    "releasedAt": "2025-01-16T10:00:00Z",
    "releasedBy": "admin-user-id",
    "releaseReason": "User provided verification documents..."
  }
}
```

---

### 7. Extend Fraud Action

**Purpose:** Extend fraud action duration  
**Where Used:** Pattern continuation  
**Auth Required:** `manage_fraud`

```http
POST /admin/fraud/{fraudId}/extend
```

**URL Parameters:**

```
fraudId: fraud-123
```

**Request Body:**

```json
{
  "durationHours": 48,
  "reason": "Pattern continues - additional suspicious transactions detected"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Fraud action extended",
  "data": {
    "_id": "fraud-123",
    "newExpiry": "2025-01-19T10:00:00Z",
    "extendedBy": 48,
    "extendedAt": "2025-01-17T10:00:00Z",
    "extendedBy": "admin-user-id"
  }
}
```

---

### 8. Convert to Permanent Action

**Purpose:** Make fraud action permanent  
**Where Used:** High-risk accounts  
**Auth Required:** `manage_fraud`

```http
POST /admin/fraud/{fraudId}/permanent
```

**URL Parameters:**

```
fraudId: fraud-123
```

**Request Body:**

```json
{
  "reason": "Account permanently compromised - repeated fraud patterns"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Fraud action converted to permanent",
  "data": {
    "_id": "fraud-123",
    "status": "permanent",
    "convertedAt": "2025-01-17T10:00:00Z",
    "convertedBy": "admin-user-id"
  }
}
```

---

## KPI & Analytics

### 1. Get Dashboard Summary

**Purpose:** High-level platform overview  
**Where Used:** Main admin dashboard  
**Auth Required:** `view_analytics`

```http
GET /admin/kpi/dashboard
```

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "activeUsers": 1250,
      "activeHosts": 340,
      "activeAgencies": 45,
      "totalWallet": 5000000
    },
    "financials": {
      "monthlyRevenue": 150000,
      "totalSalariesPaid": 250000,
      "pendingSalaries": 45000,
      "commissions": 23500
    },
    "alerts": {
      "total": 45,
      "critical": 2,
      "high": 8
    },
    "disputes": {
      "pending": 12,
      "resolved": 145,
      "rejectedMonth": 25
    },
    "gifts": {
      "dailyVolume": 5000,
      "monthlyTotal": 150000,
      "averageValue": 30
    }
  }
}
```

---

### 2. Get System Health

**Purpose:** System status and health indicators  
**Where Used:** Operations monitoring  
**Auth Required:** `view_analytics`

```http
GET /admin/kpi/system-health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "healthScore": 95,
    "components": {
      "database": "healthy",
      "redis": "healthy",
      "emailQueue": "healthy",
      "cronJobs": "healthy"
    },
    "lastCheck": "2025-01-15T10:00:00Z",
    "criticalIssues": [
      {
        "component": "salary_processing",
        "issue": "Cycle cy-2025-01 stuck in processing",
        "severity": "critical",
        "suggestedAction": "Run manual recalculation"
      }
    ],
    "warnings": [
      {
        "component": "wallet_balance",
        "issue": "3 wallets have mismatched balances",
        "severity": "warning"
      }
    ]
  }
}
```

---

### 3. Get Wallet Health

**Purpose:** Wallet balance and lock status metrics  
**Where Used:** Wallet monitoring  
**Auth Required:** `view_analytics`

```http
GET /admin/kpi/wallet-health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalBalance": 5000000,
    "locked": 250000,
    "withdrawable": 4750000,
    "distribution": {
      "byRange": {
        "0-1000": 450,
        "1000-5000": 350,
        "5000-10000": 250,
        "10000+": 200
      }
    },
    "mismatches": 3,
    "topWallets": [
      {
        "userId": "user-456",
        "balance": 50000
      }
    ],
    "locked_wallets": {
      "temporary": 15,
      "permanent": 2
    }
  }
}
```

---

### 4. Get Salary Cycle Health

**Purpose:** Salary processing status and anomalies  
**Where Used:** Salary operations  
**Auth Required:** `view_analytics`

```http
GET /admin/kpi/salary-cycle-health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "byStatus": {
      "pending": 2,
      "processing": 1,
      "completed": 12,
      "failed": 0
    },
    "zeroSalaries": [
      {
        "userId": "user-789",
        "cycleId": "cy-2025-01",
        "reason": "No activity"
      }
    ],
    "recentCycles": [
      {
        "_id": "cy-2025-01",
        "period": "2025-01",
        "status": "completed",
        "totalAmount": 250000,
        "processedUsers": 50
      }
    ],
    "stuckCycles": [],
    "averageSalary": 5000,
    "totalDistributed": 6250000
  }
}
```

---

### 5. Get Gift Anomalies

**Purpose:** Detect gift velocity and loop patterns  
**Where Used:** Fraud prevention  
**Auth Required:** `view_analytics`

```http
GET /admin/kpi/gift-anomalies
```

**Response:**

```json
{
  "success": true,
  "data": {
    "highVolumeSenders": [
      {
        "userId": "user-123",
        "giftCount": 500,
        "totalValue": 15000,
        "period": "24h",
        "status": "flagged"
      }
    ],
    "giftLoops": [
      {
        "users": ["user-123", "user-456"],
        "giftCount": 100,
        "totalValue": 5000,
        "pattern": "circular"
      }
    ],
    "receiverSpikes": [
      {
        "userId": "user-789",
        "giftCount": 200,
        "period": "24h",
        "previousAverage": 10
      }
    ],
    "trend": {
      "daily": 5000,
      "weekly": 35000,
      "monthly": 150000,
      "avgValue": 30
    }
  }
}
```

---

## Queue Management

### 1. Get Queue Statistics

**Purpose:** View queue status and metrics  
**Where Used:** Background job monitoring  
**Auth Required:** `manage_queues`

```http
GET /admin/queues/stats
```

**Response:**

```json
{
  "success": true,
  "queues": [
    {
      "name": "email-queue",
      "waiting": 45,
      "active": 5,
      "completed": 2345,
      "failed": 12,
      "delayed": 0,
      "health": "healthy"
    },
    {
      "name": "salary-queue",
      "waiting": 0,
      "active": 0,
      "completed": 250,
      "failed": 0,
      "delayed": 0,
      "health": "healthy"
    },
    {
      "name": "notification-queue",
      "waiting": 120,
      "active": 10,
      "completed": 5000,
      "failed": 45,
      "delayed": 0,
      "health": "warning"
    }
  ]
}
```

---

### 2. Get Queue Jobs

**Purpose:** List jobs in a specific queue  
**Where Used:** Job debugging  
**Auth Required:** `manage_queues`

```http
GET /admin/queues/{queueName}/jobs
```

**URL Parameters:**

```
queueName: email-queue
```

**Query Parameters:**

```json
{
  "status": "waiting",
  "limit": 20,
  "start": 0
}
```

**Response:**

```json
{
  "success": true,
  "queueName": "email-queue",
  "status": "waiting",
  "jobs": [
    {
      "id": "job-123",
      "data": {
        "to": "user@example.com",
        "subject": "Salary Notification",
        "template": "salary_alert"
      },
      "status": "waiting",
      "attemptsMade": 0,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 45
}
```

---

### 3. Retry Failed Jobs

**Purpose:** Reprocess failed queue jobs  
**Where Used:** Job recovery  
**Auth Required:** `manage_queues`

```http
POST /admin/queues/{queueName}/retry
```

**URL Parameters:**

```
queueName: email-queue
```

**Request Body:**

```json
{
  "jobIds": ["job-123", "job-456"],
  "reason": "Server recovered - retry failed jobs"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Jobs requeued",
  "data": {
    "retried": 2,
    "failed": 0,
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 4. Clear Queue

**Purpose:** Remove all jobs from queue  
**Where Used:** Queue reset  
**Auth Required:** `manage_queues`

```http
POST /admin/queues/{queueName}/clear
```

**URL Parameters:**

```
queueName: email-queue
```

**Request Body:**

```json
{
  "confirmation": true,
  "reason": "Clearing stale jobs before maintenance"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Queue cleared",
  "data": {
    "cleared": 156,
    "queueName": "email-queue",
    "timestamp": "2025-01-15T10:00:00Z"
  }
}
```

---

### 5. Process Queue

**Purpose:** Manually trigger queue processing  
**Where Used:** Manual job triggering  
**Auth Required:** `manage_queues`

```http
POST /admin/queues/{queueName}/process
```

**URL Parameters:**

```
queueName: salary-queue
```

**Request Body:**

```json
{
  "concurrency": 5
}
```

**Response:**

```json
{
  "success": true,
  "message": "Queue processing started",
  "data": {
    "queueName": "salary-queue",
    "concurrency": 5,
    "startedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 6. Delete Job

**Purpose:** Remove a specific job from queue  
**Where Used:** Job cleanup  
**Auth Required:** `manage_queues`

```http
DELETE /admin/queues/{queueName}/jobs/{jobId}
```

**URL Parameters:**

```
queueName: email-queue
jobId: job-123
```

**Response:**

```json
{
  "success": true,
  "message": "Job deleted",
  "data": {
    "jobId": "job-123",
    "queueName": "email-queue",
    "deletedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 7. Get Specific Job Details

**Purpose:** View complete job information  
**Where Used:** Job investigation  
**Auth Required:** `manage_queues`

```http
GET /admin/queues/{queueName}/jobs/{jobId}
```

**URL Parameters:**

```
queueName: email-queue
jobId: job-123
```

**Response:**

```json
{
  "success": true,
  "job": {
    "id": "job-123",
    "queueName": "email-queue",
    "data": {
      "to": "user@example.com",
      "subject": "Salary Notification",
      "template": "salary_alert"
    },
    "status": "waiting",
    "progress": 0,
    "attemptsMade": 0,
    "failedReason": null,
    "createdAt": "2025-01-15T10:00:00Z",
    "finishedAt": null
  }
}
```

---

### 8. Get Queue Stats by Name

**Purpose:** Specific queue metrics  
**Where Used:** Queue health monitoring  
**Auth Required:** `manage_queues`

```http
GET /admin/queues/{queueName}/stats
```

**URL Parameters:**

```
queueName: email-queue
```

**Response:**

```json
{
  "success": true,
  "queue": {
    "name": "email-queue",
    "waiting": 45,
    "active": 5,
    "completed": 2345,
    "failed": 12,
    "delayed": 0,
    "health": "healthy",
    "avgProcessingTime": "2s",
    "successRate": 0.994
  }
}
```

---

### 9. Get All Queues

**Purpose:** List all available queues  
**Where Used:** Queue overview  
**Auth Required:** `manage_queues`

```http
GET /admin/queues
```

**Response:**

```json
{
  "success": true,
  "queues": [
    {
      "name": "email-queue",
      "jobs": 50,
      "health": "healthy"
    },
    {
      "name": "salary-queue",
      "jobs": 0,
      "health": "healthy"
    },
    {
      "name": "notification-queue",
      "jobs": 130,
      "health": "warning"
    }
  ],
  "total": 3
}
```

---

## Policy Configuration

### 1. List Host Salary Policies

**Purpose:** View all host salary policies  
**Where Used:** Policy management  
**Auth Required:** `view_policies`

```http
GET /admin/policies/salary
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20,
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "policy-123",
      "name": "Standard Host Salary",
      "type": "percentage",
      "value": 0.8,
      "description": "80% of gift value to host",
      "effectiveFrom": "2025-01-01",
      "effectiveUntil": null,
      "status": "active",
      "createdAt": "2024-12-01T10:00:00Z"
    }
  ],
  "total": 5,
  "active": 4
}
```

---

### 2. Get Policy Details

**Purpose:** View specific policy with all details  
**Where Used:** Policy review  
**Auth Required:** `view_policies`

```http
GET /admin/policies/salary/{policyId}
```

**URL Parameters:**

```
policyId: policy-123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "policy-123",
    "name": "Standard Host Salary",
    "type": "percentage",
    "value": 0.8,
    "description": "80% of gift value to host",
    "minAmount": 100,
    "maxAmount": 10000,
    "effectiveFrom": "2025-01-01",
    "effectiveUntil": null,
    "status": "active",
    "appliesTo": "all_hosts",
    "createdAt": "2024-12-01T10:00:00Z",
    "updatedAt": "2024-12-01T10:00:00Z",
    "history": [
      {
        "action": "created",
        "timestamp": "2024-12-01T10:00:00Z",
        "by": "admin-user-id"
      }
    ]
  }
}
```

---

### 3. Create Host Salary Policy

**Purpose:** Define new host salary calculation policy  
**Where Used:** Policy creation  
**Auth Required:** `manage_policies`

```http
POST /admin/policies/salary
```

**Request Body:**

```json
{
  "name": "Premium Host Bonus",
  "type": "percentage",
  "value": 0.85,
  "description": "85% of gift value for hosts with 500+ gifts",
  "minAmount": 100,
  "maxAmount": 50000,
  "effectiveFrom": "2025-02-01",
  "appliesTo": "premium_hosts",
  "conditions": {
    "minimumGifts": 500,
    "minimumRating": 4.5
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Policy created",
  "data": {
    "_id": "policy-124",
    "name": "Premium Host Bonus",
    "type": "percentage",
    "value": 0.85,
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 4. Update Host Salary Policy

**Purpose:** Modify existing policy  
**Where Used:** Policy adjustment  
**Auth Required:** `manage_policies`

```http
PUT /admin/policies/salary/{policyId}
```

**URL Parameters:**

```
policyId: policy-123
```

**Request Body:**

```json
{
  "value": 0.82,
  "effectiveFrom": "2025-02-01",
  "reason": "Market rate adjustment"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Policy updated",
  "data": {
    "_id": "policy-123",
    "value": 0.82,
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 5. Delete Policy

**Purpose:** Deactivate/remove a policy  
**Where Used:** Policy cleanup  
**Auth Required:** `manage_policies`

```http
DELETE /admin/policies/salary/{policyId}
```

**URL Parameters:**

```
policyId: policy-123
```

**Request Body:**

```json
{
  "reason": "Policy no longer needed",
  "effectiveUntil": "2025-02-01"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Policy deleted",
  "data": {
    "_id": "policy-123",
    "status": "inactive",
    "deletedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 6. List Agency Commission Policies

**Purpose:** View all agency commission policies  
**Where Used:** Commission management  
**Auth Required:** `view_policies`

```http
GET /admin/policies/commission
```

**Query Parameters:**

```json
{
  "page": 1,
  "limit": 20
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "comm-policy-123",
      "name": "Standard Agency Commission",
      "type": "percentage",
      "value": 0.15,
      "description": "15% of host salary to agency",
      "status": "active"
    }
  ],
  "total": 3
}
```

---

### 7. Get Commission Policy Details

**Purpose:** View specific commission policy  
**Where Used:** Policy review  
**Auth Required:** `view_policies`

```http
GET /admin/policies/commission/{policyId}
```

**URL Parameters:**

```
policyId: comm-policy-123
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "comm-policy-123",
    "name": "Standard Agency Commission",
    "type": "percentage",
    "value": 0.15,
    "description": "15% of host salary to agency",
    "minAmount": 1000,
    "maxAmount": 100000,
    "effectiveFrom": "2025-01-01",
    "status": "active"
  }
}
```

---

### 8. Create Commission Policy

**Purpose:** Define new agency commission policy  
**Where Used:** Commission setup  
**Auth Required:** `manage_policies`

```http
POST /admin/policies/commission
```

**Request Body:**

```json
{
  "name": "Premium Agency Commission",
  "type": "percentage",
  "value": 0.18,
  "description": "18% for high-volume agencies",
  "minAmount": 5000,
  "maxAmount": 200000,
  "effectiveFrom": "2025-02-01",
  "appliesTo": "premium_agencies"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Commission policy created",
  "data": {
    "_id": "comm-policy-124",
    "name": "Premium Agency Commission",
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 9. Update Commission Policy

**Purpose:** Modify agency commission policy  
**Where Used:** Commission adjustment  
**Auth Required:** `manage_policies`

```http
PUT /admin/policies/commission/{policyId}
```

**URL Parameters:**

```
policyId: comm-policy-123
```

**Request Body:**

```json
{
  "value": 0.16,
  "reason": "Quarterly adjustment"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Commission policy updated",
  "data": {
    "_id": "comm-policy-123",
    "value": 0.16,
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

## Error Handling

### Common Error Responses

**400 - Bad Request**

```json
{
  "success": false,
  "error": "Invalid request parameters",
  "details": {
    "field": "email",
    "message": "Email format is invalid"
  }
}
```

**401 - Unauthorized**

```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid JWT token"
}
```

**403 - Forbidden**

```json
{
  "success": false,
  "error": "Permission denied",
  "message": "You don't have permission to access this resource"
}
```

**404 - Not Found**

```json
{
  "success": false,
  "error": "Resource not found",
  "message": "The requested salary record does not exist"
}
```

**500 - Server Error**

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Something went wrong on our end"
}
```

---

## Rate Limiting

- **Limit:** 100 requests per minute per user
- **Header:** `X-RateLimit-Remaining`
- **Reset:** Every minute

---

## Pagination

Standard pagination for list endpoints:

```json
{
  "page": 1,
  "limit": 20,
  "total": 150,
  "pages": 8
}
```

---

## Sorting

Use `sort` query parameter with `-` prefix for descending:

```
GET /admin/salary?sort=-createdAt
GET /admin/disputes?sort=status&order=asc
```

---

## Support & Contact

- **Documentation:** See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Status:** All 61 endpoints tested and working
- **Last Updated:** December 31, 2025

---

**Made with ❤️ for UseFuns Platform**
