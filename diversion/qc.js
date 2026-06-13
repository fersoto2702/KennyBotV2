const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/qc.jpeg'
    )

module.exports = {

    name: 'qc',

    aliases: [

        'quote',
        'cita'

    ],

    description:
        'Muestra una cita de un mensaje respondido',

    category:
        'diversion',

    cooldown: 3,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            const quoted =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.quotedMessage

            if (!quoted) {

                return await sock.sendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                'Responde a un mensaje y usa /qc'
                            )
                    }
                )

            }

            let quoteText =
                null

            if (quoted?.conversation) {

                quoteText =
                    quoted.conversation

            }

            else if (
                quoted?.extendedTextMessage?.text
            ) {

                quoteText =
                    quoted.extendedTextMessage.text

            }

            if (!quoteText) {

                return await sock.sendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'NO COMPATIBLE',
                                'Solo puedes citar mensajes de texto.'
                            )
                    }
                )

            }

            const author =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.participant ||
                'Desconocido'

            logger.event(
                `QC usado: ${author}`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.info(
                            'QUOTE',
                            [
                                [
                                    'Autor',
                                    `@${author.split('@')[0]}`
                                ],
                                [
                                    'Mensaje',
                                    quoteText.length > 300
                                        ? quoteText.slice(0, 300) + '...'
                                        : quoteText
                                ]
                            ]
                        ),

                    mentions: [
                        author
                    ]
                }
            )

        } catch (err) {

            logger.error(
                `Error qc: ${err.message}`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.error(
                            'ERROR',
                            'No se pudo generar la cita.'
                        )
                }
            )

        }

    }

}