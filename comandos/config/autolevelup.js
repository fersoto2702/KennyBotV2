const {
    createToggleCommand
} = require('../../src/utils/toggleCommand')

module.exports = createToggleCommand({

    name:
        'autolevelup',

    aliases: [

        'levelup',
        'lvlup'

    ],

    description:
        'Notifica automáticamente cuando un usuario sube de nivel',

    category:
        'configuracion',
        
    emoji:
        '⭐'

})