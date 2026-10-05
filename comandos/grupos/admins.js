const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const dbPath =
    path.join(
        __dirname,
        '../../database/soloadmins.json'
    )


function ensureDatabaseFile() {

    const directory =
        path.dirname(
            dbPath
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
            dbPath
        )
    ) {

        fs.writeFileSync(
            dbPath,
            JSON.stringify(
                [],
                null,
                2
            ),
            'utf8'
        )

    }

}


function readData() {

    ensureDatabaseFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    dbPath,
                    'utf8'
                )
            )


        return Array.isArray(data)
            ? data
            : []

    } catch (err) {

        logger.error(
            `Error leyendo soloadmins.json: ${err.message}`
        )

        return []

    }

}


function saveData(data) {

    fs.writeFileSync(
        dbPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeParticipantJid(
    participant
) {

    if (!participant) {

        return null

    }


    if (
        typeof participant === 'string'
    ) {

        return participant

    }


    return (
        participant.phoneNumber ||
        participant.id ||
        null
    )

}


function findParticipant(
    participants,
    jid
) {

    const targetNumber =
        String(jid || '')
            .split('@')[0]


    return participants.find(

        participant => {

            const participantJid =
                normalizeParticipantJid(
                    participant
                )


            if (!participantJid) {

                return false

            }


            const participantNumber =
                participantJid
                    .split('@')[0]


            return (
                participantJid === jid ||
                participantNumber === targetNumber
            )

        }

    )

}


function isAdministrator(
    participant
) {

    return (
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin'
    )

}


module.exports = {

    name:
        'admins',

    aliases: [
        'adminmode',
        'onlyadmin',
        'soloadmins'
    ],

    description:
        'Restringe el uso del bot solo a administradores',

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


            /* ─────────────────────────────
               VALIDAR ADMIN
            ───────────────────────────── */

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

                                'Solo los administradores pueden cambiar este modo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

            let data =
                readData()


            const option =
                String(
                    args?.[0] || ''
                )
                    .trim()
                    .toLowerCase()


            const enabled =
                data.includes(
                    from
                )


            /* ─────────────────────────────
               ACTIVAR
            ───────────────────────────── */

            if (
                option === 'on'
            ) {

                if (
                    !enabled
                ) {

                    data.push(
                        from
                    )


                    saveData(
                        data
                    )

                }


                logger.event(

                    `Admins ON: ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '👑 MODO SOLO ADMINS',

                                [

                                    [
                                        'Estado',
                                        '● ACTIVADO'
                                    ],

                                    [
                                        'Configurado por',
                                        `@${sender.split('@')[0]}`
                                    ]

                                ],

                                enabled
                                    ? 'El modo ya estaba activado.'
                                    : 'Ahora solo los administradores podrán usar el bot.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               DESACTIVAR
            ───────────────────────────── */

            if (
                option === 'off'
            ) {

                if (
                    enabled
                ) {

                    data =
                        data.filter(
                            id =>
                                id !== from
                        )


                    saveData(
                        data
                    )

                }


                logger.event(

                    `Admins OFF: ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '👑 MODO SOLO ADMINS',

                                [

                                    [
                                        'Estado',
                                        '○ DESACTIVADO'
                                    ],

                                    [
                                        'Configurado por',
                                        `@${sender.split('@')[0]}`
                                    ]

                                ],

                                enabled
                                    ? 'Todos los usuarios podrán volver a usar el bot.'
                                    : 'El modo ya estaba desactivado.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ESTADO ACTUAL
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '👑 MODO SOLO ADMINS',

                            [

                                [
                                    'Estado',
                                    enabled
                                        ? '● ACTIVADO'
                                        : '○ DESACTIVADO'
                                ],

                                [
                                    'Grupo',
                                    metadata?.subject ||
                                    'Desconocido'
                                ]

                            ],

                            [
                                'Uso:',
                                '/admins on',
                                '/admins off',
                                '',
                                'También puedes usar:',
                                '/soloadmins on',
                                '/soloadmins off'
                            ].join('\n')

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error admins: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE CONFIGURACIÓN',

                                'No se pudo cambiar el modo solo administradores.'

                            )

                    }

                )

            } catch {}

        }

    }

}