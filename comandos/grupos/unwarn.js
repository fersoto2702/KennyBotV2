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
        'unwarn',

    aliases: [
        'removewarn',
        'delwarn'
    ],

    description:
        'Elimina un warn a un usuario',

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

            if (!from.endsWith('@g.us')) {

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

            if (!fs.existsSync(warnsPath)) {
                fs.writeFileSync(
                    warnsPath,
                    JSON.stringify({}, null, 2)
                )
            }

            let warns = {}

            try {
                warns =
                    JSON.parse(
                        fs.readFileSync(warnsPath)
                    )
            } catch {
                warns = {}
            }

            const metadata =
                await sock.groupMetadata(from)

            const participants =
                metadata.participants

            const sender =
                msg.key.participant ||
                msg.participant

            const senderData =
                participants.find(
                    p => p.id === sender
                )

            const isAdmin =
                senderData?.admin === 'admin' ||
                senderData?.admin === 'superadmin'

            if (!isAdmin) {

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

            const target =
                msg.message
                ?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

            if (!target) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'USUARIO REQUERIDO',
                                'Uso: /unwarn @usuario'
                            )
                    }
                )

            }

            const targetData =
                participants.find(
                    p => p.id === target
                )

            if (!targetData) {

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

            if (!warns[target]) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN WARNS',
                                'Ese usuario no tiene advertencias.'
                            )
                    }
                )

            }

            if (typeof warns[target].warns !== 'number') {
                warns[target].warns = 0
            }

            warns[target].warns -= 1

            if (warns[target].warns <= 0) {
                delete warns[target]
            }

            fs.writeFileSync(
                warnsPath,
                JSON.stringify(warns, null, 2)
            )

            const total =
                warns[target]?.warns || 0

            const bar =
                '●'.repeat(total) +
                '○'.repeat(3 - total)

            logger.event(
                `Unwarn: ${target.split('@')[0]} → ${total}/3`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            'WARN ELIMINADO',
                            [
                                ['Usuario', `@${target.split('@')[0]}`],
                                ['Warns', `${bar} ${total}/3`]
                            ]
                        ),
                    mentions: [target]
                }
            )

        } catch (err) {

            logger.error(
                `Error unwarn: ${err.message}`
            )

        }

    }

}