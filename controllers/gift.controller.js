const models = require('../models');
const logger = require('../classes').Logger(__filename);
const { cleanupS3Files } = require('../utils/s3FileManager');

const getCategories = async (req, res) => {

    try
    {
        const categories = await models.GiftCategory.find({});
        res.status(200).json({ success: true, data: categories });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addCategory = async (req, res) => {
    const categoryData = req.body;

    try
    {
        await models.GiftCategory.create(categoryData);

        res.status(200).json({ success: true, message: "Gift category added successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const updateCategory = async (req, res) => {
    const categoryData = req.body;

    if (!categoryData?._id) {
        return res.status(400).json({ success: false, message: "Please provide gift category id" });
    }

    try
    {
        await models.GiftCategory.updateOne(
            { _id: categoryData._id },
            { $set: categoryData }
        );

        res.status(200).json({ success: true, message: "Gift category updated successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteCategory = async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ success: false, message: "Please provide gift category id" });
    }

    try
    {
        const result = await models.GiftCategory.deleteOne({ _id: id });
        if(result.deletedCount === 1) {
            res.status(200).json({ success: true, message: "Gift category deleted successfully" });
        }
        else {
            res.status(400).json({ success: false, message: "Gift category not found" });    
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const getGifts = async (req, res) => {

    try
    {
        const gifts = await models.Gift.find({}).populate({
            path: 'categoryId',
            select: 'name'
        }).lean();

        const filteredGifts = gifts.map(gift => {
            return {
                ...gift,
                category: gift.categoryId
            }
        });

        filteredGifts.forEach(gift => delete gift.categoryId);
        res.status(200).json({ success: true, data: filteredGifts });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addGift = async (req, res) => {
    const giftData = req.body;

    giftData.resource = req.body.resourceImage ? req.body.resourceImage : null;
    giftData.thumbnail = req.body.thumbnailImage ? req.body.thumbnailImage : null;

    try
    {
        const isCategoryExists = await models.GiftCategory.findOne({ _id: giftData.categoryId }, { _id: 1 });
        if(!isCategoryExists) {
            return res.status(400).json({ success: false, message: "please provide valid category id" });
        }

        await models.Gift.create(giftData);

        res.status(200).json({ success: true, message: "Gift added successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
        const s3Files = []; 
        if(giftData.resource) {
            s3Files.push(giftData.resource);
        }
        if(giftData.thumbnail) {
            s3Files.push(giftData.thumbnail);
        }
        if(s3Files.length) {
            cleanupS3Files(s3Files);
        }
    }
}

const updateGift = async (req, res) => {
    const giftData = req.body;

    if (!giftData?._id) {
        return res.status(400).json({ success: false, message: "Please provide gift id" });
    }

    if (req.body.resourceImage) {
        giftData.resource = req.body.resourceImage;
    }
    if (req.body.thumbnailImage) {
        giftData.thumbnail = req.body.thumbnailImage;
    }
    if(req.body.isCountryReset) {
        giftData.countryCode = null;
    }

    try
    {
        if(giftData.categoryId) {
            const isCategoryExists = await models.GiftCategory.findOne({ _id: giftData.categoryId }, { _id: 1 });
            if(!isCategoryExists) {
                return res.status(400).json({ success: false, message: "please provide valid category id" });
            }
        }

        await models.Gift.updateOne(
            { _id: giftData._id },
            { $set: giftData }
        );

        res.status(200).json({ success: true, message: "Gift updated successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteGift = async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ success: false, message: "Please provide gift id" });
    }

    try
    {
        const result = await models.Gift.findOneAndDelete(
            { _id: id }, 
            { projection: { resource: 1, thumbnail: 1 } }
        );
        if(result) 
        {
            res.status(200).json({ success: true, message: "Gift deleted successfully" });
            cleanupS3Files([result.resource, result.thumbnail]);
        }
        else {
            res.status(400).json({ success: false, message: "Gift not found" });    
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getGifts,
    addGift,
    updateGift,
    deleteGift
}