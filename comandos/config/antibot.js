const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    name:
        'antibot',

    aliases: [

        'botdetect',
        'botblock'

    ],

    description:
        'Bloquea bots automáticamente en el grupo',

    category:
        'configuracion',

    emoji:
        '🤖'

})