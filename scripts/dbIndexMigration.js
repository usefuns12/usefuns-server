const mongoose = require("mongoose");
require("dotenv").config();

/**
 * STEP 7.1 - Database Index Migration & Audit
 *
 * This script:
 * 1. Audits existing indexes
 * 2. Creates missing compound indexes for hot query paths
 * 3. Reports collection statistics
 *
 * Run: node scripts/dbIndexMigration.js
 */

const collections = [
  {
    name: "gifttransactions",
    indexes: [
      { roomId: 1, createdAt: -1 }, // Gift history by room
      { sender: 1, createdAt: -1 }, // Gifts sent by user
      { receiver: 1, createdAt: -1 }, // Gifts received by host
      { createdAt: -1 }, // Recent gifts (for fraud detection)
      { sender: 1, receiver: 1, createdAt: -1 }, // Gift patterns (for loop detection)
    ],
    reason: "High-frequency queries for gift fraud detection & reports",
  },
  {
    name: "hostsalarycycles",
    indexes: [
      { hostId: 1, cycleStart: 1 }, // Get cycles for specific host
      { hostId: 1, status: 1 }, // Active/pending cycles
      { status: 1, cycleEnd: -1 }, // Processing pending cycles
      { cycleStart: -1 }, // Recent cycles
    ],
    reason: "Salary calculation & anomaly detection queries",
  },
  {
    name: "agencycommissioncycles",
    indexes: [
      { agencyId: 1, cycleStart: 1 }, // Get cycles for specific agency
      { agencyId: 1, status: 1 }, // Active/pending cycles
      { status: 1, cycleEnd: -1 }, // Processing pending cycles
    ],
    reason: "Commission calculation & reporting",
  },
  {
    name: "alerts",
    indexes: [
      { status: 1, createdAt: -1 }, // Open alerts (admin dashboard)
      { type: 1, severity: 1, status: 1 }, // Filter by type/severity
      { referenceType: 1, referenceId: 1 }, // Alerts for specific entity
      { deduplicationKey: 1 }, // Avoid duplicate alerts
      { type: 1, createdAt: -1 }, // Alert counting for fraud rules
      { createdAt: -1 }, // Recent alerts listing
    ],
    reason: "Alert dashboard & fraud rule triggers (STEP 5 & 6)",
  },
  {
    name: "fraudactions",
    indexes: [
      { targetType: 1, targetRef: 1, status: 1 }, // Check if target blocked
      { deviceFingerprint: 1, status: 1 }, // Device ban lookup
      { status: 1, expiresAt: 1 }, // Expired actions (scheduler)
      { createdAt: -1, status: 1 }, // Recent actions (audit)
      { triggeredByAlert: 1 }, // Alert → action lookup
      { isDeleted: 1, status: 1 }, // Active actions only
    ],
    reason: "Fraud enforcement checks (STEP 6)",
  },
  {
    name: "transactions",
    indexes: [
      { userId: 1, createdAt: -1 }, // User transaction history
      { walletId: 1, createdAt: -1 }, // Wallet transaction history
      { type: 1, createdAt: -1 }, // Filter by transaction type
      { status: 1, createdAt: -1 }, // Pending/completed transactions
      { createdAt: -1 }, // Recent transactions
    ],
    reason: "Wallet reconciliation & transaction reporting",
  },
  {
    name: "wallets",
    indexes: [
      { userId: 1 }, // Get wallet by user (unique)
      { status: 1 }, // Locked/unlocked wallets
      { balance: -1 }, // High balance wallets (for admin)
      { updatedAt: -1 }, // Recently updated wallets
    ],
    reason: "Wallet operations & fraud detection",
  },
  {
    name: "users",
    indexes: [
      { mobile: 1 }, // Login lookup (unique)
      { email: 1 }, // Email lookup
      { deviceFingerprint: 1 }, // Device ban checks
      { createdAt: -1 }, // Recent signups
      { status: 1 }, // Active/banned users
    ],
    reason: "Auth & user management",
  },
  {
    name: "hosts",
    indexes: [
      { userId: 1 }, // User → Host lookup
      { agencyId: 1, status: 1 }, // Agency's hosts
      { status: 1, createdAt: -1 }, // Active hosts
      { rating: -1 }, // Top-rated hosts
    ],
    reason: "Host management & salary processing",
  },
  {
    name: "disputes",
    indexes: [
      { userId: 1, status: 1 }, // User disputes
      { relatedEntity: 1, relatedEntityId: 1 }, // Disputes for transaction/gift
      { status: 1, createdAt: -1 }, // Open disputes
      { assignedTo: 1, status: 1 }, // Admin assignment
      { createdAt: -1 }, // Recent disputes
    ],
    reason: "Dispute resolution workflow",
  },
];

async function connectDB() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/usefuns",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function auditAndCreateIndexes() {
  console.log("\n🔍 Starting Database Index Audit...\n");

  for (const collectionConfig of collections) {
    const { name, indexes, reason } = collectionConfig;

    try {
      // Check if collection exists
      const collectionExists = await mongoose.connection.db
        .listCollections({ name })
        .hasNext();

      if (!collectionExists) {
        console.log(`⏭️  Collection "${name}" does not exist - skipping`);
        continue;
      }

      console.log(`\n📦 Collection: ${name}`);
      console.log(`   Reason: ${reason}`);

      // Get existing indexes
      const collection = mongoose.connection.db.collection(name);
      const existingIndexes = await collection.indexes();

      console.log(`   Existing indexes: ${existingIndexes.length}`);

      // Create missing indexes
      let createdCount = 0;
      for (const indexSpec of indexes) {
        try {
          // Check if this exact index exists
          const indexExists = existingIndexes.some((existing) => {
            const existingKeys = Object.keys(existing.key).sort().join(",");
            const specKeys = Object.keys(indexSpec).sort().join(",");
            return existingKeys === specKeys;
          });

          if (!indexExists) {
            await collection.createIndex(indexSpec);
            console.log(`   ✅ Created index: ${JSON.stringify(indexSpec)}`);
            createdCount++;
          }
        } catch (indexError) {
          console.log(
            `   ⚠️  Index already exists or error: ${indexError.message}`
          );
        }
      }

      if (createdCount === 0) {
        console.log(`   ✓ All indexes already exist`);
      }

      // Get collection stats
      const stats = await collection.stats();
      console.log(`   Documents: ${stats.count.toLocaleString()}`);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `   Avg Doc Size: ${(stats.avgObjSize / 1024).toFixed(2)} KB`
      );
    } catch (error) {
      console.error(`   ❌ Error processing ${name}:`, error.message);
    }
  }

  console.log("\n✅ Index audit complete!\n");
}

async function reportSlowQueries() {
  console.log("\n📊 Checking for potential slow queries...\n");

  // Check large collections without proper indexes
  const db = mongoose.connection.db;

  for (const collectionConfig of collections) {
    const { name } = collectionConfig;

    try {
      const collection = db.collection(name);
      const stats = await collection.stats();

      // Flag collections > 100k docs
      if (stats.count > 100000) {
        console.log(
          `⚠️  Large collection: ${name} (${stats.count.toLocaleString()} docs)`
        );
        console.log(`   Consider archival or partitioning`);
      }

      // Flag collections > 100 MB
      if (stats.size > 100 * 1024 * 1024) {
        console.log(
          `⚠️  Large size: ${name} (${(stats.size / 1024 / 1024).toFixed(
            2
          )} MB)`
        );
        console.log(`   Consider archival strategy`);
      }
    } catch (error) {
      // Collection doesn't exist - skip
    }
  }

  console.log("\n");
}

async function run() {
  await connectDB();
  await auditAndCreateIndexes();
  await reportSlowQueries();

  console.log("✅ Database optimization complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Monitor slow query logs");
  console.log("   2. Setup archival for large collections");
  console.log("   3. Run explain() on critical queries");
  console.log("   4. Consider read replicas for reporting\n");

  await mongoose.connection.close();
  process.exit(0);
}

// Run migration
if (require.main === module) {
  run().catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
}

module.exports = { auditAndCreateIndexes, reportSlowQueries };
