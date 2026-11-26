const soundSticker =
    require('../../src/system/soundStickerCore')

module.exports = {
    name: 'stickeraudio',
    aliases: ['soundsticker', 'stkaudio'],
    category: 'general',
    description: 'Editor visual de stickers con sonido para WhatsApp, TikTok e Instagram',

    async execute(ctx) {
        return soundSticker.command(ctx)
    }
}