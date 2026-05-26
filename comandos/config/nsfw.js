const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    // =========================
    // NAME
    // =========================

    name:
        'nsfw',

    // =========================
    // ALIASES
    // =========================

    aliases: [

        '18+',
        'adult'

    ],

    // =========================
    // DESCRIPTION
    // =========================

    description:
        'Activa o desactiva los comandos NSFW',

    // =========================
    // CATEGORY
    // =========================

    category:
        'configuracion',

    // =========================
    // EMOJI
    // =========================

    emoji:
        '🔞'

})