const models = require('../models');
const redisClient = require('../config').redis;

const preCacheDB = async () => {

    let registerBonus = await redisClient.get('registerBonus');
    if(!registerBonus) 
    {
        const shopItems = await models.ShopItem.find({
            name: { $in: ["vip 1", "Unique", "vip card", "vip 1 entry"] },
            itemType: { $in: ["frame", "theme", "chatBubble", "vehicle"] }
        }, { name: 1, itemType: 1, thumbnail: 1, resource: 1, isDefault: 1, isOfficial: 1 });

        const registerB = shopItems.reduce((acc, item) => {
            // Create the item structure once and add it to the corresponding itemType array
            const itemData = {
                name: item.name,
                thumbnail: item.thumbnail,
                resource: item.resource,
                isDefault: item.isDefault,
                isOfficial: item.isOfficial
            };
        
            acc[item.itemType] = itemData;
            
            return acc;
        }, {});

        redisClient.set('registerBonus', JSON.stringify(registerB));

        return;
    }
}

module.exports = { preCacheDB };