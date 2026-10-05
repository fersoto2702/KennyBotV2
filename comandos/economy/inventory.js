const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )


function ensureInventoryFile() {

    const directory =
        path.dirname(
            inventoryPath
        )


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }


    if (
        !fs.existsSync(
            inventoryPath
        )
    ) {

        fs.writeFileSync(
            inventoryPath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readInventory() {

    ensureInventoryFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    inventoryPath,
                    'utf8'
                )
            )


        return (
            data &&
            typeof data === 'object' &&
            !Array.isArray(data)
        )
            ? data
            : {}


    } catch (err) {

        logger.error(
            `Error leyendo inventory.json: ${err.message}`
        )

        return {}

    }

}


function saveInventory(data) {

    fs.writeFileSync(
        inventoryPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


module.exports = {

    name:
        'inventory',

    aliases: [
        'inv',
        'mochila',
        'bag'
    ],

    description:
        'Muestra tu inventario de items',

    category:
        'economia',

    cooldown:
        3,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar tu cuenta.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               INVENTARIO
            ───────────────────────────── */

            const inventory =
                readInventory()


            let changed =
                false


            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] =
                    []

                changed =
                    true

            }


            if (changed) {

                saveInventory(
                    inventory
                )

            }


            const items =
                inventory[sender]


            /* ─────────────────────────────
               INVENTARIO VACÍO
            ───────────────────────────── */

            if (
                items.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                '🎒 INVENTARIO VACÍO',

                                'No tienes ningún item guardado.\n\nUsa /shop para consultar la tienda.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               LISTA
            ───────────────────────────── */

            const list =
                items
                    .map(

                        (item, index) =>

                            `𖣣ֶㅤ֯⌗ ${index + 1}.  ׄ ⬭ ${item}`

                    )
                    .join('\n')


            const text = [

                'ㅤ۟∩　ׅ　🎒　ׅ　*INVENTARIO*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Usuario:* @${sender.split('@')[0]}`,

                `𖣣ֶㅤ֯⌗ ❖  ׄ ⬭ *Items:* ${items.length}`,

                '',

                'ㅤ۟∩　ׅ　📦　ׅ　*CONTENIDO*　ׄᰙ',

                '',

                list,

                '',

                '╰─ 𓂃 Usa /shop para conseguir más items.'

            ].join('\n')


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text,

                    mentions: [
                        sender
                    ]

                }

            )


            logger.event(

                `Inventory: ${sender.split('@')[0]} | ${items.length} item(s)`

            )


        } catch (err) {

            logger.error(

                `Error inventory: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE INVENTARIO',

                                'No se pudo consultar tu inventario.'

                            )

                    }

                )

            } catch {}

        }

    }

}