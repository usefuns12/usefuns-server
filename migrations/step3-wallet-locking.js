/**
 * 🔄 STEP 3 Migration Script
 *
 * Migrates existing wallets to use locked/withdrawable balance split
 * Run this ONCE after deploying STEP 3 changes
 *
 * Usage: node migrations/step3-wallet-locking.js
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Policy = require("../models/Policy");

async function migrateWallets() {
  try {
    console.log("🔄 Starting STEP 3 wallet migration...\n");

    // Connect to database
    await mongoose.connect(process.env.MONGO_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });

    console.log("✅ Database connected\n");

    // STEP 1: Add unlockRules to Policy if not exists
    console.log("📋 STEP 1: Updating Policy document...");

    const policy = await Policy.findOneAndUpdate(
      { type: "hostSalary" },
      {
        $setOnInsert: {
          "hostSalary.unlockRules": {
            lockDays: 3,
            autoUnlock: true,
          },
        },
      },
      { upsert: true, new: true }
    );

    console.log(
      `✅ Policy updated: lockDays = ${
        policy.hostSalary?.unlockRules?.lockDays || "NOT SET"
      }\n`
    );

    // STEP 2: Migrate existing wallets
    console.log("💰 STEP 2: Migrating existing wallets...");

    const wallets = await Wallet.find({
      $or: [
        { lockedUcoins: { $exists: false } },
        { withdrawableUcoins: { $exists: false } },
      ],
    });

    console.log(`Found ${wallets.length} wallets to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const wallet of wallets) {
      try {
        // Decision: Put all existing ucoins into withdrawableUcoins
        // (Since these are pre-existing, not subject to new lock rules)
        const currentUcoins = wallet.ucoins || 0;

        wallet.lockedUcoins = wallet.lockedUcoins || 0;
        wallet.withdrawableUcoins = wallet.withdrawableUcoins || currentUcoins;

        await wallet.save();

        migrated++;
        console.log(
          `✅ Migrated wallet ${wallet.userId}: ${currentUcoins} U-coins → withdrawable`
        );
      } catch (error) {
        skipped++;
        console.error(
          `❌ Failed to migrate wallet ${wallet.userId}:`,
          error.message
        );
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total wallets: ${wallets.length}`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ❌ Skipped: ${skipped}`);

    // STEP 3: Verify data integrity
    console.log(`\n🔍 STEP 3: Verifying wallet balance integrity...`);

    const allWallets = await Wallet.find({});
    let integrityIssues = 0;

    for (const wallet of allWallets) {
      const total = wallet.ucoins || 0;
      const locked = wallet.lockedUcoins || 0;
      const withdrawable = wallet.withdrawableUcoins || 0;
      const expected = locked + withdrawable;

      if (Math.abs(total - expected) > 0.01) {
        // Allow small floating point differences
        console.error(
          `⚠️ Integrity issue: Wallet ${wallet.userId}: total=${total}, locked=${locked}, withdrawable=${withdrawable}, expected=${expected}`
        );
        integrityIssues++;
      }
    }

    if (integrityIssues === 0) {
      console.log(
        `✅ All ${allWallets.length} wallets have correct balance integrity\n`
      );
    } else {
      console.log(
        `\n⚠️ Found ${integrityIssues} wallets with integrity issues - manual review required\n`
      );
    }

    console.log("✅ Migration complete!\n");
    console.log("📌 Next steps:");
    console.log("   1. Deploy updated code");
    console.log("   2. Monitor wallet unlock cron (runs daily at 2 AM)");
    console.log("   3. Update withdrawal UI to show locked vs withdrawable");
    console.log(
      "   4. Integrate checkWithdrawalEligibility() into withdrawal flow\n"
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateWallets();
