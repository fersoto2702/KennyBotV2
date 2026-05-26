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
        'warnings',

    aliases: [

        'warns',
        'checkwarns'

    ],

    description:
        'Muestra los warns de un usuario',

    category:
        'grupos',

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        msg

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

                                'Uso: /warnings @usuario'

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
            // TOTAL
            // =========================

            let total =
                warns[target]?.warns || 0

            if (
                typeof total !== 'number'
            ) {

                total = 0

            }

            if (
                total < 0
            ) {

                total = 0

            }

            if (
                total > 3
            ) {

                total = 3

            }

            // =========================
            // VISUAL BAR
            // =========================

            const bar =

                '●'.repeat(total) +

                '○'.repeat(3 - total)

            // =========================
            // STATUS
            // =========================

            let status = '✓ Limpio'

            if (
                total >= 3
            ) {

                status = '⚠ En límite'

            }

            else if (
                total > 0
            ) {

                status = '● Activo'

            }

            logger.event(

                `Warnings check: ${target.split('@')[0]} → ${total}/3`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'ADVERTENCIAS',

                            [

                                [

                                    'Usuario',

                                    `@${target.split('@')[0]}`

                                ],

                                [

                                    'Warns',

                                    `${bar} ${total}/3`

                                ],

                                [

                                    'Estado',

                                    status

                                ]

                            ]

                        ),

                    mentions: [

                        target

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error warnings: ${err.message}`
            )

        }

    }

}