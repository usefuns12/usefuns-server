const models = require("../models");
const logger = require('../classes').Logger(__filename);

const getClubs = async (req, res) => {
    try 
    {
        const club = await models.Club.find({}).populate("activeUsers").populate("lastmembers");
        if (!club) {
            return res.status(400).json({ success: false, message: "club not found" });
        }

        res.status(200).json({ success: true, message: "Find successful.", data: club });
   } 
   catch (error) 
   {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
   }
}

const addClub = async (req, res) => {
    try 
    {
        const { userId, name, activeUsers, label, announcement } = req.body;
        const isUserExist = await models.Customer.findOne({ _id: userId });
        if (!isUserExist) {
            return res.status(400).json({ success: false, message: "please provide valid user id" });
        }

        const lastClub = await models.Club.findOne().sort({ createdAt: -1 });
        let lastClubIdNum = lastClub ? parseInt(lastClub.clubId.replace('CL', '')) : 0;
        const newClubId = `CL${lastClubIdNum + 1}`;
        
        const images = req.files.map((file) => file.location);
        const club = await models.Club.create({
            clubId: newClubId,
            userId,
            name,
            activeUsers,
            label,
            announcement,
            images
        });
        
        res.status(200).json({
            success: true,
            message: "Club created successfully.",
            data: club,
        });
   } 
   catch (error)
   {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "You already created a club."
            });
        }
        res.status(400).json({ success: false, message: error.message });
   }
}

const updateRoomGame = async (req, res) => {
    try 
    {
        
    } 
    catch (error) 
    {
        logger.error(error);
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "You already created a club.",
            });
        }
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteRoomGame = async (req, res) => {
    try 
    {
           
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getClubs,
    addClub,
    updateRoomGame,
    deleteRoomGame
}