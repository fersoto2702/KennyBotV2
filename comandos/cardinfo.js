const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    getMemberCardById
} = require('../src/database/repositories/memberCardRepository')


module.exports = {

    name: 'cardinfo',

    aliases: [
        'infocard',
        'cartainfo'
    ],

    description:
        'Muestra la información de una carta de tu colección',

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
`❌ Debes indicar el ID de una carta.

Ejemplo:
.cardinfo 2

Puedes consultar tus IDs con:
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

            const card =
                await getMemberCardById(
                    member.id,
                    cardId
                )


            if (!card) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
`❌ No encontré la carta #${cardId} en tu colección.`
                    }
                )

                return
            }


            const obtained =
                card.obtained_at
                    ? new Date(
                        card.obtained_at
                    ).toLocaleDateString(
                        'es-MX'
                    )
                    : 'Desconocida'


            const equipped =
                Number(card.equipped) === 1


            const text =
`୨୧ ─────────── ୨୧
⌗ 𝐂𝐀𝐑𝐃 𝐈𝐍𝐅𝐎

✦ ${card.card_name}
✦ OVR ${card.rating}

୨୧ ── 𝐃𝐀𝐓𝐎𝐒 ── ୨୧

✦ 𝐈𝐃: ${card.id}
✦ 𝐅𝐚𝐦𝐢𝐥𝐢𝐚: ${card.family}
✦ 𝐓𝐢𝐩𝐨: ${card.promo_code || 'BASE'}
✦ 𝐄𝐬𝐭𝐚𝐝𝐨: ${equipped ? '⭐ EQUIPADA' : 'Guardada'}

୨୧ ── 𝐒𝐓𝐀𝐓𝐒 ── ୨୧

✦ 𝐌𝐒𝐆: ${card.msg_stat}
✦ 𝐀𝐂𝐓: ${card.act_stat}
✦ 𝐂𝐌𝐃: ${card.cmd_stat}
✦ 𝐑𝐀𝐂: ${card.rac_stat}
✦ 𝐀𝐍𝐓: ${card.ant_stat}
✦ 𝐈𝐍𝐓: ${card.int_stat}

୨୧ ── 𝐇𝐈𝐒𝐓𝐎𝐑𝐈𝐀𝐋 ── ୨୧

✦ 𝐎𝐛𝐭𝐞𝐧𝐢𝐝𝐚: ${obtained}
✦ 𝐌𝐨𝐭𝐢𝐯𝐨:
${card.obtained_reason || 'No especificado'}

୨୧ ─────────── ୨୧
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
                'CardInfo Command Error:',
                err
            )

            await sock.safeSendMessage(
                from,
                {
                    text:
                        '❌ Ocurrió un error al consultar la carta.'
                }
            )

        }

    }

}