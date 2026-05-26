const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    // =========================
    // NAME
    // =========================

    name:
        'antifake',

    aliases: [

        'fakecheck',
        'fakeguard'

    ],

    // =========================
    // DESCRIPTION
    // =========================

    description:
        'Detecta números sospechosos o cuentas fake',

    // =========================
    // CATEGORY
    // =========================

    category:
        'configuracion',

    // =========================
    // EMOJI
    // =========================

    emoji:
        '🕵️'

})