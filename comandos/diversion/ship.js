const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


function getCompatibility(a, b) {

    const pair =
        [
            String(a).toLowerCase(),
            String(b).toLowerCase()
        ]
            .sort()
            .join('|')


    let hash = 0


    for (let i = 0; i < pair.length; i++) {

        hash =
            ((hash << 5) - hash) +
            pair.charCodeAt(i)

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


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            )


        ;[
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ]

    }


    return result

}


function normalizeName(value = '') {

    const clean =
        String(value)
            .trim()

    if (!clean)
        return ''

    return clean.startsWith('@')
        ? clean
        : `@${clean}`

}


function displayJid(jid = '') {

    if (!jid)
        return '@desconocido'

    return `@${jid.split('@')[0]}`

}


module.exports = {

    name:
        'ship',

    aliases: [
        'love',
        'compatibilidad'
    ],

    description:
        'Calcula la compatibilidad entre dos personas o genera ships aleatorios del grupo',

    category:
        'diversion',

    groupOnly:
        true,
async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            if (
                !from ||
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


            const mentions =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid || []


            const requestedCount =
                parseInt(
                    args?.[0],
                    10
                )


            const hasRequestedCount =

                args?.length === 1 &&

                !Number.isNaN(
                    requestedCount
                ) &&

                requestedCount > 0


            /* ─────────────────────────────
               SHIPS ALEATORIOS
            ───────────────────────────── */

            if (
                (
                    mentions.length < 2 &&
                    args.length < 2
                ) ||
                hasRequestedCount
            ) {

                const metadata =
                    await sock.groupMetadata(
                        from
                    )


                const participants =

                    (
                        metadata.participants ||
                        []
                    )
                        .map(
                            participant =>
                                participant.id
                        )
                        .filter(Boolean)


                if (
                    participants.length < 2
                ) {

                    return await sock.sendMessage(

                        from,

                        {

                            text:
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
                    Math.floor(
                        shuffled.length / 2
                    )


                const pairsCount =

                    hasRequestedCount

                        ? Math.min(
                            requestedCount,
                            maxPairs
                        )

                        : maxPairs


                const lines = []

                const allMentions = []


                for (
                    let i = 0;
                    i < pairsCount;
                    i++
                ) {

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
                        getStatus(
                            percent
                        )


                    lines.push(
                        [
                            `${displayJid(userA)} ❤️ ${displayJid(userB)}`,
                            `${percent}% ${status}`
                        ]
                    )


                    allMentions.push(
                        userA,
                        userB
                    )

                }


                if (
                    !hasRequestedCount &&
                    shuffled.length % 2 !== 0 &&
                    pairsCount > 0
                ) {

                    const leftover =
                        shuffled[
                            shuffled.length - 1
                        ]


                    const partner =
                        shuffled[
                            Math.floor(
                                Math.random() *
                                pairsCount
                            ) * 2
                        ]


                    const percent =
                        getCompatibility(
                            leftover,
                            partner
                        )


                    const status =
                        getStatus(
                            percent
                        )


                    lines.push(
                        [
                            `${displayJid(leftover)} ❤️ ${displayJid(partner)}`,
                            `${percent}% ${status}`
                        ]
                    )


                    allMentions.push(
                        leftover,
                        partner
                    )

                }


                logger.event(

                    `Ship aleatorio en ${from.split('@')[0]}: ${lines.length} parejas`

                )


                const text = [

                    'ㅤ۟∩　ׅ　💞　ׅ　*SHIPS DEL GRUPO*　ׄᰙ',

                    '',

                    ...lines.map(

                        ([pair, result]) =>

                            `𖣣ֶㅤ֯⌗ ♡  ׄ ⬭ ${pair}\nㅤ╰─ 𓂃 ${result}`

                    )

                ].join('\n\n')


                return await sock.sendMessage(

                    from,

                    {

                        text,

                        mentions:
                            [
                                ...new Set(
                                    allMentions
                                )
                            ]

                    }

                )

            }


            /* ─────────────────────────────
               SHIP ENTRE DOS PERSONAS
            ───────────────────────────── */

            let person1
            let person2

            let person1Seed
            let person2Seed

            let shipMentions = []


            /* ─────────────────────────────
               DOS MENCIONES REALES
            ───────────────────────────── */

            if (
                mentions.length >= 2
            ) {

                const jid1 =
                    mentions[0]

                const jid2 =
                    mentions[1]


                person1 =
                    displayJid(
                        jid1
                    )

                person2 =
                    displayJid(
                        jid2
                    )


                person1Seed =
                    jid1

                person2Seed =
                    jid2


                shipMentions = [
                    jid1,
                    jid2
                ]

            } else {

                /* ─────────────────────────────
                   USERNAMES/NOMBRES COMO TEXTO
                ───────────────────────────── */

                const raw1 =
                    args?.[0]

                const raw2 =
                    args?.slice(1).join(' ')


                if (
                    !raw1 ||
                    !raw2
                ) {

                    return await sock.sendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'USUARIOS REQUERIDOS',

                                    'Usa /ship @usuario1 @usuario2'

                                )

                        }

                    )

                }


                person1 =
                    normalizeName(
                        raw1
                    )

                person2 =
                    normalizeName(
                        raw2
                    )


                person1Seed =
                    person1

                person2Seed =
                    person2

            }


            const percent =
                getCompatibility(
                    person1Seed,
                    person2Seed
                )


            const bar =
                getBar(
                    percent
                )


            const status =
                getStatus(
                    percent
                )


            logger.event(

                `Ship: ${person1} ❤️ ${person2} (${percent}%)`

            )


            const text =
                ui.success(

                    '💞 SHIP',

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

                    ],

                    '¿Será amor verdadero? 👀'

                )


            return await sock.sendMessage(

                from,

                {

                    text,

                    mentions:
                        shipMentions

                }

            )


        } catch (err) {

            logger.error(

                `Error ship: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR INTERNO',

                                'No se pudo calcular la compatibilidad.'

                            )

                    }

                )

            } catch {}

        }

    }

}