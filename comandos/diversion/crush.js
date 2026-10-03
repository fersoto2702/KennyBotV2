const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


function getPercent(text) {

    let hash = 0

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i)

        hash |= 0

    }

    return Math.abs(hash % 101)

}


function getResult(percent) {

    if (percent <= 20)
        return '😬 Ni te topa'

    if (percent <= 40)
        return '😅 Hay esperanza'

    if (percent <= 60)
        return '😊 Interés moderado'

    if (percent <= 80)
        return '😍 Le gustas bastante'

    return '💘 Crush confirmado'

}


module.exports = {

    name:
        'crush',

    aliases: [
        'amor'
    ],

    description:
        'Calcula la posibilidad de ser el crush de alguien',

    category:
        'diversion',

    cooldown:
        3,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            /* ─────────────────────────────
               MENCIONES
            ───────────────────────────── */

            const mentions =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid || []


            let target = ''
            let targetJid = null


            /* ─────────────────────────────
               OBJETIVO
            ───────────────────────────── */

            if (mentions.length > 0) {

                targetJid =
                    mentions[0]

                target =
                    `@${targetJid.split('@')[0]}`

            } else {

                target =
                    args
                        .join(' ')
                        .trim()

            }


            /* ─────────────────────────────
               VALIDACIÓN
            ───────────────────────────── */

            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'OBJETIVO REQUERIDO',

                                'Menciona a alguien o escribe un nombre.\n\nUso: /crush @usuario'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CÁLCULO
            ───────────────────────────── */

            const seed =

                targetJid
                    ? targetJid.split('@')[0]
                    : target.toLowerCase()


            const percent =
                getPercent(seed)


            const result =
                getResult(percent)


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const text =
                ui.success(

                    '💘 CRUSH',

                    [

                        [
                            'Objetivo',
                            target
                        ],

                        [
                            'Probabilidad',
                            `${percent}%`
                        ],

                        [
                            'Resultado',
                            result
                        ]

                    ],

                    'Resultado generado solo por diversión.'

                )


            const message = {

                text

            }


            if (targetJid) {

                message.mentions = [
                    targetJid
                ]

            }


            await sock.sendMessage(

                from,

                message

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Crush: ${seed} (${percent}%)`

            )


        } catch (err) {

            logger.error(

                `Error crush: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR INTERNO',

                                'No se pudo calcular el resultado del crush.'

                            )

                    }

                )

            } catch {}

        }

    }

}