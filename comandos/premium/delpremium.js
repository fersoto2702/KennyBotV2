const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const premiumPath =
    path.join(
        __dirname,
        '../../database/premium.json'
    )


function ensurePremiumFile() {

    const directory =
        path.dirname(
            premiumPath
        )


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }


    if (
        !fs.existsSync(
            premiumPath
        )
    ) {

        fs.writeFileSync(
            premiumPath,
            JSON.stringify(
                [],
                null,
                2
            ),
            'utf8'
        )

    }

}


function readPremium() {

    ensurePremiumFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    premiumPath,
                    'utf8'
                )
            )


        return Array.isArray(data)
            ? data
            : []

    } catch (err) {

        logger.error(
            `Error leyendo premium.json: ${err.message}`
        )

        return []

    }

}


function savePremium(
    premium
) {

    fs.writeFileSync(
        premiumPath,
        JSON.stringify(
            premium,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]

}


function getContextInfo(
    msg
) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo

        ||

        msg.message
            ?.documentMessage
            ?.contextInfo

        ||

        {}

    )

}


function resolveTarget(
    msg
) {

    const contextInfo =
        getContextInfo(
            msg
        )


    const mentioned =
        contextInfo
            ?.mentionedJid
            ?.[0]


    const quotedParticipant =
        contextInfo
            ?.participant


    return normalizeJid(

        mentioned ||
        quotedParticipant

    )

}


module.exports = {

    name:
        'addpremium',

    aliases: [
        'addprem',
        'givepremium',
        'premadd'
    ],

    description:
        'Agrega un usuario a premium',

    category:
        'perfil',

    ownerOnly:
        true,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               OBJETIVO
            ───────────────────────────── */

            const target =
                resolveTarget(
                    msg
                )


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                [
                                    'Menciona a un usuario o responde a su mensaje.',
                                    '',
                                    'Uso:',
                                    '/addpremium @usuario',
                                    '',
                                    'También puedes responder a un mensaje con:',
                                    '/addpremium'
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PREMIUM
            ───────────────────────────── */

            const premium =
                readPremium()


            const normalizedPremium =
                premium
                    .map(
                        normalizeJid
                    )
                    .filter(Boolean)


            const alreadyPremium =
                normalizedPremium.includes(
                    target
                )


            if (
                alreadyPremium
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA ES PREMIUM',

                                `@${getNumber(target)} ya tiene acceso premium.`

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               AGREGAR
            ───────────────────────────── */

            normalizedPremium.push(
                target
            )


            const uniquePremium = [

                ...new Set(
                    normalizedPremium
                )

            ]


            savePremium(
                uniquePremium
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Premium agregado: ${getNumber(target)}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '💎 PREMIUM AGREGADO',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(target)}`
                                ],

                                [
                                    'Estado',
                                    '💎 PREMIUM'
                                ],

                                [
                                    'Acceso',
                                    '● ACTIVADO'
                                ]

                            ],

                            'El usuario recibió acceso premium correctamente.'

                        ),

                    mentions: [
                        target
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error addpremium: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PREMIUM',

                                'No se pudo agregar al usuario a premium.'

                            )

                    }

                )

            } catch {}

        }

    }

}