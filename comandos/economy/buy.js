const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )


const items = {

    1: {
        name:
            '🛡️ Chaleco',
        price:
            800
    },

    2: {
        name:
            '⚔️ Espada',
        price:
            1000
    },

    3: {
        name:
            '💎 VIP',
        price:
            1500
    },

    4: {
        name:
            '🎁 Caja misteriosa',
        price:
            2000
    },

    5: {
        name:
            '🚀 XP Boost',
        price:
            2500
    }

}


function ensureJsonFile(
    filePath
) {

    const directory =
        path.dirname(
            filePath
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
            filePath
        )
    ) {

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readJson(
    filePath
) {

    ensureJsonFile(
        filePath
    )


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    filePath,
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
            `Error leyendo ${path.basename(filePath)}: ${err.message}`
        )

        return {}

    }

}


function saveJson(
    filePath,
    data
) {

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function formatMoney(
    value
) {

    return Number(
        value || 0
    )
        .toLocaleString(
            'es-MX'
        )

}


module.exports = {

    name:
        'buy',

    aliases: [
        'comprar'
    ],

    description:
        'Compra un item de la tienda',

    category:
        'economia',
async execute({

        sock,
        from,
        msg,
        args

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
               ITEM
            ───────────────────────────── */

            const itemId =
                Number.parseInt(
                    args?.[0],
                    10
                )


            const item =
                items[itemId]


            if (!item) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ITEM INVÁLIDO',

                                'Usa /shop para consultar los artículos disponibles.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CARGAR DATOS
            ───────────────────────────── */

            const economy =
                readJson(
                    economyPath
                )


            const inventory =
                readJson(
                    inventoryPath
                )


            if (
                !economy[sender] ||
                typeof economy[sender] !== 'object'
            ) {

                economy[sender] = {
                    coins: 0,
                    bank: 0
                }

            }


            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] = []

            }


            if (
                !Number.isFinite(
                    Number(
                        economy[sender].coins
                    )
                )
            ) {

                economy[sender].coins =
                    0

            }


            if (
                !Number.isFinite(
                    Number(
                        economy[sender].bank
                    )
                )
            ) {

                economy[sender].bank =
                    0

            }


            economy[sender].coins =
                Number(
                    economy[sender].coins
                )


            economy[sender].bank =
                Number(
                    economy[sender].bank
                )


            const wallet =
                economy[sender].coins


            /* ─────────────────────────────
               FONDOS
            ───────────────────────────── */

            if (
                wallet <
                item.price
            ) {

                const missing =
                    item.price -
                    wallet


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Necesitas 🪙 ${formatMoney(item.price)} monedas.\nTe faltan 🪙 ${formatMoney(missing)}.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               REALIZAR COMPRA
            ───────────────────────────── */

            economy[sender].coins -=
                item.price


            inventory[sender].push(
                item.name
            )


            saveJson(
                economyPath,
                economy
            )


            saveJson(
                inventoryPath,
                inventory
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Compra: ${sender.split('@')[0]} → ${item.name} | ${item.price} monedas`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🛒 COMPRA REALIZADA',

                            [

                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Item',
                                    item.name
                                ],

                                [
                                    'Costo',
                                    `🪙 ${formatMoney(item.price)}`
                                ],

                                [
                                    'Wallet',
                                    `🪙 ${formatMoney(economy[sender].coins)}`
                                ],

                                [
                                    'Inventario',
                                    `${inventory[sender].length} item(s)`
                                ]

                            ],

                            'El artículo fue agregado correctamente a tu inventario.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error buy: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE COMPRA',

                                'No se pudo completar la compra.'

                            )

                    }

                )

            } catch {}

        }

    }

}