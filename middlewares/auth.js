const jwt = require("jsonwebtoken");
const models = require("../models");
const logger = require('../classes').Logger(__filename);

const authCustomer = async (req, res, next) => {
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    )
    {
        // decode the token //
        try 
        {
            const token = req.headers.authorization.split(" ")[1];
            jwt.verify(token, process.env.JWT_KEY, async (error, decoded) => {
                if(error) {
                res.status(401).json({
                    success: false,
                    message: "Not Authorized To Access This Route",
                });
                return;
                }

                const customer = await models.Customer.findOne({
                    _id: decoded._id,
                    token: token,
                });

                if (!customer) {
                    res.status(401).json({
                        success: false,
                        message: "Not Authorized To Access This Route",
                    });
                }

                req.customer = customer;
                req.token = token;
                next();
            });
        } 
        catch (err) {
            logger.error("Token Error --->", err);
            res.status(401).json({
                success: false,
                message: "Not Authorized To Access This Route",
            });
        }
    }
    else {
        res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
        });
    }
};

const authAdmin = async (req, res, next) => {
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    )
    {
        // decode the token //
        try 
        {
            const token = req.headers.authorization.split(" ")[1];
            jwt.verify(token, process.env.JWT_KEY, async (error, decoded) => {
                if(error) {
                res.status(401).json({
                    success: false,
                    message: "Not Authorized To Access This Route",
                });
                return;
                }

                if(decoded?.role.includes('master')) {
                    next();
                }
                else {
                    res.status(401).json({
                        success: false,
                        message: "Not Authorized To Access This Route",
                    });
                }
            });
        } 
        catch (err) {
            logger.error("Token Error --->", err);
            res.status(401).json({
                success: false,
                message: "Not Authorized To Access This Route",
            });
        }
    }
    else {
        res.status(401).json({
            success: false,
            message: "Not Authorized To Access This Route",
        });
    }
};

module.exports = { authCustomer, authAdmin };
