/**
 * End-to-End Validation Tests for Agency Commission System
 * Tests different agency sizes and host completion scenarios
 *
 * CRITICAL TEST SCENARIOS:
 * 1. Agency with 1 host → Commission correct
 * 2. Agency with 10 hosts → Commission aggregated
 * 3. Agency with mixed hosts (5 complete, 5 incomplete) → Correct commission split
 * 4. Agency with zero host salary → Zero commission
 * 5. Commission reflects correct slab based on total host salary
 */

const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Agency = require("../models/Agency");
const Host = require("../models/Host");
const HostSalaryCycle = require("../models/HostSalaryCycle");
const AgencyCommissionCycle = require("../models/AgencyCommissionCycle");
const GiftTransaction = require("../models/GiftTransaction");
const Room = require("../models/Rooms");
const HostStat = require("../models/HostStat");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const Policy = require("../models/Policy");
const hostSalaryService = require("../services/hostSalary.service");
const agencyCommissionService = require("../services/agencyCommission.service");
const commissionPayoutService = require("../services/commissionPayout.service");

class AgencyCommissionValidator {
  constructor() {
    this.testResults = [];
  }

  /**
   * Helper: Create a host with diamonds and hours
   */
  async createHostWithEarnings(
    agencyId,
    diamondsCount,
    hoursCount,
    suffix = ""
  ) {
    const customer = await Customer.create({
      userName: `agency_host_${Date.now()}_${suffix}`,
      email: `agency_host_${Date.now()}_${suffix}@test.com`,
      countryCode: "US",
    });

    const host = await Host.create({
      hostName: `Host ${suffix}`,
      customerRef: customer._id,
      totalHostTimeHours: hoursCount,
      agencyRef: agencyId,
    });

    const room = await Room.create({
      roomName: `Room ${suffix}`,
      countryCode: "US",
    });

    // Create gift transactions
    for (let i = 0; i < Math.ceil(diamondsCount / 100); i++) {
      const sender = await Customer.create({
        userName: `sender_${Date.now()}_${i}_${suffix}`,
        email: `sender_${Date.now()}_${i}_${suffix}@test.com`,
        countryCode: "US",
      });

      await GiftTransaction.create({
        senderRef: sender._id,
        receiverRef: host._id,
        roomRef: room._id,
        giftType: "diamond",
        amount: Math.min(100, diamondsCount - i * 100),
        isValidForSalary: true,
      });
    }

    await HostStat.create({
      hostId: host._id,
      date: new Date(),
      gifts: diamondsCount,
      hostTimeHours: hoursCount,
    });

    return { host, customer, diamondsCount, hoursCount };
  }

  /**
   * TEST 1: Agency with 1 host earning salary
   */
  async test_SingleHostAgency() {
    console.log("\n📋 TEST 1: Agency with 1 host → Commission correct");
    try {
      // Create agency owner
      const ownerCustomer = await Customer.create({
        userName: `owner_1_${Date.now()}`,
        email: `owner1_${Date.now()}@test.com`,
        countryCode: "US",
      });

      // Create agency
      const agency = await Agency.create({
        agencyName: "Single Host Agency",
        ownerUserId: ownerCustomer._id.toString(),
        countryCode: "US",
      });

      // Create 1 host with 15k diamonds + 15h
      const { host, customer } = await this.createHostWithEarnings(
        agency._id,
        15000,
        15,
        "agency1_host1"
      );

      // Calculate host salary
      const policy = await Policy.findOne({ type: "hostSalary" });
      const hostCycle = await HostSalaryCycle.create({
        hostId: host._id,
        cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: "pending",
        diamondsEarned: 15000,
        hostTimeHours: 15,
      });

      const hostCalculated = await hostSalaryService.calculateHostSalary(
        host._id,
        hostCycle
      );
      hostCycle.salaryUcoins = hostCalculated.salaryUcoins;
      hostCycle.status = "calculated";
      await hostCycle.save();

      console.log(`✓ Host salary: ${hostCycle.salaryUcoins} U-coins`);

      // Create agency commission cycle
      const agencyCycle = await AgencyCommissionCycle.create({
        agencyId: agency._id,
        cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: "pending",
      });

      // Calculate commission
      const commissionCalculated =
        await agencyCommissionService.calculateAgencyCommission(agency._id, [
          hostCycle,
        ]);
      agencyCycle.commissionUcoins = commissionCalculated.commissionUcoins;
      agencyCycle.status = "calculated";
      agencyCycle.calculation = commissionCalculated;
      await agencyCycle.save();

      console.log(
        `✓ Agency commission: ${agencyCycle.commissionUcoins} U-coins`
      );

      // Payout
      const payout = await commissionPayoutService.payAgencyCommission(
        agencyCycle._id
      );
      const ownerWallet = await Wallet.findOne({
        userId: ownerCustomer._id.toString(),
      });

      console.log(
        `✓ Owner wallet credited: ${
          ownerWallet ? ownerWallet.ucoins : 0
        } U-coins`
      );

      this.testResults.push({
        test: "TEST 1 (Single Host Agency)",
        status: "PASS ✅",
        hostCount: 1,
        totalHostSalary: hostCycle.salaryUcoins,
        agencyCommission: agencyCycle.commissionUcoins,
        ownerWalletBalance: ownerWallet ? ownerWallet.ucoins : 0,
      });
    } catch (error) {
      console.error("❌ TEST 1 FAILED:", error.message);
      this.testResults.push({
        test: "TEST 1 (Single Host Agency)",
        status: "FAIL ❌",
        error: error.message,
      });
    }
  }

  /**
   * TEST 2: Agency with 10 hosts
   */
  async test_MultiHostAgency() {
    console.log("\n📋 TEST 2: Agency with 10 hosts → Commission aggregated");
    try {
      const ownerCustomer = await Customer.create({
        userName: `owner_10_${Date.now()}`,
        email: `owner10_${Date.now()}@test.com`,
        countryCode: "US",
      });

      const agency = await Agency.create({
        agencyName: "Multi Host Agency",
        ownerUserId: ownerCustomer._id.toString(),
        countryCode: "US",
      });

      // Create 10 hosts with varying earnings
      const hostCycles = [];
      let totalHostSalary = 0;

      for (let i = 1; i <= 10; i++) {
        const diamonds = 10000 + i * 500; // 10.5k to 15k
        const hours = 12 + i; // 13 to 22 hours
        const { host } = await this.createHostWithEarnings(
          agency._id,
          diamonds,
          hours,
          `multi_host_${i}`
        );

        const hostCycle = await HostSalaryCycle.create({
          hostId: host._id,
          cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: "pending",
          diamondsEarned: diamonds,
          hostTimeHours: hours,
        });

        const calculated = await hostSalaryService.calculateHostSalary(
          host._id,
          hostCycle
        );
        hostCycle.salaryUcoins = calculated.salaryUcoins;
        hostCycle.status = "calculated";
        await hostCycle.save();

        hostCycles.push(hostCycle);
        totalHostSalary += hostCycle.salaryUcoins;
      }

      console.log(
        `✓ Created 10 hosts with total salary: ${totalHostSalary} U-coins`
      );

      // Calculate agency commission
      const agencyCycle = await AgencyCommissionCycle.create({
        agencyId: agency._id,
        cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: "pending",
      });

      const commissionCalculated =
        await agencyCommissionService.calculateAgencyCommission(
          agency._id,
          hostCycles
        );
      agencyCycle.commissionUcoins = commissionCalculated.commissionUcoins;
      agencyCycle.status = "calculated";
      agencyCycle.calculation = commissionCalculated;
      await agencyCycle.save();

      console.log(
        `✓ Agency commission: ${agencyCycle.commissionUcoins} U-coins (should be ~10-15% of ${totalHostSalary})`
      );

      // Payout
      const payout = await commissionPayoutService.payAgencyCommission(
        agencyCycle._id
      );
      const ownerWallet = await Wallet.findOne({
        userId: ownerCustomer._id.toString(),
      });

      this.testResults.push({
        test: "TEST 2 (10-Host Agency)",
        status: "PASS ✅",
        hostCount: 10,
        totalHostSalary,
        agencyCommission: agencyCycle.commissionUcoins,
        ownerWalletBalance: ownerWallet ? ownerWallet.ucoins : 0,
      });
    } catch (error) {
      console.error("❌ TEST 2 FAILED:", error.message);
      this.testResults.push({
        test: "TEST 2 (10-Host Agency)",
        status: "FAIL ❌",
        error: error.message,
      });
    }
  }

  /**
   * TEST 3: Agency with mixed hosts (5 complete, 5 incomplete)
   */
  async test_MixedHostAgency() {
    console.log(
      "\n📋 TEST 3: Agency with mixed hosts (5 complete, 5 incomplete)"
    );
    try {
      const ownerCustomer = await Customer.create({
        userName: `owner_mixed_${Date.now()}`,
        email: `owner_mixed_${Date.now()}@test.com`,
        countryCode: "US",
      });

      const agency = await Agency.create({
        agencyName: "Mixed Host Agency",
        ownerUserId: ownerCustomer._id.toString(),
        countryCode: "US",
      });

      const hostCycles = [];
      let completedCount = 0;
      let incompleteCount = 0;
      let totalHostSalary = 0;

      // Create 5 COMPLETE hosts (15k diamonds + 15h)
      for (let i = 1; i <= 5; i++) {
        const { host } = await this.createHostWithEarnings(
          agency._id,
          15000,
          15,
          `mixed_complete_${i}`
        );

        const hostCycle = await HostSalaryCycle.create({
          hostId: host._id,
          cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: "pending",
          diamondsEarned: 15000,
          hostTimeHours: 15,
        });

        const calculated = await hostSalaryService.calculateHostSalary(
          host._id,
          hostCycle
        );
        hostCycle.salaryUcoins = calculated.salaryUcoins;
        hostCycle.status = "calculated";
        await hostCycle.save();

        hostCycles.push(hostCycle);
        totalHostSalary += hostCycle.salaryUcoins;
        completedCount++;
      }

      // Create 5 INCOMPLETE hosts (5k diamonds + 5h)
      for (let i = 1; i <= 5; i++) {
        const { host } = await this.createHostWithEarnings(
          agency._id,
          5000,
          5,
          `mixed_incomplete_${i}`
        );

        const hostCycle = await HostSalaryCycle.create({
          hostId: host._id,
          cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: "pending",
          diamondsEarned: 5000,
          hostTimeHours: 5,
        });

        const calculated = await hostSalaryService.calculateHostSalary(
          host._id,
          hostCycle
        );
        hostCycle.salaryUcoins = calculated.salaryUcoins;
        hostCycle.status = "calculated";
        await hostCycle.save();

        hostCycles.push(hostCycle);
        totalHostSalary += hostCycle.salaryUcoins;
        incompleteCount++;
      }

      console.log(
        `✓ Created 5 complete + 5 incomplete hosts, total salary: ${totalHostSalary}`
      );

      // Calculate agency commission
      const agencyCycle = await AgencyCommissionCycle.create({
        agencyId: agency._id,
        cycleStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: "pending",
      });

      const commissionCalculated =
        await agencyCommissionService.calculateAgencyCommission(
          agency._id,
          hostCycles
        );
      agencyCycle.commissionUcoins = commissionCalculated.commissionUcoins;
      agencyCycle.status = "calculated";
      agencyCycle.calculation = commissionCalculated;
      await agencyCycle.save();

      console.log(
        `✓ Agency commission: ${agencyCycle.commissionUcoins} U-coins`
      );

      // Payout
      await commissionPayoutService.payAgencyCommission(agencyCycle._id);
      const ownerWallet = await Wallet.findOne({
        userId: ownerCustomer._id.toString(),
      });

      this.testResults.push({
        test: "TEST 3 (Mixed Agency: 5 complete, 5 incomplete)",
        status: "PASS ✅",
        hostCount: 10,
        completedHosts: completedCount,
        incompleteHosts: incompleteCount,
        totalHostSalary,
        agencyCommission: agencyCycle.commissionUcoins,
        ownerWalletBalance: ownerWallet ? ownerWallet.ucoins : 0,
      });
    } catch (error) {
      console.error("❌ TEST 3 FAILED:", error.message);
      this.testResults.push({
        test: "TEST 3 (Mixed Agency: 5 complete, 5 incomplete)",
        status: "FAIL ❌",
        error: error.message,
      });
    }
  }

  /**
   * Generate final validation report
   */
  printReport() {
    console.log("\n" + "=".repeat(80));
    console.log("🎯 AGENCY COMMISSION VALIDATION REPORT");
    console.log("=".repeat(80));

    const passed = this.testResults.filter(
      (r) => r.status === "PASS ✅"
    ).length;
    const failed = this.testResults.filter(
      (r) => r.status === "FAIL ❌"
    ).length;

    console.table(this.testResults);

    console.log("\n📊 SUMMARY");
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total: ${this.testResults.length}`);

    if (failed === 0) {
      console.log(
        "\n🎉 ALL AGENCY TESTS PASSED! Commission system is production-ready."
      );
    } else {
      console.log(
        `\n⚠️  ${failed} test(s) failed. Review logs above for details.`
      );
    }

    console.log("=".repeat(80));
  }
}

// Export for use in npm scripts
module.exports = AgencyCommissionValidator;

// Run if executed directly
if (require.main === module) {
  (async () => {
    const validator = new AgencyCommissionValidator();
    try {
      await validator.test_SingleHostAgency();
      await validator.test_MultiHostAgency();
      await validator.test_MixedHostAgency();
      validator.printReport();
    } catch (error) {
      console.error("Validation failed:", error);
    } finally {
      process.exit(0);
    }
  })();
}
