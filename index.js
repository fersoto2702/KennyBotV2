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

const {
    initDB
} = require('./src/database/mysql')

const {
    runRewardMaintenance
} = require(
    './src/services/rewardMaintenanceService'
)

const {
    runMilestoneMaintenance
} = require(
    './src/services/milestoneMaintenanceService'
)

const {
    runSpecialCardMaintenance
} = require(
    './src/services/specialCardMaintenanceService'
)

const {
    syncMemberRole
} = require(
    './src/services/memberRoleService'
)

const usePairingCode = false

let cleanupStarted = false
let rewardMaintenanceStarted = false
let milestoneMaintenanceStarted = false
let specialCardMaintenanceStarted = false
let reconnecting = false
let currentSock = null
let cleanupInterval = null
let rewardMaintenanceInterval = null
let milestoneMaintenanceInterval = null
let specialCardMaintenanceInterval = null

async function executeRewardMaintenance() {

    try {

        const result =
            await runRewardMaintenance()

        if (!result.processed) {

            if (
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Reward Maintenance: ${result.reason}`
                )
            }

            return
        }

        const summary =
            result.summary || {}

        if (
            Number(
                summary.awardsPrepared || 0
            ) > 0 ||
            Number(
                summary.rewardsDelivered || 0
            ) > 0 ||
            Number(
                summary.preparationFailures || 0
            ) > 0 ||
            Number(
                summary.processingFailures || 0
            ) > 0
        ) {

            logger.info(
                `Reward Maintenance | ` +
                `Premios preparados: ${summary.awardsPrepared || 0} | ` +
                `Recompensas entregadas: ${summary.rewardsDelivered || 0} | ` +
                `Errores: ${
                    Number(
                        summary.preparationFailures || 0
                    ) +
                    Number(
                        summary.processingFailures || 0
                    )
                }`
            )
        }

    } catch (err) {

        logger.error(
            `Reward Maintenance Error: ${err.message}`
        )
    }
}

async function executeMilestoneMaintenance() {

    try {

        const result =
            await runMilestoneMaintenance()

        if (!result.processed) {

            if (
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Milestone Maintenance: ${result.reason}`
                )
            }

            return
        }

        if (
            Number(
                result.awardsGranted || 0
            ) > 0 ||
            Number(
                result.rewardsDelivered || 0
            ) > 0 ||
            Number(
                result.failures || 0
            ) > 0
        ) {

            logger.info(
                `Milestone Maintenance | ` +
                `Miembros revisados: ${result.membersChecked || 0} | ` +
                `Premios concedidos: ${result.awardsGranted || 0} | ` +
                `Recompensas entregadas: ${result.rewardsDelivered || 0} | ` +
                `Errores: ${result.failures || 0}`
            )
        }

    } catch (err) {

        logger.error(
            `Milestone Maintenance Error: ${err.message}`
        )
    }
}

async function executeSpecialCardMaintenance() {

    try {

        const result =
            await runSpecialCardMaintenance()

        if (!result.processed) {

            if (
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Special Card Maintenance: ${result.reason}`
                )
            }

            return
        }

        if (
            Number(
                result.changed || 0
            ) > 0 ||
            Number(
                result.failed || 0
            ) > 0
        ) {

            logger.info(
                `Special Card Maintenance | ` +
                `Cartas revisadas: ${result.checked || 0} | ` +
                `Cartas cambiadas: ${result.changed || 0} | ` +
                `Sin cambios: ${result.unchanged || 0} | ` +
                `Errores: ${result.failed || 0}`
            )
        }

    } catch (err) {

        logger.error(
            `Special Card Maintenance Error: ${err.message}`
        )
    }
}

function startBackgroundTasks() {

    if (!cleanupStarted) {

        cleanupStarted = true

        cleanupTemp()

        cleanupInterval =
            setInterval(
                () => {

                    try {

                        cleanupTemp()

                    } catch (err) {

                        logger.error(
                            `Cleanup Error: ${err.message}`
                        )
                    }
                },
                1000 * 60
            )
    }

    if (!rewardMaintenanceStarted) {

        rewardMaintenanceStarted = true

        executeRewardMaintenance()

        rewardMaintenanceInterval =
            setInterval(
                () => {
                    executeRewardMaintenance()
                },
                1000 * 60 * 5
            )
    }

    if (!milestoneMaintenanceStarted) {

        milestoneMaintenanceStarted = true

        milestoneMaintenanceInterval =
            setInterval(
                () => {
                    executeMilestoneMaintenance()
                },
                1000 * 60 * 60 * 24
            )
    }

    if (!specialCardMaintenanceStarted) {

        specialCardMaintenanceStarted = true

        executeSpecialCardMaintenance()

        specialCardMaintenanceInterval =
            setInterval(
                () => {
                    executeSpecialCardMaintenance()
                },
                1000 * 60 * 5
            )
    }
}

async function startBot() {

    try {

        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                './auth_info'
            )

        const {
            version
        } =
            await fetchLatestBaileysVersion()

        logger.info(
            `Usando WA v${version.join('.')}`
        )

        let sock =
            makeWASocket({
                auth: state,
                version,
                logger:
                    P({
                        level: 'silent'
                    }),
                printQRInTerminal:
                    !usePairingCode,
                browser: [
                    'Ubuntu',
                    'Chrome',
                    '20.0.04'
                ],
                markOnlineOnConnect:
                    false,
                syncFullHistory:
                    false,
                fireInitQueries:
                    false,
                generateHighQualityLinkPreview:
                    false,
                connectTimeoutMs:
                    60000,
                defaultQueryTimeoutMs:
                    60000,
                keepAliveIntervalMs:
                    30000
            })

        sock =
            patchSocket(sock)

        currentSock =
            sock

        if (
            usePairingCode &&
            !state.creds.registered
        ) {

            const phoneNumber =
                '6681137982'

            try {

                const code =
                    await sock.requestPairingCode(
                        phoneNumber
                    )

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

                    if (
                        connection ===
                        'open'
                    ) {

                        reconnecting =
                            false

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

                        startBackgroundTasks()
                    }

                    if (
                        connection ===
                        'close'
                    ) {

                        const reason =
                            lastDisconnect
                                ?.error
                                ?.output
                                ?.statusCode

                        logger.warn(
                            `Desconectado: ${reason}`
                        )

                        if (
                            reason ===
                            DisconnectReason.loggedOut
                        ) {

                            logger.error(
                                'Sesión cerrada.'
                            )

                            return
                        }

                        if (!reconnecting) {

                            reconnecting =
                                true

                            logger.info(
                                'Reconectando en 5 segundos...'
                            )

                            setTimeout(
                                async () => {

                                    try {

                                        if (
                                            currentSock
                                        ) {

                                            currentSock
                                                .ev
                                                .removeAllListeners()

                                            currentSock
                                                .ws
                                                ?.close()
                                        }

                                    } catch {}

                                    startBot()

                                },
                                5000
                            )
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

                    await welcomeSystem(
                        sock,
                        update
                    )

                } catch (err) {

                    logger.error(
                        `Welcome Event Error: ${err.message}`
                    )
                }

                if (
                    update.action !== 'promote' &&
                    update.action !== 'demote'
                ) {
                    return
                }

                try {

                    const metadata =
                        await sock.groupMetadata(
                            update.id
                        )

                    const participants =
                        metadata.participants || []

                    const affected =
                        update.participants || []

                    for (const participant of affected) {

                        const participantId =
                            typeof participant === 'string'
                                ? participant
                                : participant?.id

                        if (!participantId) {
                            continue
                        }

                        const current =
                            participants.find(
                                item =>
                                    item.id === participantId
                            )

                        if (!current) {

                            logger.warn(
                                `Role Sync: participante ${participantId} no encontrado en ${update.id}`
                            )

                            continue
                        }

                        const altJid =
                            current.phoneNumber ||
                            current.jid ||
                            null

                        const result =
                            await syncMemberRole({
                                userJid:
                                    current.id,
                                altJid,
                                displayName:
                                    current.notify ||
                                    null,
                                whatsappAdmin:
                                    current.admin ||
                                    null
                            })

                        if (result.changed) {

                            logger.event(
                                `Role Sync: ${participantId} ${result.previousType} -> ${result.memberType}`
                            )
                        }
                    }

                } catch (err) {

                    logger.error(
                        `Role Sync Event Error: ${err.message}`
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
                        msg.message
                            ?.conversation ||
                        msg.message
                            ?.extendedTextMessage
                            ?.text ||
                        ''

                    if (
                        msg.key.fromMe &&
                        !text.startsWith('.')
                    ) {

                        return
                    }

                    if (
                        msg.key.remoteJid ===
                        'status@broadcast'
                    ) {

                        return
                    }

                    const timestamp =
                        Number(
                            msg.messageTimestamp
                        )

                    const now =
                        Math.floor(
                            Date.now() / 1000
                        )

                    if (
                        now - timestamp >
                        30
                    ) {

                        return
                    }

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

        setTimeout(
            () => {
                startBot()
            },
            5000
        )
    }
}

async function bootstrap() {

    try {

        await initDB()

        logger.success(
            'Base de datos inicializada'
        )

        await executeRewardMaintenance()

        await executeMilestoneMaintenance()

        await executeRewardMaintenance()

        await executeSpecialCardMaintenance()

        await startBot()

    } catch (err) {

        logger.error(
            `Bootstrap Error: ${err.message}`
        )

        setTimeout(
            () => {
                bootstrap()
            },
            5000
        )
    }
}

function shutdown() {

    if (cleanupInterval) {

        clearInterval(
            cleanupInterval
        )
    }

    if (rewardMaintenanceInterval) {

        clearInterval(
            rewardMaintenanceInterval
        )
    }

    if (milestoneMaintenanceInterval) {

        clearInterval(
            milestoneMaintenanceInterval
        )
    }

    if (specialCardMaintenanceInterval) {

        clearInterval(
            specialCardMaintenanceInterval
        )
    }

    try {

        if (currentSock) {

            currentSock
                .ev
                .removeAllListeners()

            currentSock
                .ws
                ?.close()
        }

    } catch {}

    process.exit(0)
}

process.once(
    'SIGINT',
    shutdown
)

process.once(
    'SIGTERM',
    shutdown
)

logger.banner(
    settings.botName
)

logger.info(
    `Iniciando ${settings.botName}...`
)

bootstrap()