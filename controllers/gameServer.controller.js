const models = require("../models");
const logger = require('../classes').Logger(__filename);

const get_ssToken = async (req, res) => {
    try 
    {
        const { user_id } = req.body;

        const user = await models.Customer.findOne({ userId: user_id });

        if(user)
        {
            const decoded = jwt.decode(user.token);
            res.status(200).json({
                code: 0,
                message: "succeed",
                unique_id: user._id,
                data: {
                    ss_token: user.token,
                    expire_date: (decoded.iat + (365 * 24 * 60 * 60)) * 1000 
                },
            });
        }
        else
        {
            res.status(400).json({
                code: 1,
                message: "failed",
                data: "User not found",
            });
        }        
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ code: 1, message: error.message, data: null });
    }
}

const getUserInfo = async (req, res) => {
    try 
    {
        const { user_id } = req.body;

        const user = await models.Customer.findOne({ userId: user_id });

        if(user)
        {
            res.status(200).json({
                code: 0,
                message: "succeed",
                unique_id: user._id,
                data: {
                    user_id: user.userId,
                    user_name: user.name,
                    user_avatar: user.image,
                    balance: user.diamonds
                },
            });
        }
        else
        {
            res.status(400).json({
                code: 1,
                message: "failed",
                data: "User not found",
            });
        }        
    } 
    catch (error) 
    {
        logger.error(error);
        res.status(400).json({ code: 1, message: error.message, data: null });
    }
}

const changeBalance = async (req, res) => {
    try 
    {
        const { user_id, currency_diff } = req.body;

        const user = await models.Customer.findOne({ userId: user_id });

        if(user)
        {
            if(currency_diff < 0 && (user.diamonds + currency_diff) < 0) 
            {
                return res.status(400).json({
                    code: 1008,
                    message: "failed",
                    unique_id: user._id,
                    data: "Insufficient balance"
                });
            }

            const updatedDiamonds = user.diamonds + currency_diff;
            let type; 
            if(currency_diff < 0)
            {
                type = 1;
                user.diamonds = updatedDiamonds;
                user.usedDiamonds = user.usedDiamonds + Math.abs(currency_diff)
            }
            else 
            {
                type = 2;
                user.diamonds = updatedDiamonds;
            }
            
            await user.save();

            await models.UserDiamondHistory.create({
                userId: user.userId,
                diamonds: currency_diff,
                type: type,
                uses: "Game"
            });

            res.status(200).json({
                code: 0,
                message: "succeed",
                unique_id: user._id,
                data: {
                    currency_balance: updatedDiamonds
                },
            });
        }
        else
        {
            res.status(400).json({
                code: 1,
                message: "failed",
                data: "User not found",
            });
        }        
    } 
    catch (error) 
    {   
        logger.error(error);
        res.status(400).json({ code: 1, message: error.message, data: null });
    }
}

module.exports = {
    get_ssToken,
    getUserInfo,
    changeBalance
}