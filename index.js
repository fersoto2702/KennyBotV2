process.setMaxListeners(50)

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys')

const P = require('pino')

const qrcode = require('qrcode-terminal')

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

const { initDB } = require('./src/database/mysql')
initDB()

const usePairingCode = false

let cleanupStarted = false
let reconnecting = false
let currentSock = null

logger.banner(settings.botName)

logger.info(
    `Iniciando ${settings.botName}...`
)

async function startBot() {

    try {

        const {
            state,
            saveCreds
        } = await useMultiFileAuthState('./auth_info')

        const {
            version
        } = await fetchLatestBaileysVersion()

        logger.info(
            `Usando WA v${version.join('.')}`
        )

        let sock = makeWASocket({
            auth: state,
            version,
            logger: P({ level: 'silent' }),
            printQRInTerminal: !usePairingCode,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            markOnlineOnConnect: false,
            syncFullHistory: false,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        })

        sock = patchSocket(sock)

        currentSock = sock

        if (usePairingCode && !state.creds.registered) {

            const phoneNumber =
                '6681137982'

            try {

                const code =
                    await sock.requestPairingCode(phoneNumber)

                console.log(
                    `\n📲 Código de vinculación:\n${code}\n`
                )

            } catch (err) {

                logger.error(
                    `Pairing Error: ${err.message}`
                )

            }

        }

        sock.ev.on(
            'creds.update',
            saveCreds
        )

        sock.ev.on(
            'connection.update',
            async update => {

                try {

                    const {
                        connection,
                        lastDisconnect,
                        qr
                    } = update

                    if (qr && !usePairingCode) {

                        logger.qr()

                        qrcode.generate(qr, { small: true })

                    }

                    if (connection === 'open') {

                        reconnecting = false

                        logger.success(
                            `${settings.botName} conectado`
                        )

                        logger.statusTable({
                            Bot: settings.botName,
                            Owner: settings.ownerNumber[0],
                            Estado: 'Conectado ✅',
                        })

                        if (!cleanupStarted) {

                            cleanupStarted = true

                            setInterval(() => {
                                cleanupTemp()
                            }, 1000 * 60)

                        }

                    }

                    if (connection === 'close') {

                        const reason =
                            lastDisconnect
                                ?.error
                                ?.output
                                ?.statusCode

                        logger.warn(
                            `Desconectado: ${reason}`
                        )

                        if (reason === DisconnectReason.loggedOut) {

                            logger.error('Sesión cerrada.')

                            return

                        }

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

        sock.ev.on(
            'group-participants.update',
            async update => {

                try {

                    await welcomeSystem(sock, update)

                } catch (err) {

                    logger.error(
                        `Welcome Event Error: ${err.message}`
                    )

                }

            }
        )

        sock.ev.on(
            'messages.upsert',
            async ({ messages }) => {

                try {

                    const msg =
                        messages?.[0]

                    if (!msg) return
                    if (!msg.message) return
                    const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''

if (
    msg.key.fromMe &&
    !text.startsWith('.')
) return

                    if (
                        msg.key.remoteJid ===
                        'status@broadcast'
                    ) return

                    const timestamp = Number(
                        msg.messageTimestamp
                    )

                    const now = Math.floor(
                        Date.now() / 1000
                    )

                    if (now - timestamp > 30) return

                    await messagesEvent(sock, messages)

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

startBot()