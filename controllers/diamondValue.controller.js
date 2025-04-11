const models = require('../models');
const logger = require('../classes').Logger(__filename);

const getDiamondValues = async (req, res) => {

    try
    {
        const diamonds = await models.DiamondValue.find({});
        res.status(200).json({ success: true, data: diamonds });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addDiamondValue = async (req, res) => {
    const diamondData = req.body;

    try
    {
        await models.DiamondValue.create(diamondData);
        res.status(200).json({ success: true, message: "Diamond added successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const updateDiamondValue = async (req, res) => {
    const diamondData = req.body;

    if (!diamondData?._id) {
        return res.status(400).json({ success: false, message: "Please provide item id" });
    }

    try
    {
        await models.DiamondValue.updateOne(
            { _id: diamondData._id },
            { $set: diamondData }
        );

        res.status(200).json({ success: true, message: "Diamond updated successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteDiamondValue = async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ success: false, message: "Please provide item id" });
    }

    try
    {
        const result = await models.DiamondValue.deleteOne({ _id: id });
        if(result.deletedCount === 1) {
            res.status(200).json({ success: true, message: "Diamond deleted successfully" });
        }
        else {
            res.status(400).json({ success: false, message: "Diamond not found" });   
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getDiamondValues,
    addDiamondValue,
    updateDiamondValue,
    deleteDiamondValue
}