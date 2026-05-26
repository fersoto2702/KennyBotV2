const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    // =========================
    // NAME
    // =========================

    name:
        'autolevelup',

    // =========================
    // ALIASES
    // =========================

    aliases: [

        'levelup',
        'lvlup'

    ],

    // =========================
    // DESCRIPTION
    // =========================

    description:
        'Notifica automáticamente cuando un usuario sube de nivel',

    // =========================
    // CATEGORY
    // =========================

    category:
        'configuracion',

    // =========================
    // EMOJI
    // =========================

    emoji:
        '⭐'

})