const axios =
    require('axios')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


const MAX_QUESTION =
    500

const MAX_RESPONSE =
    3500

const API_URL =
    'https://api.siputzx.my.id/api/ai/gpt3'


function normalizeText(
    text
) {

    return String(
        text || ''
    )
        .replace(
            /\s+/g,
            ' '
        )
        .trim()

}


function extractAnswer(
    data
) {

    if (!data) {

        return null

    }


    const candidates = [

        data.data,

        data.result,

        data.response,

        data.answer,

        data.message

    ]


    for (
        const value of candidates
    ) {

        if (
            typeof value === 'string' &&
            value.trim()
        ) {

            return value.trim()

        }


        if (
            value &&
            typeof value === 'object'
        ) {

            const nested = [

                value.result,

                value.response,

                value.answer,

                value.message,

                value.text

            ]


            for (
                const nestedValue of nested
            ) {

                if (
                    typeof nestedValue === 'string' &&
                    nestedValue.trim()
                ) {

                    return nestedValue.trim()

                }

            }

        }

    }


    return null

}


module.exports = {

    name:
        'ia',

    aliases: [
        'ai',
        'gpt',
        'chatgpt'
    ],

    description:
        'Pregúntale algo a la IA',

    category:
        'general',

    cooldown:
        5,


    async execute({

        sock,
        from,
        args = []

    }) {

        try {

            /* ─────────────────────────────
               PREGUNTA
            ───────────────────────────── */

            const question =
                normalizeText(

                    args.join(
                        ' '
                    )

                )


            if (!question) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'PREGUNTA REQUERIDA',

                                [
                                    'Debes escribir una pregunta.',
                                    '',
                                    'Uso:',
                                    '/ia ¿Cuál es la capital de Japón?'
                                ].join('\n')

                            )

                    }

                )

            }


            if (
                question.length >
                MAX_QUESTION
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'PREGUNTA MUY LARGA',

                                `Máximo ${MAX_QUESTION} caracteres.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ESTADO
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.info(

                            'IA',

                            [
                                [
                                    'Estado',
                                    'Pensando...'
                                ]
                            ]

                        )

                }

            )


            /* ─────────────────────────────
               CONSULTA API
            ───────────────────────────── */

            const response =
                await axios.get(

                    API_URL,

                    {

                        params: {

                            prompt:
                                question

                        },

                        timeout:
                            30000,

                        validateStatus:
                            status =>
                                status >= 200 &&
                                status < 300

                    }

                )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            let answer =
                extractAnswer(
                    response.data
                )


            if (!answer) {

                throw new Error(
                    'La API respondió sin contenido válido'
                )

            }


            if (
                answer.length >
                MAX_RESPONSE
            ) {

                answer =

                    answer.slice(
                        0,
                        MAX_RESPONSE
                    )

                    +

                    '\n\n...'

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `IA usada | pregunta=${question.length} chars | respuesta=${answer.length} chars`

            )


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            'RESPUESTA IA',

                            [
                                [
                                    'Respuesta',
                                    answer
                                ]
                            ]

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error ia: ${err.stack || err.message}`

            )


            let errorMessage =
                'La IA no respondió.\nIntenta nuevamente en unos momentos.'


            if (
                err.code ===
                'ECONNABORTED'
            ) {

                errorMessage =
                    'La IA tardó demasiado en responder.\nIntenta nuevamente.'

            }


            if (
                err.response?.status
            ) {

                errorMessage =
                    `La API de IA respondió con error ${err.response.status}.`

            }


            try {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR IA',

                                errorMessage

                            )

                    }

                )

            } catch {}

        }

    }

}