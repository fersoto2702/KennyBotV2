const fs =
    require('fs')

const path =
    require('path')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const joinPath =
    path.join(
        __dirname,
        '../../database/joinMessages.json'
    )


const MAX_MESSAGES =
    15

const PREVIEW_LENGTH =
    60


function ensureDb() {

    try {

        const directory =
            path.dirname(
                joinPath
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
                joinPath
            )
        ) {

            fs.writeFileSync(
                joinPath,
                JSON.stringify(
                    {},
                    null,
                    2
                ),
                'utf8'
            )

        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    joinPath,
                    'utf8'
                )
            )


        if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {

            return {}

        }


        return data


    } catch (err) {

        logger.error(
            `Error leyendo joinMessages.json: ${err.message}`
        )

        return {}

    }

}


function saveDb(
    data
) {

    fs.writeFileSync(
        joinPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeMessage(
    text
) {

    return String(
        text || ''
    )
        .replace(
            /\s+/g,
            ' '
        )
        .trim()

}


function cleanMessages(
    messages
) {

    if (
        !Array.isArray(
            messages
        )
    ) {

        return []

    }


    return [

        ...new Set(

            messages
                .filter(
                    item =>
                        typeof item === 'string'
                )
                .map(
                    normalizeMessage
                )
                .filter(Boolean)

        )

    ]
        .slice(
            0,
            MAX_MESSAGES
        )

}


async function checkGroup(
    sock,
    from,
    msg
) {

    if (
        !from ||
        !from.endsWith('@g.us')
    ) {

        return 'not_group'

    }


    const sender =

        msg.key.participant ||

        msg.participant ||

        msg.key.remoteJid


    if (!sender) {

        return 'no_sender'

    }


    const admin =
        await isGroupAdmin(

            sock,

            from,

            sender

        )


    if (!admin) {

        return 'not_admin'

    }


    return 'ok'

}


module.exports = {

    name:
        'listjoinmsg',

    aliases: [
        'joinmsgs',
        'listwelcome',
        'welcomelist'
    ],

    description:
        'Lista los mensajes de bienvenida configurados',

    category:
        'bienvenida',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               VALIDACIÓN
            ───────────────────────────── */

            const check =
                await checkGroup(

                    sock,

                    from,

                    msg

                )


            if (
                check ===
                'not_group'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona en grupos.'

                            )

                    }

                )

            }


            if (
                check ===
                'no_sender'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario que ejecutó el comando.'

                            )

                    }

                )

            }


            if (
                check ===
                'not_admin'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo administradores pueden usar este comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               BASE DE DATOS
            ───────────────────────────── */

            const data =
                ensureDb()


            const originalMessages =
                Array.isArray(
                    data[from]
                )
                    ? data[from]
                    : []


            const cleanedMessages =
                cleanMessages(
                    originalMessages
                )


            /*
                Guardamos solamente si hubo
                cambios al limpiar la lista.
            */

            const changed =
                JSON.stringify(
                    originalMessages
                ) !==
                JSON.stringify(
                    cleanedMessages
                )


            if (
                cleanedMessages.length > 0
            ) {

                data[from] =
                    cleanedMessages

            } else {

                delete data[from]

            }


            if (
                changed
            ) {

                saveDb(
                    data
                )

            }


            /* ─────────────────────────────
               SIN MENSAJES
            ───────────────────────────── */

            if (
                cleanedMessages.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN MENSAJES',

                                [
                                    'No hay mensajes de bienvenida configurados.',
                                    '',
                                    'Puedes agregar uno con:',
                                    '/addjoinmsg Bienvenido al grupo'
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LISTA
            ───────────────────────────── */

            const rows =
                cleanedMessages
                    .map(

                        (
                            message,
                            index
                        ) => {

                            const preview =
                                message.length >
                                PREVIEW_LENGTH

                                    ? `${message.slice(
                                        0,
                                        PREVIEW_LENGTH
                                    )}...`

                                    : message


                            return [

                                `𖣣ֶㅤ֯⌗ 💬  ׄ ⬭ *#${index + 1}*`,

                                `╰─ 𓂃 ${preview}`

                            ]
                                .join('\n')

                        }

                    )
                    .join('\n\n')


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `JoinMsgs listados: ${from.split('@')[0]} | ${cleanedMessages.length}/${MAX_MESSAGES}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text: [

                        'ㅤ۟∩　ׅ　💬　ׅ　*MENSAJES DE BIENVENIDA*　ׄᰙ',

                        '',

                        `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Total:* ${cleanedMessages.length} / ${MAX_MESSAGES}`,

                        '',

                        rows,

                        '',

                        ui.divider,

                        '',

                        '𖣣ֶㅤ֯⌗ ➕  ׄ ⬭ *Agregar:* /addjoinmsg mensaje',

                        '𖣣ֶㅤ֯⌗ 🗑️  ׄ ⬭ *Eliminar:* /deljoinmsg número',

                        '𖣣ֶㅤ֯⌗ ♻️  ׄ ⬭ *Eliminar todos:* /clearjoinmsg'

                    ]
                        .filter(Boolean)
                        .join('\n')

                }

            )


        } catch (err) {

            logger.error(

                `Error listjoinmsg: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR LISTJOINMSG',

                                'No se pudieron obtener los mensajes de bienvenida.'

                            )

                    }

                )

            } catch {}

        }

    }

}