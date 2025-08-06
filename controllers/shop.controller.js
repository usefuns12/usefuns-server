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

  if (req.body?.specialId) {
    try {
      // Step 1: Parse and deduplicate uploaded special IDs
      let uploadedIds = JSON.parse(req.body.specialId).map((id) =>
        id.toString()
      );
      uploadedIds = [...new Set(uploadedIds)];

      // Step 2: Check DB - if any IDs already exist in a ShopItem
      const existingItems = await models.ShopItem.find(
        { itemType: "specialId", specialId: { $in: uploadedIds } },
        { specialId: 1 }
      );

      const existingIdsInShop = new Set(
        existingItems
          .flatMap((item) => item.specialId || [])
          .map((id) => id.toString())
      );

      // Step 3: Check DB - if any IDs are already assigned to users
      const assignedUsers = await models.Customer.find(
        { userId: { $in: uploadedIds } },
        { userId: 1 }
      );

      const alreadyAssignedIds = new Set(
        assignedUsers.map((user) => user.userId.toString())
      );

      // Step 4: Filter out IDs that already exist in DB or are already assigned
      const uniqueNewIds = uploadedIds.filter(
        (id) => !existingIdsInShop.has(id) && !alreadyAssignedIds.has(id)
      );

      if (!uniqueNewIds.length) {
        return res.status(400).json({
          success: false,
          message:
            "All Special IDs are either already added or assigned to users.",
        });
      }

      // Set cleaned-up specialId list in itemData
      itemData.specialId = uniqueNewIds;
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid special ID format in uploaded CSV.",
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
