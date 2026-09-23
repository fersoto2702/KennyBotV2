const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    ensureInitialGoldCard,
    getMemberCards
} = require('../src/database/repositories/memberCardRepository')


module.exports = {

    name: 'collection',

    aliases: [
        'coleccion',
        'cards',
        'cartas'
    ],

    description:
        'Muestra tu colección de cartas de KennyBot',

    category: 'perfil',

    cooldown: 5,

    async execute({
        sock,
        msg,
        from
    }) {

        try {

            // Identidad del usuario
            const sender =
                msg.key?.participant ||
                msg.participant ||
                msg.key?.remoteJid

            const senderAlt =
                msg.key?.participantAlt ||
                null

            if (!sender) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            '❌ No pude identificar al usuario.'
                    }
                )

                return
            }


            // Garantizar que exista como miembro
            const member =
                await ensureMember(
                    sender,
                    senderAlt,
                    msg.pushName || null
                )

            if (!member) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            '❌ No pude cargar tu perfil.'
                    }
                )

                return
            }


            // Garantizar Gold Rare inicial
            await ensureInitialGoldCard(
                member.id
            )


            // Obtener todas sus cartas
            const cards =
                await getMemberCards(
                    member.id
                )

            if (!cards.length) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            '❌ Todavía no tienes cartas.'
                    }
                )

                return
            }


            // Equipada primero.
            // Después, las más recientes.
            const orderedCards =
                [...cards].sort((a, b) => {

                    const equippedDifference =
                        Number(b.equipped) -
                        Number(a.equipped)

                    if (equippedDifference !== 0) {
                        return equippedDifference
                    }

                    return (
                        new Date(b.obtained_at) -
                        new Date(a.obtained_at)
                    )
                })


            let text =
`୨୧ ─────────── ୨୧
⌗ 𝐂𝐀𝐑𝐃 𝐂𝐎𝐋𝐋𝐄𝐂𝐓𝐈𝐎𝐍

✦ 𝐌𝐢𝐞𝐦𝐛𝐫𝐨:
${member.display_name || msg.pushName || 'Usuario'}

✦ 𝐂𝐚𝐫𝐭𝐚𝐬: ${orderedCards.length}

୨୧ ─────────── ୨୧

`


            orderedCards.forEach(
                (card, index) => {

                    const equipped =
                        Number(card.equipped) === 1

                    text +=
`${index + 1}. ${equipped ? '⭐ ' : ''}${card.card_name}

   ✦ OVR ${card.rating}
   ✦ ${card.family}
   ✦ ${card.promo_code || 'BASE'}
   ✦ ID: ${card.id}
   ${equipped ? '✦ EQUIPADA' : ''}

`
                }
            )


            text +=
`୨୧ ─────────── ୨୧
✧ ⭐ = Carta equipada
✧ KennyBot V2
୨୧ ─────────── ୨୧`


            await sock.safeSendMessage(
                from,
                {
                    text
                }
            )

        } catch (err) {

            console.error(
                'Collection Command Error:',
                err
            )

            await sock.safeSendMessage(
                from,
                {
                    text:
                        '❌ Ocurrió un error al cargar tu colección.'
                }
            )

        }

    }

}