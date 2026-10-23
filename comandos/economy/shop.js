const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const ITEMS = [

    {
        id:
            1,

        name:
            '🛡️ Chaleco',

        desc:
            'Protege de robos',

        price:
            800
    },

    {
        id:
            2,

        name:
            '⚔️ Espada',

        desc:
            'Mejora tus robos',

        price:
            1000
    },

    {
        id:
            3,

        name:
            '💎 VIP',

        desc:
            'Beneficios especiales',

        price:
            1500
    },

    {
        id:
            4,

        name:
            '🎁 Caja misteriosa',

        desc:
            'Recompensa aleatoria',

        price:
            2000
    },

    {
        id:
            5,

        name:
            '🚀 XP Boost',

        desc:
            'Más XP por mensajes',

        price:
            2500
    }

]


function formatMoney(value) {

    return Number(
        value || 0
    )
        .toLocaleString(
            'es-MX'
        )

}


module.exports = {

    name:
        'shop',

    aliases: [
        'tienda',
        'store'
    ],

    description:
        'Muestra la tienda de items',

    category:
        'economia',
async execute({

        sock,
        from

    }) {

        try {

            /* ─────────────────────────────
               ITEMS
            ───────────────────────────── */

            const rows =
                ITEMS
                    .map(

                        item => [

                            `𖣣ֶㅤ֯⌗ ${item.id}.  ׄ ⬭ *${item.name}*`,

                            `   ✎ ${item.desc}`,

                            `   🪙 ${formatMoney(item.price)}`

                        ].join('\n')

                    )
                    .join(
                        '\n\n'
                    )


            /* ─────────────────────────────
               MENSAJE
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　🛒　ׅ　*TIENDA OFICIAL*　ׄᰙ',

                '',

                '𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Catálogo de items*',

                '',

                rows,

                '',

                `𖣣ֶㅤ֯⌗ 📦  ׄ ⬭ *Items disponibles:* ${ITEMS.length}`,

                '',

                '╰─ 𓂃 Para comprar usa /buy número'

            ].join('\n')


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {
                    text
                }

            )


            logger.event(

                `Shop consultado | ${ITEMS.length} item(s)`

            )


        } catch (err) {

            logger.error(

                `Error shop: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE TIENDA',

                                'No se pudo cargar la tienda.'

                            )

                    }

                )

            } catch {}

        }

    }

}