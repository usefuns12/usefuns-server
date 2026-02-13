const mongoose = require("mongoose");
const dburi = process.env.MONGO_URL;
const { scheduleUsedDiamondTask } = require("../scheduler/scheduler");
const { scheduleWalletUnlock } = require("../scheduler/walletUnlock.scheduler");

mongoose
  .connect(dburi, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(async () => {
    console.log("mongodb connected");

    // Pre cache DB in Redis
    //require('../utils/redisCache').preCacheDB();

    // Schedule Used Diamond reset task
    await scheduleUsedDiamondTask();

    // 🔓 STEP 3: Schedule wallet unlock job (runs daily at 2:00 AM)
    scheduleWalletUnlock();
  })
  .catch((err) => console.log(err));
