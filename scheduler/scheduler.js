const cron = require("node-cron");
const Room = require("../models/Rooms");

const scheduleUsedDiamondTask = async () => {
  //   cron.schedule("0 1 * * *", async () => {
  try {
    await Room.updateMany(
      {},
      {
        $set: {
          diamondsUsedToday: 0,
          treasureBoxLevel: 0,
        },
      },
    );

    console.log("Task completed successfuly...");
  } catch (err) {
    console.error("Error running task--->", err);
  }
  //   });
};

module.exports = { scheduleUsedDiamondTask };
