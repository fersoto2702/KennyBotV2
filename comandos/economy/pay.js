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


function ensureEconomyFile() {

    const directory =
        path.dirname(
            economyPath
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
            economyPath
        )
    ) {

        fs.writeFileSync(
            economyPath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readEconomy() {

    ensureEconomyFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    economyPath,
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
            `Error leyendo economy.json: ${err.message}`
        )

        return {}

    }

}


function saveEconomy(data) {

    fs.writeFileSync(
        economyPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeUser(
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
        Number(
            economy[jid].coins
        )


    economy[jid].bank =
        Number(
            economy[jid].bank
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


function normalizeBotJid(
    sock
) {

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


module.exports = {

    name:
        'pay',

    aliases: [
        'transfer',
        'sendmoney'
    ],

    description:
        'Transfiere monedas a otro usuario',

    category:
        'economia',

    cooldown:
        10,


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
               DESTINATARIO
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

                                'Menciona al usuario que recibirá las monedas.\n\nUso: /pay @usuario cantidad'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CANTIDAD
            ───────────────────────────── */

            /*
                Normalmente args[0] contiene
                @usuario y args[1] la cantidad.
            */

            const amount =
                Number.parseInt(
                    args?.[1],
                    10
                )


            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'CANTIDAD INVÁLIDA',

                                'Indica una cantidad válida.\n\nUso: /pay @usuario cantidad'

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

                                'No puedes transferirte monedas a ti mismo.'

                            )

                    }

                )

            }


            const botNumber =
                normalizeBotJid(
                    sock
                )


            if (
                botNumber &&
                target === botNumber
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes transferir monedas al bot.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ECONOMÍA
            ───────────────────────────── */

            const economy =
                readEconomy()


            normalizeUser(
                economy,
                sender
            )


            normalizeUser(
                economy,
                target
            )


            /* ─────────────────────────────
               FONDOS
            ───────────────────────────── */

            if (
                economy[sender].coins <
                amount
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Solo tienes 🪙 ${formatMoney(economy[sender].coins)} disponibles en tu wallet.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               TRANSFERENCIA
            ───────────────────────────── */

            economy[sender].coins -=
                amount


            economy[target].coins +=
                amount


            saveEconomy(
                economy
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Pay: ${sender.split('@')[0]} → ${target.split('@')[0]} | ${amount}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '💸 TRANSFERENCIA REALIZADA',

                            [

                                [
                                    'De',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Para',
                                    `@${target.split('@')[0]}`
                                ],

                                [
                                    'Cantidad',
                                    `🪙 ${formatMoney(amount)}`
                                ],

                                [
                                    'Tu wallet',
                                    `🪙 ${formatMoney(economy[sender].coins)}`
                                ],

                                [
                                    'Wallet receptor',
                                    `🪙 ${formatMoney(economy[target].coins)}`
                                ]

                            ],

                            'La transferencia se completó correctamente.'

                        ),

                    mentions: [
                        sender,
                        target
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error pay: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE TRANSFERENCIA',

                                'No se pudo completar la transferencia.'

                            )

                    }

                )

            } catch {}

        }

    }

}