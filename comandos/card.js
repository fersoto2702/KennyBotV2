const {
    ensureMember,
    getMemberByJid
} = require('../src/database/repositories/memberRepository')

const {
    ensureInitialGoldCard,
    getEquippedMemberCard
} = require('../src/database/repositories/memberCardRepository')

module.exports = {

    name:
        'card',

    aliases: [
        'carta',
        'mycard'
    ],

    description:
        'Muestra tu carta activa de KennyBot',

    category:
        'perfil',

    cooldown:
        5,

    async execute({
        sock,
        msg,
        from
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

            await ensureInitialGoldCard(
                member.id
            )

            const card =
                await getEquippedMemberCard(
                    member.id
                )


            if (!card) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            '❌ No tienes ninguna carta equipada.'
                    }
                )

                return
            }


            const familyNames = {
                PLAYER: 'PLAYER',
                HERO: 'HERO',
                ICON: 'ICON'
            }


            const cardName =
                card.card_name ||
                card.promo_code ||
                'Carta'


            const family =
                familyNames[card.family] ||
                card.family


            const text =
`୨୧ ─────────── ୨୧
⌗ 𝐊𝐄𝐍𝐍𝐘𝐁𝐎𝐓 𝐂𝐀𝐑𝐃

✦ 𝐉𝐮𝐠𝐚𝐝𝐨𝐫: ${member.display_name || msg.pushName || 'Usuario'}
✦ 𝐎𝐕𝐑: ${card.rating}
✦ 𝐂𝐚𝐫𝐭𝐚: ${cardName}
✦ 𝐅𝐚𝐦𝐢𝐥𝐢𝐚: ${family}

୨୧ ── 𝐒𝐓𝐀𝐓𝐒 ── ୨୧

✦ 𝐌𝐒𝐆: ${card.msg_stat}
✦ 𝐀𝐂𝐓: ${card.act_stat}
✦ 𝐂𝐌𝐃: ${card.cmd_stat}
✦ 𝐑𝐀𝐂: ${card.rac_stat}
✦ 𝐀𝐍𝐓: ${card.ant_stat}
✦ 𝐈𝐍𝐓: ${card.int_stat}

୨୧ ─────────── ୨୧
✧ Carta equipada
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
                'Card Command Error:',
                err
            )

            await sock.safeSendMessage(
                from,
                {
                    text:
                        '❌ Ocurrió un error al cargar tu carta.'
                }
            )

        }

    }

}