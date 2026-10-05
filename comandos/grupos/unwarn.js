const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const warnsPath =
    path.join(
        __dirname,
        '../../database/warns.json'
    )


const MAX_WARNS =
    3


function ensureWarnsFile() {

    const directory =
        path.dirname(
            warnsPath
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
            warnsPath
        )
    ) {

        fs.writeFileSync(
            warnsPath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readWarns() {

    ensureWarnsFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    warnsPath,
                    'utf8'
                )
            )


        return (
            data &&
            typeof data === 'object' &&
            !Array.isArray(data)
        )
            ? data
            : {}

    } catch (err) {

        logger.error(
            `Error leyendo warns.json: ${err.message}`
        )

        return {}

    }

}


function saveWarns(
    warns
) {

    fs.writeFileSync(
        warnsPath,
        JSON.stringify(
            warns,
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


function isAdministrator(
    participant
) {

    return (

        participant?.admin === 'admin' ||

        participant?.admin === 'superadmin'

    )

}


function getParticipantJids(
    participant
) {

    return [

        participant?.id,

        participant?.phoneNumber,

        participant?.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )

}


function findParticipant(
    participants,
    jid
) {

    const target =
        normalizeJid(
            jid
        )


    if (!target) {

        return null

    }


    const targetNumber =
        getNumber(
            target
        )


    return participants.find(

        participant => {

            const jids =
                getParticipantJids(
                    participant
                )


            return jids.some(

                participantJid => {

                    if (
                        participantJid ===
                        target
                    ) {

                        return true

                    }


                    return (
                        getNumber(
                            participantJid
                        ) ===
                        targetNumber
                    )

                }

            )

        }

    ) || null

}


function getMentionedJids(
    msg
) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        []

    )

}


function findWarnKey(
    warns,
    jid
) {

    const normalizedTarget =
        normalizeJid(
            jid
        )


    const targetNumber =
        getNumber(
            jid
        )


    return Object.keys(
        warns
    ).find(

        key => {

            const normalizedKey =
                normalizeJid(
                    key
                )


            return (

                normalizedKey ===
                normalizedTarget

                ||

                getNumber(
                    normalizedKey
                ) ===
                targetNumber

            )

        }

    ) || null

}


function createWarnBar(
    total
) {

    const safeTotal =
        Math.max(
            0,
            Math.min(
                MAX_WARNS,
                Number(total) || 0
            )
        )


    return (
        '●'.repeat(
            safeTotal
        )
        +
        '○'.repeat(
            MAX_WARNS -
            safeTotal
        )
    )

}


module.exports = {

    name:
        'unwarn',

    aliases: [
        'removewarn',
        'delwarn'
    ],

    description:
        'Elimina un warn a un usuario',

    category:
        'grupos',

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
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona dentro de grupos.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               METADATA
            ───────────────────────────── */

            const metadata =
                await sock.groupMetadata(
                    from
                )


            const participants =
                Array.isArray(
                    metadata?.participants
                )
                    ? metadata.participants
                    : []


            if (
                participants.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE GRUPO',

                                'No se pudieron obtener los participantes del grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               REMITENTE
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario.'

                            )

                    }

                )

            }


            const senderData =
                findParticipant(

                    participants,

                    sender

                )


            if (
                !isAdministrator(
                    senderData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo los administradores pueden eliminar advertencias.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               OBJETIVO
            ───────────────────────────── */

            const mentions =
                getMentionedJids(
                    msg
                )


            const target =
                mentions[0]


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Menciona al usuario al que quieres quitarle una advertencia.\n\nUso: /unwarn @usuario'

                            )

                    }

                )

            }


            const targetData =
                findParticipant(

                    participants,

                    target

                )


            if (!targetData) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO NO ENCONTRADO',

                                'Ese usuario no forma parte del grupo.'

                            )

                    }

                )

            }


            const targetJid =

                targetData.id ||

                targetData.phoneNumber ||

                normalizeJid(
                    target
                )


            /* ─────────────────────────────
               WARNS
            ───────────────────────────── */

            const warns =
                readWarns()


            const warnKey =
                findWarnKey(

                    warns,

                    targetJid

                )


            if (!warnKey) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN WARNS',

                                `@${getNumber(targetJid)} no tiene advertencias registradas.`

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            const currentWarns =
                Number(
                    warns[warnKey]?.warns
                )


            if (
                !Number.isFinite(
                    currentWarns
                ) ||
                currentWarns <= 0
            ) {

                delete warns[
                    warnKey
                ]


                saveWarns(
                    warns
                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN WARNS',

                                `@${getNumber(targetJid)} no tiene advertencias activas.`

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               QUITAR WARN
            ───────────────────────────── */

            const newTotal =
                Math.max(
                    0,
                    currentWarns - 1
                )


            if (
                newTotal === 0
            ) {

                delete warns[
                    warnKey
                ]

            } else {

                warns[warnKey].warns =
                    newTotal

            }


            saveWarns(
                warns
            )


            /* ─────────────────────────────
               BARRA
            ───────────────────────────── */

            const bar =
                createWarnBar(
                    newTotal
                )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Unwarn: ${getNumber(targetJid)} → ${newTotal}/${MAX_WARNS} | por ${getNumber(sender)} en ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '✅ WARN ELIMINADO',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],

                                [
                                    'Warns',
                                    `${bar} ${newTotal}/${MAX_WARNS}`
                                ],

                                [
                                    'Eliminado por',
                                    `@${getNumber(sender)}`
                                ]

                            ],

                            newTotal === 0
                                ? 'El usuario ya no tiene advertencias.'
                                : 'Se eliminó una advertencia correctamente.'

                        ),

                    mentions: [
                        targetJid,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error unwarn: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE UNWARN',

                                'No se pudo eliminar la advertencia.'

                            )

                    }

                )

            } catch {}

        }

    }

}