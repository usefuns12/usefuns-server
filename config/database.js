const mongoose = require("mongoose");
const dburi = process.env.MONGO_URL;
const { scheduleUsedDiamondTask } = require('../scheduler/scheduler');

mongoose.connect(dburi, {
    useUnifiedTopology: true,
    useNewUrlParser: true
  })
  .then(() => {
    console.log("mongodb connected");

    // Pre cache DB in Redis
    //require('../utils/redisCache').preCacheDB();

    // Schedule Used Diamond reset task
    //scheduleUsedDiamondTask();
  })
  .catch((err) => console.log(err));