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


const cooldowns =
    new Map()


const COOLDOWN_TIME =
    30 * 60 * 1000


function ensureJsonFile(filePath) {

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


function readJson(filePath) {

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


function normalizeEconomyUser(
    economy,
    jid
) {

    if (
        !economy[jid] ||
        typeof economy[jid] !== 'object'
    ) {

        economy[jid] = {
            coins: 0,
            bank: 0
        }

    }


    if (
        !Number.isFinite(
            Number(
                economy[jid].coins
            )
        )
    ) {

        economy[jid].coins =
            0

    }


    if (
        !Number.isFinite(
            Number(
                economy[jid].bank
            )
        )
    ) {

        economy[jid].bank =
            0

    }


    economy[jid].coins =
        Math.max(
            0,
            Number(
                economy[jid].coins
            )
        )


    economy[jid].bank =
        Math.max(
            0,
            Number(
                economy[jid].bank
            )
        )

}


function normalizeInventoryUser(
    inventory,
    jid
) {

    if (
        !Array.isArray(
            inventory[jid]
        )
    ) {

        inventory[jid] =
            []

    }

}


function getMentionedJids(msg) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        []

    )

}


function getBotJid(sock) {

    const id =
        sock.user?.id


    if (!id) {

        return null

    }


    return (
        id
            .split(':')[0]
            .split('@')[0]
        +
        '@s.whatsapp.net'
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


function formatRemaining(ms) {

    const minutes =
        Math.ceil(
            ms / 60000
        )


    return (
        minutes === 1
            ? '1 minuto'
            : `${minutes} minutos`
    )

}


module.exports = {

    name:
        'rob',

    aliases: [
        'robar',
        'steal'
    ],

    description:
        'Intenta robarle monedas a otro usuario',

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
               OBJETIVO
            ───────────────────────────── */

            const mentions =
                getMentionedJids(
                    msg
                )


            const target =
                mentions[0]


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USO INCORRECTO',

                                'Menciona al usuario que quieres robar.\n\nUso: /rob @usuario'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VALIDACIONES
            ───────────────────────────── */

            if (
                sender === target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCIÓN INVÁLIDA',

                                'No puedes robarte a ti mismo.'

                            )

                    }

                )

            }


            const botJid =
                getBotJid(
                    sock
                )


            if (
                botJid &&
                target === botJid
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes robarle monedas al bot.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               COOLDOWN
            ───────────────────────────── */

            const now =
                Date.now()


            const expires =
                cooldowns.get(
                    sender
                )


            if (
                expires &&
                now < expires
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'COOLDOWN ACTIVO',

                                `Espera ${formatRemaining(expires - now)} para volver a robar.`

                            )

                    }

                )

            }


            /*
                El cooldown empieza cuando
                realmente intenta el robo.
            */

            cooldowns.set(

                sender,

                now +
                COOLDOWN_TIME

            )


            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

            const economy =
                readJson(
                    economyPath
                )


            const inventory =
                readJson(
                    inventoryPath
                )


            normalizeEconomyUser(
                economy,
                sender
            )


            normalizeEconomyUser(
                economy,
                target
            )


            normalizeInventoryUser(
                inventory,
                sender
            )


            normalizeInventoryUser(
                inventory,
                target
            )


            /* ─────────────────────────────
               OBJETIVO SIN DINERO
            ───────────────────────────── */

            if (
                economy[target].coins <
                100
            ) {

                /*
                    No tiene sentido gastar
                    cooldown si el usuario era
                    demasiado pobre.
                */

                cooldowns.delete(
                    sender
                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'OBJETIVO POBRE',

                                `@${target.split('@')[0]} tiene muy pocas monedas en su wallet.`

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ITEMS
            ───────────────────────────── */

            const hasVest =
                inventory[target]
                    .includes(
                        '🛡️ Chaleco'
                    )


            const hasSword =
                inventory[sender]
                    .includes(
                        '⚔️ Espada'
                    )


            /*
                Probabilidad base: 50%

                Chaleco víctima:
                25%

                Espada ladrón:
                +25%
            */

            let chance =
                hasVest
                    ? 0.25
                    : 0.5


            if (
                hasSword
            ) {

                chance +=
                    0.25

            }


            /*
                Evitamos cualquier valor
                accidental superior a 100%.
            */

            chance =
                Math.min(
                    1,
                    Math.max(
                        0,
                        chance
                    )
                )


            const success =
                Math.random() <
                chance


            /* ─────────────────────────────
               ROBO FALLIDO
            ───────────────────────────── */

            if (!success) {

                const fine =

                    Math.floor(
                        Math.random() *
                        200
                    ) +
                    50


                const previousWallet =
                    economy[sender].coins


                const realFine =
                    Math.min(
                        fine,
                        previousWallet
                    )


                economy[sender].coins =
                    Math.max(
                        0,
                        previousWallet -
                        fine
                    )


                saveJson(
                    economyPath,
                    economy
                )


                logger.event(

                    `Rob fallido: ${sender.split('@')[0]} -${realFine}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ROBO FALLIDO',

                                [
                                    `Te atraparon intentando robar a @${target.split('@')[0]}.`,
                                    '',
                                    `𖣣ֶㅤ֯⌗ 💸  ׄ ⬭ *Multa:* 🪙 -${formatMoney(realFine)}`,
                                    `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Wallet:* ${formatMoney(economy[sender].coins)}`,
                                    '',
                                    '╰─ 𓂃 Esta vez el robo salió mal.'
                                ].join('\n')

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               CALCULAR BOTÍN
            ───────────────────────────── */

            let amount =

                Math.floor(
                    Math.random() *
                    500
                ) +
                100


            /*
                Chaleco:
                reduce el botín a la mitad.
            */

            if (
                hasVest
            ) {

                amount =
                    Math.floor(
                        amount / 2
                    )

            }


            /*
                Espada:
                duplica el botín.
            */

            if (
                hasSword
            ) {

                amount *=
                    2

            }


            /*
                MUY IMPORTANTE:

                Nunca podemos robar más monedas
                de las que realmente tiene
                la víctima.
            */

            const realAmount =
                Math.min(

                    amount,

                    economy[target].coins

                )


            /* ─────────────────────────────
               TRANSFERENCIA
            ───────────────────────────── */

            economy[target].coins -=
                realAmount


            economy[sender].coins +=
                realAmount


            saveJson(
                economyPath,
                economy
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Rob exitoso: ${sender.split('@')[0]} → ${target.split('@')[0]} | ${realAmount}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const fields = [

                [
                    'Ladrón',
                    `@${sender.split('@')[0]}`
                ],

                [
                    'Víctima',
                    `@${target.split('@')[0]}`
                ],

                [
                    'Robado',
                    `🪙 ${formatMoney(realAmount)}`
                ],

                [
                    'Tu wallet',
                    `🪙 ${formatMoney(economy[sender].coins)}`
                ],

                [
                    'Wallet víctima',
                    `🪙 ${formatMoney(economy[target].coins)}`
                ]

            ]


            if (
                hasVest
            ) {

                fields.push(

                    [
                        'Defensa',
                        '🛡️ Chaleco redujo el botín'
                    ]

                )

            }


            if (
                hasSword
            ) {

                fields.push(

                    [
                        'Bonus',
                        '⚔️ Espada aumentó el botín'
                    ]

                )

            }


            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🥷 ROBO EXITOSO',

                            fields,

                            'Lograste escapar con el botín.'

                        ),

                    mentions: [
                        sender,
                        target
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error rob: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE ROBO',

                                'No se pudo ejecutar el robo.'

                            )

                    }

                )

            } catch {}

        }

    }

}