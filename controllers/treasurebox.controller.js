const models = require("../models");
const logger = require("../classes").Logger(__filename);

const getAllLevels = async (req, res) => {
  try {
    const levels = await models.TreasureBoxLevel.find({}).sort({ level: 1 });

    res
      .status(200)
      .json({ success: true, message: "Get successful.", data: levels });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createLevel = async (req, res) => {
  const {
    level,
    person1Items = [],
    person2Items = [],
    person3Items = [],
    otherItems = [],
  } = req.body;

  if (level === undefined || level === null) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide level." });
  }

  try {
    const existing = await models.TreasureBoxLevel.findOne({ level });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Level already exists." });
    }

    const created = await models.TreasureBoxLevel.create({
      level,
      person1Items,
      person2Items,
      person3Items,
      otherItems,
    });

    res.status(200).json({
      success: true,
      message: "Added successfully.",
      data: created,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateLevel = async (req, res) => {
  const { level } = req.body;

  if (level === undefined || level === null) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide level." });
  }

  const update = { ...req.body };
  delete update.level;

  if (Object.keys(update).length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "No update fields provided." });
  }

  try {
    const result = await models.TreasureBoxLevel.findOneAndUpdate(
      { level },
      { $set: update },
      { new: true },
    );

    if (!result) {
      return res
        .status(400)
        .json({ success: false, message: "Level not found." });
    }

    res.status(200).json({
      success: true,
      message: "Updated successfully.",
      data: result,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllLevels,
  createLevel,
  updateLevel,
};
