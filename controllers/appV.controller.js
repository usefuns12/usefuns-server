const models = require("../models");
const logger = require('../classes').Logger(__filename);

const getAppVersion = async (req, res) => {
    try 
    {
        const appVersion = await models.AppVersion.find({});
    
        res.status(200).json({ success: true, message: "Get successful.", data: appVersion });
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addAppVersion = async (req, res) => {
    const { message, version } = req.body;

    try
    {
        const appVersion = await models.AppVersion.create({
                message,
                version
            });

        res.status(200).json({
            success: true,
            message: "Added successfully.",
            data: appVersion,
        });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const updateAppVersion = async (req, res) => {
    const params = req.body;

    if(!params._id) {
        return res.status(400).json({ success: false, message: "Please provide id." });
    }

    try
    {
        await models.AppVersion.updateOne(
            { _id: params._id },
            { $set: params }
        );

        res.status(200).json({
            success: true,
            message: "Updated successfully."
        });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteAppVersion = async (req, res) => {
    
    const id = req.params.id;

    if(!id) {
        return res.status(400).json({ success: false, message: "Please provide id." });
    }

    try 
    {
        const result = await models.AppVersion.deleteOne({ _id: id });

        if(result.deletedCount !== 0) {
            res.status(200).json({ success: true, message: "Deleted successfully." });
        }
        else {
            res.status(200).json({ success: true, message: "Requested App Version is not found." });
        }
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getAppVersion,
    addAppVersion,
    updateAppVersion,
    deleteAppVersion
}