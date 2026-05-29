const axios =
    require('axios')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

const MAX_QUESTION = 500

const MAX_RESPONSE = 3500

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

    cooldown: 5,

    async execute({
        sock,
        from,
        args
    }) {

        try {

            const question =
                args.join(' ')
                .replace(/\s+/g, ' ')
                .trim()

            if (!question) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'PREGUNTA REQUERIDA',
                                'Uso: /ia pregunta'
                            )
                    }
                )

            }

            if (question.length > MAX_QUESTION) {

                return await sock.sendMessage(
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

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.info(
                            'IA',
                            [
                                ['Estado', 'Pensando...']
                            ]
                        )
                }
            )

            const response =
                await axios.get(
                    'https://api.siputzx.my.id/api/ai/gpt3',
                    {
                        params: {
                            prompt: question
                        },
                        timeout: 30000
                    }
                )

            let answer =
                response.data?.data ||
                response.data?.result ||
                response.data?.response ||
                'No pude generar una respuesta.'

            answer =
                String(answer)
                .trim()

            if (answer.length > MAX_RESPONSE) {
                answer =
                    answer.slice(0, MAX_RESPONSE) + '\n\n...'
            }

            logger.event(
                `IA usada`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            'RESPUESTA IA',
                            [
                                ['Respuesta', answer]
                            ]
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error ia: ${err.message}`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.error(
                            'ERROR',
                            'La IA no respondió.\nIntenta nuevamente en unos momentos.'
                        )
                }
            )

        }

    }

}