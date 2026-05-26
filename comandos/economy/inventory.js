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

    cooldown: 3,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // DB
            // =========================

            if (
                !fs.existsSync(inventoryPath)
            ) {

                fs.writeFileSync(

                    inventoryPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let inventory = {}

            try {

                inventory =
                    JSON.parse(

                        fs.readFileSync(
                            inventoryPath
                        )

                    )

            } catch {

                inventory = {}

            }

            // =========================
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            // =========================
            // CREATE USER
            // =========================

            if (
                !inventory[sender]
            ) {

                inventory[sender] = []

            }

            // =========================
            // FIX ARRAY
            // =========================

            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] = []

            }

            const items =
                inventory[sender]

            // =========================
            // EMPTY
            // =========================

            if (
                items.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'INVENTARIO VACÍO',

                                'No tienes items guardados.'

                            )

                    }

                )

            }

            // =========================
            // BUILD LIST
            // =========================

            let list = ''

            items.forEach(

                (
                    item,
                    index
                ) => {

                    list +=
                        `${index + 1}. ${item}\n`

                }

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'INVENTARIO',

                            [

                                [

                                    'Items',

                                    `${items.length}`

                                ]

                            ],

                            `\n${list}`

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error inventory: ${err.message}`
            )

        }

    }

}