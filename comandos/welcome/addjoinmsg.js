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

const MAX_LENGTH =
    500


/* ─────────────────────────────
   ASEGURAR BASE DE DATOS
───────────────────────────── */

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


/* ─────────────────────────────
   GUARDAR BASE
───────────────────────────── */

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


/* ─────────────────────────────
   NORMALIZAR TEXTO
───────────────────────────── */

function normalizeText(
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


/* ─────────────────────────────
   LIMPIAR LISTA
───────────────────────────── */

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
                    normalizeText
                )

                .filter(Boolean)

        )

    ]
        .slice(
            0,
            MAX_MESSAGES
        )

}


/* ─────────────────────────────
   VALIDAR GRUPO / ADMIN
───────────────────────────── */

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


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

module.exports = {

    name:
        'addjoinmsg',

    aliases: [
        'setjoinmsg',
        'joinmsg'
    ],

    description:
        'Agrega un mensaje automático al unirse al grupo',

    category:
        'bienvenida',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        args = [],
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
               MENSAJE
            ───────────────────────────── */

            const text =
                normalizeText(

                    args.join(
                        ' '
                    )

                )


            if (!text) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MENSAJE REQUERIDO',

                                [
                                    'Debes escribir el mensaje de bienvenida.',
                                    '',
                                    'Uso:',
                                    '/addjoinmsg Bienvenido al grupo'
                                ].join('\n')

                            )

                    }

                )

            }


            if (
                text.length >
                MAX_LENGTH
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'MENSAJE DEMASIADO LARGO',

                                `Máximo ${MAX_LENGTH} caracteres.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               BASE DE DATOS
            ───────────────────────────── */

            const data =
                ensureDb()


            data[from] =
                cleanMessages(
                    data[from]
                )


            /* ─────────────────────────────
               LÍMITE
            ───────────────────────────── */

            if (
                data[from].length >=
                MAX_MESSAGES
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'LÍMITE ALCANZADO',

                                `Este grupo ya tiene ${MAX_MESSAGES} mensajes de entrada configurados.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DUPLICADO
            ───────────────────────────── */

            const duplicated =
                data[from].some(

                    message =>
                        message.toLowerCase() ===
                        text.toLowerCase()

                )


            if (
                duplicated
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MENSAJE DUPLICADO',

                                'Ese mensaje ya está registrado.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               AGREGAR
            ───────────────────────────── */

            data[from].push(
                text
            )


            saveDb(
                data
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `JoinMsg agregado: ${from.split('@')[0]} | ${data[from].length}/${MAX_MESSAGES}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            'MENSAJE AGREGADO',

                            [

                                [
                                    'Total',
                                    `${data[from].length} / ${MAX_MESSAGES}`
                                ],

                                [
                                    'Longitud',
                                    `${text.length} / ${MAX_LENGTH}`
                                ]

                            ],

                            'El mensaje de entrada fue guardado correctamente.'

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error addjoinmsg: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR JOINMSG',

                                'No se pudo guardar el mensaje de entrada.'

                            )

                    }

                )

            } catch {}

        }

    }

}