const models = require('../models');
const logger = require('../classes').Logger(__filename);
const { cleanupS3Files } = require('../utils/s3FileManager');

const getCarousels = async (req, res) => {

    try
    {
        const carousels = await models.Carousel.find({});
        res.status(200).json({ success: true, data: carousels });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addCarousel = async (req, res) => {
    const carouselData = req.body;

    carouselData.carouselImage = req.body.image ? req.body.image : null; 

    try
    {
        await models.Carousel.create(carouselData);
        res.status(200).json({ success: true, message: "Carousel added successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
        if(carouselData.carouselImage) {
            cleanupS3Files(carouselData.carouselImage);
        }
    }
}

const updateCarousel = async (req, res) => {
    const carouselData = req.body;

    if (!carouselData?._id) {
        return res.status(400).json({ success: false, message: "Please provide carousel id" });
    }

    if(req.body.image) {
        carouselData.carouselImage = req.body.image;
    }
    if(req.body.isCountryReset) {
        carouselData.countryCode = null;
    }

    try
    {
        await models.Carousel.updateOne(
            { _id: carouselData._id },
            { $set: carouselData }
        );

        res.status(200).json({ success: true, message: "Carousel updated successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteCarousel = async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ success: false, message: "Please provide carousel id" });
    }

    try
    {
        const result = await models.Carousel.findOneAndDelete({ _id: id }, { projection: { carouselImage: 1 } });
        if(result) 
        {
            res.status(200).json({ success: true, message: "Carousel deleted successfully" });
            cleanupS3Files(result.carouselImage);
        }
        else {
            res.status(400).json({ success: false, message: "Carousel not found" });   
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getCarousels,
    addCarousel,
    updateCarousel,
    deleteCarousel
}