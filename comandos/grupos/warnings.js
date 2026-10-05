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


function getWarnStatus(
    total
) {

    if (
        total >=
        MAX_WARNS
    ) {

        return '⚠ EN LÍMITE'

    }


    if (
        total >= 2
    ) {

        return '⚠ RIESGO ALTO'

    }


    if (
        total === 1
    ) {

        return '● ADVERTIDO'

    }


    return '✓ LIMPIO'

}


module.exports = {

    name:
        'warnings',

    aliases: [
        'warns',
        'checkwarns'
    ],

    description:
        'Muestra los warns de un usuario',

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

                                'Solo los administradores pueden consultar advertencias.'

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

                                'Menciona al usuario que quieres consultar.\n\nUso: /warnings @usuario'

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


            let total =
                Number(
                    warnKey
                        ? warns[warnKey]?.warns
                        : 0
                )


            if (
                !Number.isFinite(
                    total
                )
            ) {

                total =
                    0

            }


            total =
                Math.max(

                    0,

                    Math.min(
                        MAX_WARNS,
                        total
                    )

                )


            /* ─────────────────────────────
               ESTADO
            ───────────────────────────── */

            const bar =
                createWarnBar(
                    total
                )


            const status =
                getWarnStatus(
                    total
                )


            const remaining =
                Math.max(
                    0,
                    MAX_WARNS -
                    total
                )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Warnings check: ${getNumber(targetJid)} → ${total}/${MAX_WARNS} | por ${getNumber(sender)}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '⚠️ ADVERTENCIAS',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],

                                [
                                    'Warns',
                                    `${bar} ${total}/${MAX_WARNS}`
                                ],

                                [
                                    'Estado',
                                    status
                                ],

                                [
                                    'Restantes',
                                    remaining === 0
                                        ? 'Ninguna'
                                        : `${remaining} antes del límite`
                                ]

                            ],

                            total === 0
                                ? 'Este usuario no tiene advertencias activas.'
                                : total >= MAX_WARNS
                                    ? 'El usuario alcanzó el límite máximo de advertencias.'
                                    : `Al llegar a ${MAX_WARNS}/${MAX_WARNS}, podrá aplicarse la expulsión automática.`

                        ),

                    mentions: [
                        targetJid
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error warnings: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE WARNINGS',

                                'No se pudieron consultar las advertencias.'

                            )

                    }

                )

            } catch {}

        }

    }

}