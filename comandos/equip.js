const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    equipMemberCard
} = require('../src/database/repositories/memberCardRepository')


module.exports = {

    name: 'equip',

    aliases: [
        'equipar',
        'usecard'
    ],

    description:
        'Equipa una carta de tu colección',

    category: 'perfil',

    cooldown: 5,

    async execute({
        sock,
        msg,
        from,
        args
    }) {

        try {

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


            const cardId =
                Number(args?.[0])


            if (
                !Number.isInteger(cardId) ||
                cardId <= 0
            ) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
`❌ Debes indicar el ID de la carta.

Ejemplo:
.equip 2

Consulta tus cartas con:
.collection`
                    }
                )

                return
            }


            const member =
                await ensureMember(
                    sender,
                    senderAlt,
                    msg.pushName || null
                )


            const result =
                await equipMemberCard(
                    member.id,
                    cardId
                )


            if (!result.success) {

                if (
                    result.reason ===
                    'CARD_NOT_FOUND'
                ) {

                    await sock.safeSendMessage(
                        from,
                        {
                            text:
`❌ La carta #${cardId} no existe en tu colección.`
                        }
                    )

                    return
                }


                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            '❌ No pude equipar esa carta.'
                    }
                )

                return
            }


            if (!result.changed) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
`⭐ ${result.card.card_name} OVR ${result.card.rating} ya está equipada.`
                    }
                )

                return
            }


            await sock.safeSendMessage(
                from,
                {
                    text:
`୨୧ ─────────── ୨୧
⌗ 𝐂𝐀𝐑𝐃 𝐄𝐐𝐔𝐈𝐏𝐏𝐄𝐃

⭐ ${result.card.card_name}

✦ OVR ${result.card.rating}
✦ ${result.card.family}
✦ ${result.card.promo_code || 'BASE'}
✦ ID: ${result.card.id}

Tu carta activa ha sido actualizada.

୨୧ ─────────── ୨୧`
                }
            )


        } catch (err) {

            console.error(
                'Equip Command Error:',
                err
            )

            await sock.safeSendMessage(
                from,
                {
                    text:
                        '❌ Ocurrió un error al equipar la carta.'
                }
            )

        }

    }

}