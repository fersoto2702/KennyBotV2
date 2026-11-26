'use strict'

const soundSticker =
    require('../../src/system/soundStickerCore')

module.exports = {

    name:
        'stickeraudio',

    aliases: [
        'soundsticker',
        'stkaudio'
    ],

    category:
        'general',

    description:
        'Crear stickers con sonido desde video o sticker + audio',

    async execute(ctx) {

        return await soundSticker.command(
            ctx
        )

    }

}
