const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const mutePath =
    path.join(
        __dirname,
        '../../database/mute.json'
    )


function ensureMuteFile() {

    const directory =
        path.dirname(
            mutePath
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
            mutePath
        )
    ) {

        fs.writeFileSync(
            mutePath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readMuteData() {

    ensureMuteFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    mutePath,
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
            `Error leyendo mute.json: ${err.message}`
        )

        return {}

    }

}


function saveMuteData(
    data
) {

    fs.writeFileSync(
        mutePath,
        JSON.stringify(
            data,
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


function isAdministrator(
    participant
) {

    return (

        participant?.admin === 'admin' ||

        participant?.admin === 'superadmin'

    )

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


function getBotParticipant(
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

        const found =
            findParticipant(
                participants,
                candidate
            )


        if (found) {

            return found

        }

    }


    return null

}


module.exports = {

    name:
        'mute',

    aliases: [
        'silenciar',
        'mutear'
    ],

    description:
        'Silencia a un usuario del grupo (borra sus mensajes)',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        args,
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

                                'Solo los administradores pueden usar este comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

            const data =
                readMuteData()


            if (
                !Array.isArray(
                    data[from]
                )
            ) {

                data[from] = []

            }


            /* ─────────────────────────────
               OBJETIVO
            ───────────────────────────── */

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


            const firstArg =
                String(
                    args?.[0] || ''
                )
                    .trim()
                    .toLowerCase()


            const isKeyword =
                firstArg === 'on' ||
                firstArg === 'off'


            const rawNumber =
                args?.[0] &&
                !isKeyword
                    ? String(
                        args[0]
                    )
                        .replace(
                            /\D/g,
                            ''
                        )
                    : ''


            const numberTarget =
                rawNumber
                    ? `${rawNumber}@s.whatsapp.net`
                    : null


            const targetInput =

                mentioned ||

                quotedParticipant ||

                numberTarget


            if (
                !targetInput
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'FALTA USUARIO',

                                [
                                    'Menciona a alguien, responde a su mensaje o escribe su número.',
                                    '',
                                    'Ejemplos:',
                                    '/mute @usuario',
                                    '/mute @usuario off',
                                    '/mute 521234567890',
                                    '(respondiendo un mensaje) /mute',
                                    '(respondiendo un mensaje) /mute off'
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PARTICIPANTE
            ───────────────────────────── */

            const targetData =
                findParticipant(
                    participants,
                    targetInput
                )


            if (
                !targetData
            ) {

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


            const target =

                targetData.id ||

                targetData.phoneNumber ||

                normalizeJid(
                    targetInput
                )


            /* ─────────────────────────────
               OPCIÓN
            ───────────────────────────── */

            const option =
                String(
                    args?.[
                        args.length - 1
                    ] || ''
                )
                    .trim()
                    .toLowerCase()


            const disableMute =
                option === 'off'


            /* ─────────────────────────────
               PROTECCIONES
            ───────────────────────────── */

            const botData =
                getBotParticipant(
                    participants,
                    sock
                )


            if (
                botData &&
                botData ===
                targetData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes silenciar a KennyBot.'

                            )

                    }

                )

            }


            if (
                senderData ===
                targetData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes silenciarte a ti mismo.'

                            )

                    }

                )

            }


            /*
                Permitimos /mute off sobre cualquier
                objetivo guardado, pero para activar
                protegemos administradores.
            */

            if (
                !disableMute &&
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

                                'No puedes silenciar a un administrador del grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DESACTIVAR MUTE
            ───────────────────────────── */

            if (
                disableMute
            ) {

                const wasMuted =
                    data[from].includes(
                        target
                    )


                data[from] =
                    data[from]
                        .filter(
                            id =>
                                id !== target
                        )


                saveMuteData(
                    data
                )


                logger.event(

                    `Unmute: ${getNumber(target)} por ${getNumber(sender)} en ${from.split('@')[0]}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '🔊 USUARIO ACTIVADO',

                                [

                                    [
                                        'Usuario',
                                        `@${getNumber(target)}`
                                    ],

                                    [
                                        'Estado',
                                        '○ MUTE DESACTIVADO'
                                    ],

                                    [
                                        'Configurado por',
                                        `@${getNumber(sender)}`
                                    ]

                                ],

                                wasMuted
                                    ? 'El usuario puede volver a enviar mensajes normalmente.'
                                    : 'El usuario no estaba silenciado.'

                            ),

                        mentions: [
                            target,
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ACTIVAR MUTE
            ───────────────────────────── */

            const alreadyMuted =
                data[from].includes(
                    target
                )


            if (
                !alreadyMuted
            ) {

                data[from].push(
                    target
                )


                saveMuteData(
                    data
                )

            }


            logger.event(

                `Mute: ${getNumber(target)} por ${getNumber(sender)} en ${from.split('@')[0]}`

            )


            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🔇 USUARIO SILENCIADO',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(target)}`
                                ],

                                [
                                    'Estado',
                                    '● MUTE ACTIVADO'
                                ],

                                [
                                    'Configurado por',
                                    `@${getNumber(sender)}`
                                ]

                            ],

                            alreadyMuted
                                ? 'El usuario ya estaba silenciado.'
                                : 'Los mensajes de este usuario serán eliminados automáticamente.'

                        ),

                    mentions: [
                        target,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error mute: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE MUTE',

                                'No se pudo cambiar el estado de silencio del usuario.'

                            )

                    }

                )

            } catch {}

        }

    }

}