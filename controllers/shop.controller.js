const models = require("../models");
const logger = require("../classes").Logger(__filename);
const { cleanupS3Files } = require("../utils/s3FileManager");

const getItems = async (req, res) => {
  try {
    const items = await models.ShopItem.find({});
    // console.log("items:", items);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const addItem = async (req, res) => {
  const itemData = req.body;

  // Parse and sanitize specialId list
  if (req.body?.specialId) {
    try {
      // Step 1: Parse and remove duplicates in the uploaded list
      let uploadedIds = JSON.parse(req.body.specialId).map((id) =>
        id.toString()
      );
      uploadedIds = [...new Set(uploadedIds)]; // remove duplicates within CSV

      // Step 2: Check DB for already existing IDs
      const existingItems = await models.ShopItem.find(
        { itemType: "specialId", specialId: { $in: uploadedIds } },
        { specialId: 1 }
      );

      const existingIdsInDB = new Set(
        existingItems
          .flatMap((item) => item.specialId || [])
          .map((id) => id.toString())
      );

      // Step 3: Filter out already existing IDs
      const uniqueNewIds = uploadedIds.filter((id) => !existingIdsInDB.has(id));

      if (!uniqueNewIds.length) {
        return res.status(400).json({
          success: false,
          message: "All Special IDs in CSV already exist in database.",
        });
      }

      itemData.specialId = uniqueNewIds;
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid CSV User ID format.",
      });
    }
  }

  itemData.resource = req.body.resourceImage ? req.body.resourceImage : null;
  itemData.thumbnail = req.body.thumbnailImage ? req.body.thumbnailImage : null;

  try {
    await models.ShopItem.create(itemData);

    res.status(200).json({
      success: true,
      message: `${itemData.itemType} added successfully`,
    });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
    const s3Files = [];
    if (itemData.resource) {
      s3Files.push(itemData.resource);
    }
    if (itemData.thumbnail) {
      s3Files.push(itemData.thumbnail);
    }
    if (s3Files.length) {
      cleanupS3Files(s3Files);
    }
  }
};

const updateItem = async (req, res) => {
  const itemData = req.body;

  if (!itemData?._id) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide item id" });
  }

  if (req.body.resourceImage) {
    itemData.resource = req.body.resourceImage;
  }
  if (req.body.thumbnailImage) {
    itemData.thumbnail = req.body.thumbnailImage;
  }
  if (req.body.isCountryReset) {
    itemData.countryCode = null;
  }

  try {
    await models.ShopItem.updateOne({ _id: itemData._id }, { $set: itemData });

    res
      .status(200)
      .json({ success: true, message: "Item updated successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteItem = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide item id" });
  }

  try {
    const result = await models.ShopItem.deleteOne(
      { _id: id },
      { projection: { resource: 1, thumbnail: 1 } }
    );
    if (result) {
      res
        .status(200)
        .json({ success: true, message: "Item deleted successfully" });
      cleanupS3Files([result.resource, result.thumbnail]);
    } else {
      res.status(400).json({ success: false, message: "Item not found" });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getItems,
  addItem,
  updateItem,
  deleteItem,
};
