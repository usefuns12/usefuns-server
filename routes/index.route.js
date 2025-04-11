const adminRoutes = require('./admin.router');
const customerRoutes = require('./customer.router');
const roomGameRoutes = require('./roomGame.router');
const gameServerRoutes = require('./gameServer.router');
const clubRoutes = require('./club.router');
const appVRoutes = require('./appV.router');
const roomRoutes = require('./room.router');
const shopRoutes = require('./shop.router');
const diamondValueRoutes = require('./diamondValue.router');
const carouselRoutes = require('./carousel.router');
const giftRoutes = require('./gift.router');
const paymentRoutes = require('./payment.router');
const apiConfigRoutes = require('./apiConfig.router');

const express = require('express');
const router = express.Router();

/** GET /health-check - Check service health */
router.get('/health-check', (req, res) => res.send('OK'));

router.use('/admin', adminRoutes);
router.use('/user', customerRoutes);
router.use('/roomGame', roomGameRoutes);
router.use('/carousel', carouselRoutes);
//router.use('/club', clubRoutes);
router.use('/app', appVRoutes);
router.use('/room', roomRoutes);
router.use('/shop', shopRoutes);
router.use('/gift', giftRoutes);
router.use('/payment', paymentRoutes);
router.use('/diamondValue', diamondValueRoutes);
router.use('/apiConfig', apiConfigRoutes);

module.exports = router;