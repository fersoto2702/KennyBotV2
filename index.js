process.setMaxListeners(50)

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require('@whiskeysockets/baileys')

const P =
    require('pino')

const qrcode =
    require('qrcode-terminal')

const welcomeSystem =
    require('./src/system/welcomeSystem')

const settings =
    require('./src/config/settings')

const messagesEvent =
    require('./eventos/messages')

const cleanupTemp =
    require('./src/utils/cleanupTemp')

const logger =
    require('./src/utils/logger')

const {

    patchSocket

} = require('./src/system/socketManager')

// =========================
// CONFIG
// =========================

const usePairingCode =
    false

let cleanupStarted =
    false

let reconnecting =
    false

let currentSock =
    null

// =========================
// BANNER
// =========================

logger.banner(
    settings.botName
)

logger.info(
    `Iniciando ${settings.botName}...`
)

// =========================
// START BOT
// =========================

async function startBot() {

    try {

        // =========================
        // AUTH
        // =========================

        const {

            state,
            saveCreds

        } = await useMultiFileAuthState(
            './auth_info'
        )

        // =========================
        // SOCKET
        // =========================

        let sock = makeWASocket({

            auth: state,

            printQRInTerminal: true,

            logger: P({

                level: 'silent'

            }),

            browser: [

                settings.botName,

                'Chrome',

                '5.0.0'

            ],

            markOnlineOnConnect: false,

            syncFullHistory: false,

            emitOwnEvents: false,

            fireInitQueries: false,

            generateHighQualityLinkPreview: false,

            connectTimeoutMs: 30000,

            keepAliveIntervalMs: 15000,

            defaultQueryTimeoutMs: 30000

        })

        // =========================
        // PATCH SOCKET
        // =========================

        sock = patchSocket(sock)

        currentSock = sock

        // =========================
        // PAIRING CODE
        // =========================

        if (

            usePairingCode &&
            !sock.authState.creds.registered

        ) {

            const phoneNumber =
                '5266811377982'

            const code =

                await sock.requestPairingCode(
                    phoneNumber
                )

            console.log(

                `\n📲 Código de vinculación:\n${code}\n`

            )

        }

        // =========================
        // SAVE CREDS
        // =========================

        sock.ev.on(

            'creds.update',

            saveCreds

        )

        // =========================
        // CONNECTION
        // =========================

        sock.ev.on(

            'connection.update',

            async update => {

                try {

                    const {

                        connection,
                        lastDisconnect,
                        qr

                    } = update

                    // =========================
                    // QR
                    // =========================

                    if (

                        qr &&
                        !usePairingCode

                    ) {

                        logger.qr()

                        qrcode.generate(

                            qr,

                            {

                                small: true

                            }

                        )

                    }

                    // =========================
                    // CONNECTED
                    // =========================

                    if (
                        connection === 'open'
                    ) {

                        reconnecting = false

                        logger.success(

                            `${settings.botName} conectado`

                        )

                        logger.statusTable({

                            Bot:
                                settings.botName,

                            Owner:
                                settings.ownerNumber[0],

                            Estado:
                                'Conectado ✅',

                        })

                        // =========================
                        // CLEAN TEMP
                        // =========================

                        if (!cleanupStarted) {

                            cleanupStarted = true

                            setInterval(() => {

                                cleanupTemp()

                            }, 1000 * 60)

                        }

                    }

                    // =========================
                    // DISCONNECTED
                    // =========================

                    if (
                        connection === 'close'
                    ) {

                        const reason =

                            lastDisconnect
                                ?.error
                                ?.output
                                ?.statusCode

                        logger.warn(

                            `Desconectado: ${reason}`

                        )

                        // =========================
                        // LOGGED OUT
                        // =========================

                        if (

                            reason ===
                            DisconnectReason.loggedOut

                        ) {

                            logger.error(
                                'Sesión cerrada.'
                            )

                            return

                        }

                        // =========================
                        // RECONNECT
                        // =========================

                        if (!reconnecting) {

                            reconnecting = true

                            logger.info(

                                'Reconectando en 5 segundos...'

                            )

                            setTimeout(async () => {

                                try {

                                    if (currentSock) {

                                        currentSock.ev.removeAllListeners()

                                        currentSock.ws?.close()

                                    }

                                } catch {}

                                startBot()

                            }, 5000)

                        }

                    }

                } catch (err) {

                    logger.error(

                        `Connection Update Error: ${err.message}`

                    )

                }

            }

        )

        // =========================
        // GROUP EVENTS
        // =========================

        sock.ev.on(

            'group-participants.update',

            async update => {

                try {

                    await welcomeSystem(

                        sock,
                        update

                    )

                } catch (err) {

                    logger.error(

                        `Welcome Event Error: ${err.message}`

                    )

                }

            }

        )

        // =========================
        // MESSAGES
        // =========================

        sock.ev.on(

            'messages.upsert',

            async ({ messages }) => {

                try {

                    const msg =
                        messages?.[0]

                    // =========================
                    // VALIDATE
                    // =========================

                    if (!msg) return
                    if (!msg.message) return
                    if (msg.key.fromMe) return

                    // =========================
                    // STATUS
                    // =========================

                    if (

                        msg.key.remoteJid ===
                        'status@broadcast'

                    ) return

                    // =========================
                    // OLD MSG
                    // =========================

                    const timestamp = Number(

                        msg.messageTimestamp

                    )

                    const now = Math.floor(

                        Date.now() / 1000

                    )

                    if (
                        now - timestamp > 30
                    ) return

                    // =========================
                    // EVENT
                    // =========================

                    await messagesEvent(

                        sock,
                        messages

                    )

                } catch (err) {

                    logger.error(

                        `Messages Error: ${err.message}`

                    )

                }

            }

        )

    } catch (err) {

        logger.error(

            `StartBot Error: ${err.message}`

        )

        setTimeout(() => {

            startBot()

        }, 5000)

    }

}

// =========================
// START
// =========================

startBot()
