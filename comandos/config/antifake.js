const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    name:
        'antifake',

    aliases: [

        'fakecheck',
        'fakeguard'

    ],

    description:
        'Detecta números sospechosos o cuentas fake',

    category:
        'configuracion',

    emoji:
        '🕵️'

})