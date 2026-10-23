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

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )


const MYSTERY_BOX =
    '🎁 Caja misteriosa'


function ensureJsonFile(file) {

    const directory =
        path.dirname(
            file
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
            file
        )
    ) {

        fs.writeFileSync(
            file,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readJson(file) {

    ensureJsonFile(
        file
    )


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
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
            `Error leyendo ${path.basename(file)}: ${err.message}`
        )

        return {}

    }

}


function saveJson(
    file,
    data
) {

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


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
        'open',

    aliases: [
        'box',
        'caja',
        'lootbox'
    ],

    description:
        'Abre una caja misteriosa',

    category:
        'economia',
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
               CARGAR DATOS
            ───────────────────────────── */

            const economy =
                readJson(
                    economyPath
                )


            const levels =
                readJson(
                    levelsPath
                )


            const inventory =
                readJson(
                    inventoryPath
                )


            /* ─────────────────────────────
               NORMALIZAR ECONOMÍA
            ───────────────────────────── */

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


            /* ─────────────────────────────
               NORMALIZAR NIVELES
            ───────────────────────────── */

            if (
                !levels[sender] ||
                typeof levels[sender] !== 'object'
            ) {

                levels[sender] = {
                    xp: 0,
                    level: 1
                }

            }


            if (
                !Number.isFinite(
                    Number(
                        levels[sender].xp
                    )
                )
            ) {

                levels[sender].xp =
                    0

            }


            if (
                !Number.isFinite(
                    Number(
                        levels[sender].level
                    )
                )
            ) {

                levels[sender].level =
                    1

            }


            levels[sender].xp =
                Number(
                    levels[sender].xp
                )


            levels[sender].level =
                Math.max(
                    1,
                    Number(
                        levels[sender].level
                    )
                )


            /* ─────────────────────────────
               INVENTARIO
            ───────────────────────────── */

            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] =
                    []

            }


            const boxIndex =
                inventory[sender]
                    .findIndex(
                        item =>
                            item ===
                            MYSTERY_BOX
                    )


            if (
                boxIndex === -1
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                '🎁 SIN CAJAS',

                                'No tienes ninguna Caja misteriosa en tu inventario.\n\nUsa /shop para comprar una.'

                            )

                    }

                )

            }


            /*
                Consumimos exactamente
                una caja.
            */

            inventory[sender]
                .splice(
                    boxIndex,
                    1
                )


            /* ─────────────────────────────
               PROBABILIDADES
            ───────────────────────────── */

            const chance =
                Math.random()


            let result


            /* ─────────────────────────────
               JACKPOT — 2%
            ───────────────────────────── */

            if (
                chance < 0.02
            ) {

                const amount =

                    Math.floor(
                        Math.random() *
                        15001
                    ) +
                    15000


                economy[sender].coins +=
                    amount


                result =
                    ui.success(

                        '🎰 JACKPOT',

                        [

                            [
                                'Usuario',
                                `@${sender.split('@')[0]}`
                            ],

                            [
                                'Recompensa',
                                `🪙 +${formatMoney(amount)}`
                            ],

                            [
                                'Wallet',
                                `🪙 ${formatMoney(economy[sender].coins)}`
                            ],

                            [
                                'Rareza',
                                '🌟 LEGENDARIA'
                            ]

                        ],

                        '¡Encontraste la recompensa más rara de la caja!'

                    )


                logger.event(

                    `Open JACKPOT: ${sender.split('@')[0]} +${amount}`

                )

            }


            /* ─────────────────────────────
               MONEDAS — 65%
            ───────────────────────────── */

            else if (
                chance < 0.67
            ) {

                const amount =

                    Math.floor(
                        Math.random() *
                        3000
                    ) +
                    500


                economy[sender].coins +=
                    amount


                result =
                    ui.success(

                        '🎁 CAJA MISTERIOSA',

                        [

                            [
                                'Usuario',
                                `@${sender.split('@')[0]}`
                            ],

                            [
                                'Recompensa',
                                `🪙 +${formatMoney(amount)}`
                            ],

                            [
                                'Wallet',
                                `🪙 ${formatMoney(economy[sender].coins)}`
                            ],

                            [
                                'Rareza',
                                '🟢 COMÚN'
                            ]

                        ],

                        'La caja contenía monedas.'

                    )


                logger.event(

                    `Open: ${sender.split('@')[0]} +${amount} monedas`

                )

            }


            /* ─────────────────────────────
               XP — 25%
            ───────────────────────────── */

            else if (
                chance < 0.92
            ) {

                const amount =

                    Math.floor(
                        Math.random() *
                        500
                    ) +
                    100


                levels[sender].xp +=
                    amount


                result =
                    ui.success(

                        '🎁 CAJA MISTERIOSA',

                        [

                            [
                                'Usuario',
                                `@${sender.split('@')[0]}`
                            ],

                            [
                                'Recompensa',
                                `✨ +${formatMoney(amount)} XP`
                            ],

                            [
                                'XP total',
                                `✨ ${formatMoney(levels[sender].xp)}`
                            ],

                            [
                                'Rareza',
                                '🔵 ESPECIAL'
                            ]

                        ],

                        'La caja contenía experiencia.'

                    )


                logger.event(

                    `Open: ${sender.split('@')[0]} +${amount} XP`

                )

            }


            /* ─────────────────────────────
               VACÍA — 8%
            ───────────────────────────── */

            else {

                result =
                    ui.warn(

                        '🎁 CAJA MISTERIOSA',

                        'La caja estaba completamente vacía... 💀'

                    )


                logger.event(

                    `Open: ${sender.split('@')[0]} → vacía`

                )

            }


            /* ─────────────────────────────
               GUARDAR
            ───────────────────────────── */

            saveJson(
                economyPath,
                economy
            )


            saveJson(
                levelsPath,
                levels
            )


            saveJson(
                inventoryPath,
                inventory
            )


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        result,

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error open: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE CAJA',

                                'No se pudo abrir la caja misteriosa.'

                            )

                    }

                )

            } catch {}

        }

    }

}