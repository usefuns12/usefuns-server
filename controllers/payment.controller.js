const models = require('../models');
const logger = require('../classes').Logger(__filename);
const axios = require('axios');
const crypto = require('crypto');

const getPaymentUrl = async (req, res) => {
    const { userId, price, diamonds } = req.body;
    const merchantTransactionId = userId + 'M' + Date.now();

    try
    {
        const user = await models.Customer.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({
                success: false, message: "User not found",
            });
        }

        const data = {
            merchantId: "M22ITEIWIFK13",
            merchantTransactionId,
            merchantUserId: `MUID${userId}`,
            amount: price * 100,
            redirectUrl: `https://usefuns.live/recharge/checkout_success?merchantTransactionId=${merchantTransactionId}`,
            redirectMode: 'REDIRECT',
            callbackUrl: `https://usefuns.live/recharge/checkout_success?merchantTransactionId=${merchantTransactionId}`,
            mobileNumber: user.mobile,
            paymentInstrument: { type: 'PAY_PAGE' }
        };

        const payloadMain = Buffer.from(JSON.stringify(data)).toString('base64');
        const keyIndex = 1;
        const verificationString = `${payloadMain}/pg/v1/pay3f14fd25-bb79-4283-8d1a-86b8435df079`;
        const sha256 = crypto.createHash('sha256').update(verificationString).digest('hex');
        const checksum = `${sha256}###${keyIndex}`;

        const options = {
            method: 'POST',
            url: "https://api.phonepe.com/apis/hermes/pg/v1/pay",
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: { request: payloadMain }
        };

        await models.Wallet.create({
            userId,
            status: "pending",
            diamonds,
            price,
            merchantTransactionId,
        });

        const response = await axios.request(options);
        res.status(200).json({
            success: true,
            message: "Payment Url success",
            data: {
                userId,
                price,
                merchantTransactionId,
                url: response.data.data.instrumentResponse.redirectInfo.url
            }
       });
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: "Payment failed", data: error.message || error });
    }
}

const getPaymentStatus = async (req, res) => {
    const merchantTransactionId = req.params['txnId']
    const merchantId = "M22ITEIWIFK13"
    const keyIndex = 1;
    const verificationString = `/pg/v1/status/${merchantId}/${merchantTransactionId}3f14fd25-bb79-4283-8d1a-86b8435df079`;
    const sha256 = crypto.createHash('sha256').update(verificationString).digest('hex');
    const checksum = sha256 + "###" + keyIndex;
    const options = {
        method: 'GET',
        url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': `${merchantId}`
        }
    };

    try
    {
        const response = await axios.request(options);

        if (response.data.code === "PAYMENT_SUCCESS") 
        {
            const wallet = await models.Wallet.findOne({ merchantTransactionId: merchantTransactionId });
            if (wallet.status === "success") {
                return res.status(200).json({
                    success: true,
                    message: "Payment done"
                });
            } 
            else if (wallet.status === "pending") 
            {
                await models.Wallet.updateOne(
                    { merchantTransactionId: merchantTransactionId },
                    {
                        $set: 
                        {
                            status: "success",
                            paymentMethod: response.data.data.paymentInstrument.type,
                            transactionId: response.data.data.transactionId,
                            diamonds: wallet.diamonds,
                            price: wallet.price,
                            merchantTransactionId: wallet.merchantTransactionId
                        }
                    }
                );

                const userData = await models.Customer.findOneAndUpdate(
                    { _id: wallet.userId },
                    {
                        $inc: {
                            diamonds: wallet.diamonds,
                            totalPurchasedDiamonds: wallet.diamonds
                        }
                    },
                    { new: true }
                );
                
                await models.UserDiamondHistory.create({
                    userId: wallet.userId,
                    diamonds: wallet.diamonds,
                    type: 2,
                    uses: "Recharge",
                });

                io.to(wallet.userId).emit('userDataUpdate', userData);
                return res.status(200).json({ success: true, message: "Payment Success" });
            }
        }

        else {
            return res.status(400).json({ success: false, message: "Payment Failure" });
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

const getPaymentCode = async (req, res) => {
    const merchantTransactionId = req.params['txnId']
    const merchantId = "M22ITEIWIFK13"
    const keyIndex = 1;
    const verificationString = `/pg/v1/status/${merchantId}/${merchantTransactionId}3f14fd25-bb79-4283-8d1a-86b8435df079`;
    const sha256 = crypto.createHash('sha256').update(verificationString).digest('hex');
    const checksum = sha256 + "###" + keyIndex;
    const options = {
        method: 'GET',
        url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': `${merchantId}`
        }
    };

    try
    {
        const response = await axios.request(options);

        if (response.data.success) {
            return res.status(200).json({ success: true, data: response.data.code });
        } 
        else {
            return res.status(400).json({ success: false, message: "Payment Failure" });
        }
    }
    catch(error)
    {
        logger.error(error);
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getPaymentUrl,
    getPaymentStatus,
    getPaymentCode
}