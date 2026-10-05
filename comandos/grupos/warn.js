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


function findBotParticipant(
    participants,
    sock
) {

    const candidates = [

        sock.user?.id,

        sock.user?.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )


    for (
        const candidate
        of candidates
    ) {

        const participant =
            findParticipant(
                participants,
                candidate
            )


        if (participant) {

            return participant

        }

    }


    return null

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
        'warn',

    aliases: [
        'advertir',
        'strike'
    ],

    description:
        'Advierte a un usuario del grupo',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        msg,
        args

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

                                'Solo los administradores pueden advertir usuarios.'

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

                                'Menciona al usuario que quieres advertir.\n\nUso: /warn @usuario motivo'

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
               PROTECCIONES
            ───────────────────────────── */

            if (
                targetData ===
                senderData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes advertirte a ti mismo.'

                            )

                    }

                )

            }


            const botData =
                findBotParticipant(

                    participants,

                    sock

                )


            if (
                botData &&
                botData === targetData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes advertir a KennyBot.'

                            )

                    }

                )

            }


            if (
                targetData.admin ===
                'superadmin'
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO PROTEGIDO',

                                'No puedes advertir al creador del grupo.'

                            )

                    }

                )

            }


            if (
                isAdministrator(
                    targetData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO PROTEGIDO',

                                'No puedes advertir a otro administrador.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               MOTIVO
            ───────────────────────────── */

            const reason =
                args
                    .filter(
                        arg =>
                            !String(arg)
                                .startsWith('@')
                    )
                    .join(' ')
                    .trim()
                ||
                'Sin motivo especificado'


            /* ─────────────────────────────
               WARNS
            ───────────────────────────── */

            const warns =
                readWarns()


            let warnKey =
                findWarnKey(

                    warns,

                    targetJid

                )


            if (!warnKey) {

                warnKey =
                    targetJid


                warns[warnKey] = {
                    warns: 0
                }

            }


            if (
                !warns[warnKey] ||
                typeof warns[warnKey] !== 'object'
            ) {

                warns[warnKey] = {
                    warns: 0
                }

            }


            const previousWarns =
                Number(
                    warns[warnKey].warns
                )


            warns[warnKey].warns =
                Number.isFinite(
                    previousWarns
                )
                    ? previousWarns
                    : 0


            warns[warnKey].warns =
                Math.min(

                    MAX_WARNS,

                    warns[warnKey].warns + 1

                )


            const total =
                warns[warnKey].warns


            /*
                Guardamos antes del auto-kick.

                Si WhatsApp rechaza la expulsión,
                el usuario conserva sus 3 warns.
            */

            saveWarns(
                warns
            )


            const bar =
                createWarnBar(
                    total
                )


            /* ─────────────────────────────
               LOG WARN
            ───────────────────────────── */

            logger.event(

                `Warn: ${getNumber(targetJid)} → ${total}/${MAX_WARNS} | ${reason} | por ${getNumber(sender)}`

            )


            /* ─────────────────────────────
               ADVERTENCIA
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '⚠️ ADVERTENCIA EMITIDA',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],

                                [
                                    'Motivo',
                                    reason
                                ],

                                [
                                    'Warns',
                                    `${bar} ${total}/${MAX_WARNS}`
                                ],

                                [
                                    'Advertido por',
                                    `@${getNumber(sender)}`
                                ]

                            ],

                            total >= MAX_WARNS
                                ? 'El usuario alcanzó el límite máximo de advertencias.'
                                : `Al llegar a ${MAX_WARNS}/${MAX_WARNS}, el usuario será expulsado automáticamente.`

                        ),

                    mentions: [
                        targetJid,
                        sender
                    ]

                }

            )


            /* ─────────────────────────────
               AÚN NO LLEGA AL LÍMITE
            ───────────────────────────── */

            if (
                total <
                MAX_WARNS
            ) {

                return

            }


            /* ─────────────────────────────
               AUTO-KICK
            ───────────────────────────── */

            if (
                !botData ||
                !isAdministrator(
                    botData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'LÍMITE ALCANZADO',

                                `@${getNumber(targetJid)} llegó a ${MAX_WARNS}/${MAX_WARNS} warns, pero KennyBot no tiene permisos de administrador para expulsarlo.`

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            const response =
                await sock.groupParticipantsUpdate(

                    from,

                    [
                        targetJid
                    ],

                    'remove'

                )


            const result =
                Array.isArray(response)
                    ? response[0]
                    : null


            const status =
                String(
                    result?.status || ''
                )


            /* ─────────────────────────────
               ERROR AUTO-KICK
            ───────────────────────────── */

            if (
                status &&
                status !== '200'
            ) {

                let reasonText =
                    `WhatsApp respondió con el código ${status}.`


                if (
                    status === '403'
                ) {

                    reasonText =
                        'KennyBot no tiene permisos suficientes para expulsar al usuario.'

                }


                else if (
                    status === '404'
                ) {

                    reasonText =
                        'El usuario ya no parece formar parte del grupo.'

                }


                else if (
                    status === '408'
                ) {

                    reasonText =
                        'La solicitud de expulsión expiró.'

                }


                logger.warn(

                    `AutoKick Warn falló: ${getNumber(targetJid)} | status ${status}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'AUTO-KICK FALLIDO',

                                [
                                    `@${getNumber(targetJid)} llegó a ${MAX_WARNS}/${MAX_WARNS} advertencias.`,
                                    '',
                                    reasonText,
                                    '',
                                    'Sus advertencias permanecerán guardadas.'
                                ].join('\n')

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               EXPULSIÓN EXITOSA
            ───────────────────────────── */

            delete warns[
                warnKey
            ]


            saveWarns(
                warns
            )


            logger.event(

                `AutoKick por warns: ${getNumber(targetJid)} de ${from.split('@')[0]}`

            )


            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            '🚪 USUARIO EXPULSADO',

                            `@${getNumber(targetJid)} acumuló ${MAX_WARNS} advertencias y fue expulsado automáticamente.`

                        ),

                    mentions: [
                        targetJid
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error warn: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE WARN',

                                'No se pudo registrar la advertencia.'

                            )

                    }

                )

            } catch {}

        }

    }

}