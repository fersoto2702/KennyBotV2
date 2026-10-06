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


function findPremiumKey(
    premium,
    target
) {

    const normalizedTarget =
        normalizeJid(
            target
        )


    return premium.find(

        user =>
            normalizeJid(
                user
            ) ===
            normalizedTarget

    ) || null

}


module.exports = {

    name:
        'delpremium',

    aliases: [
        'delprem',
        'removepremium',
        'unpremium'
    ],

    description:
        'Elimina a un usuario de premium',

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
                                    '/delpremium @usuario',
                                    '',
                                    'También puedes responder a un mensaje con:',
                                    '/delpremium'
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PREMIUM
            ───────────────────────────── */

            let premium =
                readPremium()


            const premiumKey =
                findPremiumKey(

                    premium,

                    target

                )


            if (!premiumKey) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NO ES PREMIUM',

                                `@${getNumber(target)} no tiene acceso premium.`

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ELIMINAR
            ───────────────────────────── */

            premium =
                premium.filter(

                    user =>
                        normalizeJid(user) !==
                        normalizeJid(premiumKey)

                )


            premium = [

                ...new Set(

                    premium
                        .map(
                            normalizeJid
                        )
                        .filter(Boolean)

                )

            ]


            savePremium(
                premium
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Premium eliminado: ${getNumber(target)}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '💎 PREMIUM ELIMINADO',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(target)}`
                                ],

                                [
                                    'Estado',
                                    '○ SIN PREMIUM'
                                ],

                                [
                                    'Acceso',
                                    'DESACTIVADO'
                                ]

                            ],

                            'El acceso premium fue retirado correctamente.'

                        ),

                    mentions: [
                        target
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error delpremium: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PREMIUM',

                                'No se pudo eliminar el acceso premium del usuario.'

                            )

                    }

                )

            } catch {}

        }

    }

}