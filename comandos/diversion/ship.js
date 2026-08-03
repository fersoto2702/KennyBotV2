const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/ship.jpeg'
    )

function getCompatibility(a, b) {

    const text =
        `${a}${b}`
            .toLowerCase()

    let hash = 0

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i)

        hash |= 0

    }

    return Math.abs(hash % 101)

}

function getBar(percent) {

    const filled =
        Math.floor(percent / 10)

    return (
        '█'.repeat(filled) +
        '░'.repeat(10 - filled)
    )

}

function getStatus(percent) {

    if (percent <= 20)
        return '💔 Imposible'

    if (percent <= 50)
        return '😅 Difícil'

    if (percent <= 80)
        return '💕 Buena pareja'

    return '💍 Destinados'

}

function shuffle(array) {

    const result =
        [...array]

    for (let i = result.length - 1; i > 0; i--) {

        const j =
            Math.floor(Math.random() * (i + 1))

        ;[result[i], result[j]] =
            [result[j], result[i]]

    }

    return result

}

module.exports = {

    name: 'ship',

    aliases: [

        'love',
        'compatibilidad'

    ],

    description:
        'Calcula la compatibilidad entre dos personas o genera ships aleatorios del grupo',

    category:
        'diversion',

    groupOnly: true,

    cooldown: 5,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            const mentions =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid || []

            const requestedCount =
                parseInt(args[0], 10)

            const hasRequestedCount =
                args.length === 1 &&
                !isNaN(requestedCount) &&
                requestedCount > 0

            if (
                (mentions.length < 2 && args.length < 2) ||
                hasRequestedCount
            ) {

                const metadata =
                    await sock.groupMetadata(from)

                const participants =
                    (metadata.participants || [])
                        .map(p => p.id)

                if (participants.length < 2) {

                    return await sock.sendMessage(
                        from,
                        {
                            image:
                                fs.readFileSync(iconPath),

                            caption:
                                ui.warn(
                                    'GRUPO INSUFICIENTE',
                                    'No hay suficientes integrantes para generar ships.'
                                )
                        }
                    )

                }

                const shuffled =
                    shuffle(participants)

                const maxPairs =
                    Math.floor(shuffled.length / 2)

                const pairsCount =
                    hasRequestedCount ?
                        Math.min(requestedCount, maxPairs) :
                        maxPairs

                const lines = []
                const allMentions = []

                for (let i = 0; i < pairsCount; i++) {

                    const userA =
                        shuffled[i * 2]

                    const userB =
                        shuffled[i * 2 + 1]

                    const percent =
                        getCompatibility(
                            userA,
                            userB
                        )

                    const status =
                        getStatus(percent)

                    lines.push([
                        `@${userA.split('@')[0]} ❤️ @${userB.split('@')[0]}`,
                        `${percent}% ${status}`
                    ])

                    allMentions.push(userA, userB)

                }

                if (!hasRequestedCount && shuffled.length % 2 !== 0) {

                    const leftover =
                        shuffled[shuffled.length - 1]

                    const partner =
                        shuffled[
                            Math.floor(Math.random() * pairsCount) * 2
                        ]

                    const percent =
                        getCompatibility(
                            leftover,
                            partner
                        )

                    const status =
                        getStatus(percent)

                    lines.push([
                        `@${leftover.split('@')[0]} ❤️ @${partner.split('@')[0]}`,
                        `${percent}% ${status}`
                    ])

                    allMentions.push(leftover, partner)

                }

                logger.event(
                    `Ship aleatorio en ${from.split('@')[0]}: ${lines.length} parejas`
                )

                const caption =
                    [
                        `▓ SHIPS DEL GRUPO`,
                        ui.divider,
                        ...lines.map(
                            ([pair, result]) =>
                                `${pair}\n${result}`
                        )
                    ].join('\n\n')

                return await sock.sendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption,

                        mentions: allMentions
                    }
                )

            }

            let person1
            let person2

            if (mentions.length >= 2) {

                person1 =
                    `@${mentions[0].split('@')[0]}`

                person2 =
                    `@${mentions[1].split('@')[0]}`

            } else {

                person1 =
                    args[0]

                person2 =
                    args.slice(1).join(' ')

            }

            const percent =
                getCompatibility(
                    person1,
                    person2
                )

            const bar =
                getBar(percent)

            const status =
                getStatus(percent)

            logger.event(
                `Ship: ${person1} ❤️ ${person2} (${percent}%)`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.success(
                            'SHIP',
                            [
                                [
                                    'Pareja',
                                    `${person1} ❤️ ${person2}`
                                ],
                                [
                                    'Compatibilidad',
                                    `${percent}%`
                                ],
                                [
                                    'Barra',
                                    bar
                                ],
                                [
                                    'Resultado',
                                    status
                                ]
                            ]
                        ),

                    mentions
                }
            )

        } catch (err) {

            logger.error(
                `Error ship: ${err.message}`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.error(
                            'ERROR',
                            'No se pudo calcular la compatibilidad.'
                        )
                }
            )

        }

    }

}