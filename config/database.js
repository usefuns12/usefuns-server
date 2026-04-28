const mongoose = require("mongoose");
const dburi = process.env.MONGO_URL;
const { scheduleUsedDiamondTask } = require("../scheduler/scheduler");
const { scheduleWalletUnlock } = require("../scheduler/walletUnlock.scheduler");
const { startSalaryCycleCron } = require("../services/salaryCycle.service");

mongoose
  .connect(dburi, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(() => {
    console.log("mongodb connected");

    // Pre cache DB in Redis
    //require('../utils/redisCache').preCacheDB();

    // Schedule Used Diamond reset task
    scheduleUsedDiamondTask();

    // 🔓 STEP 3: Schedule wallet unlock job (runs daily at 2:00 AM)
    scheduleWalletUnlock();

    // Salary cycle processing job (runs daily at 12:00 AM)
    startSalaryCycleCron();
  })
  .catch((err) => console.log(err));
