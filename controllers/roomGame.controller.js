const models = require("../models");
const logger = require('../classes').Logger(__filename);

const getRoomGames = async (req, res) => {
    try 
    {
        const games = await models.RoomGame.find({});

        res.status(200).json({ success: true, data: games });        
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const addRoomGame = async (req, res) => {
    try 
    {
        const params = req.body;

        if(!params.name || !params.webUrl || !params.requiredRecharge) {
            return res.status(200).json({
                success: true, message: "Please provide all parameters."
            });
        }

        params.images = req.files.map((file) => file.location);

        await models.RoomGame.create(params);

        res.status(200).json({
            success: false, message: "Room Game added successfuly."
        });
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const updateRoomGame = async (req, res) => {
    try 
    {
        const params = req.body;

        if(!params._id) {
            return res.status(200).json({
                success: false, message: "Please provide room game id."
            });
        }

        if(req.files.length) {
            params.images = req.files.map((file) => file.location);
        }

        await models.RoomGame.updateOne({_id: params._id}, params);

        res.status(200).json({
            success: true, message: "Room Game updated successfuly."
        });
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const deleteRoomGame = async (req, res) => {
    try 
    {
        const roomId = req.params.id;
        const result = await models.RoomGame.deleteOne({_id: roomId});

        if(result.deletedCount === 1) {
            res.status(200).json({
                success: true, message: "Room Game deleted successfuly."
            });    
        }
        else {
            res.status(200).json({
                success: true, message: "Room Game not found."
            });
        }        
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getRoomGames,
    addRoomGame,
    updateRoomGame,
    deleteRoomGame
}