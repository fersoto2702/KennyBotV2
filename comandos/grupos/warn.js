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

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        msg,
        args

    }) {

        try {

            // =========================
            // GROUP CHECK
            // =========================

            if (
                !from.endsWith('@g.us')
            ) {

                return await sock.sendMessage(

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

            // =========================
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(warnsPath)
            ) {

                fs.writeFileSync(

                    warnsPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let warns = {}

            try {

                warns =
                    JSON.parse(

                        fs.readFileSync(
                            warnsPath
                        )

                    )

            } catch {

                warns = {}

            }

            // =========================
            // METADATA
            // =========================

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const participants =
                metadata.participants

            const sender =

                msg.key.participant ||

                msg.participant

            // =========================
            // ADMIN CHECK
            // =========================

            const senderData =

                participants.find(

                    p => p.id === sender

                )

            const isAdmin =

                senderData?.admin === 'admin' ||

                senderData?.admin === 'superadmin'

            if (
                !isAdmin
            ) {

                return await sock.sendMessage(

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

            // =========================
            // BOT ADMIN
            // =========================

            const botId =
                sock.user.id.split(':')[0]

            const botData =

                participants.find(

                    p => p.id.includes(botId)

                )

            const botAdmin =

                botData?.admin === 'admin' ||

                botData?.admin === 'superadmin'

            // =========================
            // TARGET
            // =========================

            const target =

                msg.message
                ?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

            if (
                !target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Uso: /warn @usuario motivo'

                            )

                    }

                )

            }

            // =========================
            // TARGET EXISTS
            // =========================

            const targetData =

                participants.find(

                    p => p.id === target

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

                                'Ese usuario no está en el grupo.'

                            )

                    }

                )

            }

            // =========================
            // SELF CHECK
            // =========================

            if (
                target === sender
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

            // =========================
            // BOT PROTECTION
            // =========================

            const botJid =
                sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (
                target === botJid
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes advertir al bot.'

                            )

                    }

                )

            }

            // =========================
            // ADMIN PROTECTION
            // =========================

            const targetAdmin =

                targetData?.admin === 'admin' ||

                targetData?.admin === 'superadmin'

            if (
                targetAdmin
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCIÓN INVÁLIDA',

                                'No puedes advertir a un administrador.'

                            )

                    }

                )

            }

            // =========================
            // REASON
            // =========================

            const reason =

                args.slice(1)
                .join(' ')
                .trim()

                || 'Sin motivo'

            // =========================
            // CREATE USER
            // =========================

            if (
                !warns[target]
            ) {

                warns[target] = {

                    warns: 0

                }

            }

            // =========================
            // FIX VALUE
            // =========================

            if (
                typeof warns[target].warns !== 'number'
            ) {

                warns[target].warns = 0

            }

            // =========================
            // ADD WARN
            // =========================

            warns[target].warns += 1

            if (
                warns[target].warns > 3
            ) {

                warns[target].warns = 3

            }

            // =========================
            // SAVE
            // =========================

            fs.writeFileSync(

                warnsPath,

                JSON.stringify(
                    warns,
                    null,
                    2
                )

            )

            // =========================
            // TOTAL
            // =========================

            const total =
                warns[target].warns

            const bar =

                '●'.repeat(total) +

                '○'.repeat(3 - total)

            logger.event(

                `Warn: ${target.split('@')[0]} → ${total}/3 (${reason})`

            )

            // =========================
            // SEND WARN
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'ADVERTENCIA EMITIDA',

                            [

                                [

                                    'Usuario',

                                    `@${target.split('@')[0]}`

                                ],

                                [

                                    'Motivo',

                                    reason

                                ],

                                [

                                    'Warns',

                                    `${bar} ${total}/3`

                                ]

                            ]

                        ),

                    mentions: [

                        target

                    ]

                }

            )

            // =========================
            // AUTO KICK
            // =========================

            if (
                total >= 3
            ) {

                // BOT ADMIN CHECK

                if (
                    !botAdmin
                ) {

                    return await sock.sendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'LÍMITE ALCANZADO',

                                    'El usuario llegó a 3 warns, pero el bot no tiene permisos para expulsarlo.'

                                )

                        }

                    )

                }

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO EXPULSADO',

                                `@${target.split('@')[0]} acumuló 3 advertencias.`

                            ),

                        mentions: [

                            target

                        ]

                    }

                )

                await sock.groupParticipantsUpdate(

                    from,

                    [target],

                    'remove'

                )

                logger.event(

                    `Auto kick por warns: ${target.split('@')[0]}`

                )

                delete warns[target]

                fs.writeFileSync(

                    warnsPath,

                    JSON.stringify(
                        warns,
                        null,
                        2
                    )

                )

            }

        } catch (err) {

            logger.error(
                `Error warn: ${err.message}`
            )

        }

    }

}