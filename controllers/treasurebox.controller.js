const models = require("../models");
const logger = require("../classes").Logger(__filename);

const getAllLevels = async (req, res) => {
  try {
    let levels = await models.TreasureBoxLevel.find({})
      .sort({ level: 1 })
      .populate({
        path: "person1Items.itemId",
      })
      .populate({
        path: "person2Items.itemId",
      })
      .populate({
        path: "person3Items.itemId",
      })
      .populate({
        path: "otherItems.itemId",
      })
      .lean();

    // update the list where there EXP, Diamond, Beans count is there so with that return image of that item
    levels = levels.map((level) => {
      const updateItems = (items) => {
        return items.map((item) => {
          if (item.diamondAmount) {
            item.image =
              "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089129-removebg-preview.png";
          } else if (item.beansAmount) {
            item.image =
              "https://usefun-uploads.s3.ap-south-1.amazonaws.com/beans.png";
          } else if (item.xp) {
            item.image =
              "https://usefun-uploads.s3.ap-south-1.amazonaws.com/1000089358-removebg-preview.png";
          }
          return item;
        });
      };

      return {
        ...level,
        person1Items: updateItems(level.person1Items),
        person2Items: updateItems(level.person2Items),
        person3Items: updateItems(level.person3Items),
        otherItems: updateItems(level.otherItems),
      };
    });

    res
      .status(200)
      .json({ success: true, message: "Get successful.", data: levels });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createLevel = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const imageUrl = req.file.location; // Assuming using multer-s3 or similar
  console.log("Received file:", imageUrl, req.body); // Debug log to check the file object

  const {
    level,
    diamondToOpen = 0,

    person1Items = [],
    person2Items = [],
    person3Items = [],
    otherItems = [],
  } = req.body;

  // convert stringified arrays back to JSON if they are in string format
  const parseItems = (items) => {
    if (typeof items === "string") {
      try {
        return JSON.parse(items);
      } catch (err) {
        logger.error("Error parsing items JSON:", err);
        return [];
      }
    }
    return items;
  };

  const person1ItemsParsed = parseItems(person1Items);
  const person2ItemsParsed = parseItems(person2Items);
  const person3ItemsParsed = parseItems(person3Items);
  const otherItemsParsed = parseItems(otherItems);

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
      level: Number(level),
      person1Items: person1ItemsParsed,
      person2Items: person2ItemsParsed,
      person3Items: person3ItemsParsed,
      otherItems: otherItemsParsed,
      diamondToOpen: Number(diamondToOpen) || 0,
      image: imageUrl,
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
  if (req.file) {
    req.body.image = req.file.location; // Assuming using multer-s3 or similar
  }
  const { level } = req.body;

  if (level === undefined || level === null) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide level." });
  }

  // Convert stringified arrays back to JSON if they are in string format
  const parseItems = (items) => {
    if (typeof items === "string") {
      try {
        return JSON.parse(items);
      } catch (err) {
        logger.error("Error parsing items JSON:", err);
        return [];
      }
    }
    return items;
  };
  req.body.person1Items = parseItems(req.body.person1Items);
  req.body.person2Items = parseItems(req.body.person2Items);
  req.body.person3Items = parseItems(req.body.person3Items);
  req.body.otherItems = parseItems(req.body.otherItems);
  req.body.diamondToOpen = Number(req.body.diamondToOpen) || 0;
  req.body.level = Number(req.body.level);

  const update = { ...req.body };
  if (req.body.image) {
    update.image = req.body.image;
  }
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
