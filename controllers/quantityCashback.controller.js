const models = require("../models");
const logger = require("../classes").Logger(__filename);

// Get all quantity-cashback records
const getQuantities = async (req, res) => {
  try {
    const quantities = await models.QuantityCashback.find({});
    res.status(200).json({ success: true, data: quantities });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Add new quantity-cashback record
const addQuantity = async (req, res) => {
  const data = req.body;

  if (!data?.quantity || data.cashbackAmount == null) {
    return res.status(400).json({
      success: false,
      message: "Please provide both quantity and cashbackAmount",
    });
  }

  try {
    await models.QuantityCashback.create(data);
    res
      .status(200)
      .json({ success: true, message: "Quantity cashback added successfully" });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update existing quantity-cashback record
const updateQuantity = async (req, res) => {
  const data = req.body;

  if (!data?._id) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide quantity cashback ID" });
  }

  try {
    await models.QuantityCashback.updateOne({ _id: data._id }, { $set: data });
    res
      .status(200)
      .json({
        success: true,
        message: "Quantity cashback updated successfully",
      });
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a quantity-cashback record
const deleteQuantity = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide quantity cashback ID" });
  }

  try {
    const result = await models.QuantityCashback.deleteOne({ _id: id });
    if (result.deletedCount === 1) {
      res
        .status(200)
        .json({
          success: true,
          message: "Quantity cashback deleted successfully",
        });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Quantity cashback not found" });
    }
  } catch (error) {
    logger.error(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getQuantities,
  addQuantity,
  updateQuantity,
  deleteQuantity,
};
