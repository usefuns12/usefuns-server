const models = require("../models");
const logger = require('../classes').Logger(__filename);

const getApiKeys = async (req, res) => {
    try 
    {
        const result = await models.ApiConfig.find({});
    
        res.status(200).json({ success: true, message: "Get successful.", data: result });
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addApiKey = async (req, res) => {
    const { service, secretKeys } = req.body;

    if(!service || !secretKeys?.length) {
       return res.status(400).json({ success: false, message: 'service name or secret keys required' });
    }

    try
    {
        await models.ApiConfig.create({
            service,
            secretKeys
        });

        res.status(200).json({
            success: true,
            message: "Added successfully.",
        });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const updateApiKey = async (req, res) => {
    const params = req.body;

    if(!params._id) {
        return res.status(400).json({ success: false, message: "Please provide id." });
    }

    try
    {
        await models.ApiConfig.updateOne(
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

const deleteApiKey = async (req, res) => {
    
    const id = req.params.id;

    if(!id) {
        return res.status(400).json({ success: false, message: "Please provide id." });
    }

    try 
    {
        const result = await models.ApiConfig.deleteOne({ _id: id });

        if(result.deletedCount !== 0) {
            res.status(200).json({ success: true, message: "Deleted successfully." });
        }
        else {
            res.status(200).json({ success: true, message: "Requested api key is not found." });
        }
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getApiKeys,
    addApiKey,
    updateApiKey,
    deleteApiKey
}