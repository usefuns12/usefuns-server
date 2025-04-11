const models = require('../models');
const logger = require('../classes').Logger(__filename);
const constants = require('../utils/constants.json');
const jwt = require("jsonwebtoken");
const moment = require('moment');

const masterLogin = async (req, res) => {
    const { email, password } = req.body;

    if(!email || !password) {
        return res.status(400).json({ success: false, message: `Please provide ${!email ? 'email' : 'password'}` });
    }

    if(email === constants.masterCredentials.email && password === constants.masterCredentials.password) 
    {
        
        const payload = {
            id: 1001,
            role: ['master']
        };

        const token = jwt.sign(payload, process.env.JWT_KEY);
        return res.status(200).json({ success: true, message: 'Login success', token });
    }
    else {
        return res.status(401).json({ success: false, message: 'Incorrect email or password'});
    }
}

const getOfficialUsers = async (req, res) => {
    try 
    {
        const officialUsers = await models.OfficialUser.find({});
    
        res.status(200).json({ success: true, message: "Get successful.", data: officialUsers });
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addOfficialUser = async (req, res) => {
    const { name, role, userId, countryCard, countryCode, mobile, email } = req.body;

    if(!name || !role || !userId || !countryCard || !countryCode || !mobile || !email) {
        return res.status(400).json({ success: false, message: "Not sufficient paramteters." });
    }

    itemData.resource = req.body.resourceImage ? req.body.resourceImage : null;
    itemData.thumbnail = req.body.thumbnailImage ? req.body.thumbnailImage : null;

    try
    {
        const appVersion = await models.OfficialUser.create({
            name,
            role,
            userId,
            countryCard,
            countryCode,
            mobile,
            email
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

const updateOfficialUser = async (req, res) => {
    const userData = req.body;

    if (!userData?._id) {
        return res.status(400).json({ success: false, message: "Please provide user id" });
    }

    if (req.body.resourceImage) {
        userData.resource = req.body.resourceImage;
    }
    if (req.body.thumbnailImage) {
        userData.thumbnail = req.body.thumbnailImage;
    }

    try
    {
        await models.ShopItem.updateOne(
            { _id: userData._id },
            { $set: userData }
        );

        res.status(200).json({ success: true, message: "Item updated successfully" });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteOfficialUser = async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ success: false, message: "Please provide user id" });
    }

    try
    {
        const result = await models.OfficialUser.deleteOne({ _id: id });
        if(result.deletedCount === 1) {
            res.status(200).json({ success: true, message: "User deleted successfully" });
        }
        else {
            res.status(400).json({ success: false, message: "User not found" });    
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    masterLogin,
    getOfficialUsers,
    addOfficialUser,
    updateOfficialUser,
    deleteOfficialUser
}