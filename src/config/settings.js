function normalizeArray(
    values
) {

    return [
        ...new Set(
            (
                Array.isArray(
                    values
                )
                    ? values
                    : []
            )
                .map(
                    value =>
                        String(
                            value || ''
                        )
                            .trim()
                )
                .filter(
                    Boolean
                )
        )
    ]

}

const settings = {

    botName:
        'KennyBot',

    prefixes:
        normalizeArray([
            '/',
            '.',
            '#'
        ]),

    ownerNumber:
        normalizeArray([
            '50933490758'
        ]),

    roleAuthorityGroup:
        null,

    stickerPack:
        'KennyBot',

    stickerAuthor:
        'Kenny',

    bots: {

        main: {

            id:
                'main',

            name:
                'KennyBot',

            slogan:
                'Tu asistente para WhatsApp.',

            country:
                'MX',

            flag:
                '🇲🇽',

            authFolder:
                './auth_info',

            menuStyle:
                'default',

            menuImage:
                './assets/bots/main/menu.jpg',

            globalRoleSync:
                true

        },

        brazil: {

            id:
                'brazil',

            name:
                'KennyBot BR',

            slogan:
                'Bot oficial da sociedade Golden Empire.',

            country:
                'BR',

            flag:
                '🇧🇷',

            authFolder:
                './auth_info_brazil',

            menuStyle:
                'brazil',

            menuImage:
                './assets/bots/brazil/menu.jpg',

            globalRoleSync:
                false,

            restrictedToGoldenEmpire:
                false,

            allowedGroups:
                []

        }

    },

    maintenanceCommands:
        normalizeArray([

            'card',

            'cardinfo',

            'collection',

            'equip',

            'packs',

            'openpack',

            'pick',

            'myclub',

            'objectives',

            'claim',

            'events',

            'join'

        ]),

    maintenanceMessage: {

        title:
            'SISTEMA EN MANTENIMIENTO',

        description:
            'Este sistema se encuentra temporalmente en mantenimiento.',

        footer:
            'Estará disponible nuevamente próximamente.'

    }

}

module.exports =
    settings