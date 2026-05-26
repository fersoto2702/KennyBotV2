const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    // =========================
    // NAME
    // =========================

    name:
        'antibot',

    aliases: [

        'botdetect',
        'botblock'

    ],

    // =========================
    // DESCRIPTION
    // =========================

    description:
        'Bloquea bots automáticamente en el grupo',

    // =========================
    // CATEGORY
    // =========================

    category:
        'configuracion',

    // =========================
    // EMOJI
    // =========================

    emoji:
        '🤖'

})