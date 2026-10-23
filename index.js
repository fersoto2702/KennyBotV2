process.setMaxListeners(50)

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
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
    runObjectiveMaintenance
} = require(
    './src/services/objectiveMaintenanceService'
)

const {
    syncAllGlobalRoles,
    syncGlobalRoleForMember,
    isProductionRoleGroup
} = require(
    './src/services/globalRoleSyncService'
)

const usePairingCode =
    false

let cleanupStarted =
    false

let rewardMaintenanceStarted =
    false

let milestoneMaintenanceStarted =
    false

let specialCardMaintenanceStarted =
    false

let objectiveMaintenanceStarted =
    false

let shuttingDown =
    false

let bootstrapRetryTimer =
    null

let cleanupInterval =
    null

let rewardMaintenanceInterval =
    null

let milestoneMaintenanceInterval =
    null

let specialCardMaintenanceInterval =
    null

let objectiveMaintenanceInterval =
    null

const botStates =
    new Map()

function getBotProfile(
    profileId
) {

    const profile =
        settings?.bots?.[
            profileId
        ]

    if (
        !profile
    ) {

        throw new Error(
            `Perfil de bot inexistente: ${profileId}`
        )

    }

    return profile

}

function getBotState(
    profileId
) {

    if (
        !botStates.has(
            profileId
        )
    ) {

        botStates.set(
            profileId,
            {
                sock:
                    null,

                reconnecting:
                    false,

                reconnectTimer:
                    null,

                starting:
                    false,

                connected:
                    false
            }
        )

    }

    return botStates.get(
        profileId
    )

}

function getBotProfiles() {

    return Object.keys(
        settings?.bots || {}
    )

}

async function executeRewardMaintenance() {

    try {

        const result =
            await runRewardMaintenance()

        if (
            !result ||
            !result.processed
        ) {

            if (
                result?.reason &&
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

        const awardsPrepared =
            Number(
                summary.awardsPrepared || 0
            )

        const rewardsDelivered =
            Number(
                summary.rewardsDelivered || 0
            )

        const preparationFailures =
            Number(
                summary.preparationFailures || 0
            )

        const processingFailures =
            Number(
                summary.processingFailures || 0
            )

        if (
            awardsPrepared > 0 ||
            rewardsDelivered > 0 ||
            preparationFailures > 0 ||
            processingFailures > 0
        ) {

            logger.info(
                `Reward Maintenance | ` +
                `Premios preparados: ${awardsPrepared} | ` +
                `Recompensas entregadas: ${rewardsDelivered} | ` +
                `Errores: ${
                    preparationFailures +
                    processingFailures
                }`
            )

        }

    } catch (err) {

        logger.error(
            `Reward Maintenance Error: ${err.stack || err.message}`
        )

    }

}

async function executeMilestoneMaintenance() {

    try {

        const result =
            await runMilestoneMaintenance()

        if (
            !result ||
            !result.processed
        ) {

            if (
                result?.reason &&
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Milestone Maintenance: ${result.reason}`
                )

            }

            return

        }

        const awardsGranted =
            Number(
                result.awardsGranted || 0
            )

        const rewardsDelivered =
            Number(
                result.rewardsDelivered || 0
            )

        const failures =
            Number(
                result.failures || 0
            )

        if (
            awardsGranted > 0 ||
            rewardsDelivered > 0 ||
            failures > 0
        ) {

            logger.info(
                `Milestone Maintenance | ` +
                `Miembros revisados: ${result.membersChecked || 0} | ` +
                `Premios concedidos: ${awardsGranted} | ` +
                `Recompensas entregadas: ${rewardsDelivered} | ` +
                `Errores: ${failures}`
            )

        }

    } catch (err) {

        logger.error(
            `Milestone Maintenance Error: ${err.stack || err.message}`
        )

    }

}

async function executeSpecialCardMaintenance() {

    try {

        const result =
            await runSpecialCardMaintenance()

        if (
            !result ||
            !result.processed
        ) {

            if (
                result?.reason &&
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Special Card Maintenance: ${result.reason}`
                )

            }

            return

        }

        const changed =
            Number(
                result.changed || 0
            )

        const failed =
            Number(
                result.failed || 0
            )

        if (
            changed > 0 ||
            failed > 0
        ) {

            logger.info(
                `Special Card Maintenance | ` +
                `Cartas revisadas: ${result.checked || 0} | ` +
                `Cartas cambiadas: ${changed} | ` +
                `Sin cambios: ${result.unchanged || 0} | ` +
                `Errores: ${failed}`
            )

        }

    } catch (err) {

        logger.error(
            `Special Card Maintenance Error: ${err.stack || err.message}`
        )

    }

}

async function executeObjectiveMaintenance() {

    try {

        const result =
            await runObjectiveMaintenance()

        if (
            !result ||
            !result.processed
        ) {

            if (
                result?.reason &&
                result.reason !==
                'ALREADY_RUNNING'
            ) {

                logger.warn(
                    `Objective Maintenance: ${result.reason}`
                )

            }

            return

        }

        const eventsActivated =
            Number(
                result.eventsActivated || 0
            )

        const eventsFinished =
            Number(
                result.eventsFinished || 0
            )

        const objectivesExpired =
            Number(
                result.objectivesExpired || 0
            )

        const objectivesCancelled =
            Number(
                result.objectivesCancelled || 0
            )

        if (
            eventsActivated > 0 ||
            eventsFinished > 0 ||
            objectivesExpired > 0 ||
            objectivesCancelled > 0
        ) {

            logger.info(
                `Objective Maintenance | ` +
                `Eventos activados: ${eventsActivated} | ` +
                `Eventos finalizados: ${eventsFinished} | ` +
                `Objetivos expirados: ${objectivesExpired} | ` +
                `Objetivos cancelados: ${objectivesCancelled}`
            )

        }

    } catch (err) {

        logger.error(
            `Objective Maintenance Error: ${err.stack || err.message}`
        )

    }

}

async function executeGlobalRoleSync(
    sock
) {

    try {

        const result =
            await syncAllGlobalRoles(
                sock
            )

        if (
            !result ||
            !result.processed
        ) {

            if (
                result?.reason
            ) {

                logger.warn(
                    `Global Role Sync: ${result.reason} | ` +
                    `Grupos revisados: ${result.groupsChecked || 0} | ` +
                    `Grupos con error: ${result.groupsFailed || 0}`
                )

            }

            return

        }

        const changed =
            Number(
                result.changed || 0
            )

        const failed =
            Number(
                result.failed || 0
            )

        if (
            changed > 0 ||
            failed > 0
        ) {

            logger.info(
                `Global Role Sync | ` +
                `Grupos: ${result.groupsChecked || 0} | ` +
                `Miembros: ${result.membersChecked || 0} | ` +
                `Cambios: ${changed} | ` +
                `Errores: ${failed}`
            )

        }

    } catch (err) {

        logger.error(
            `Global Role Sync Error: ${err.stack || err.message}`
        )

    }

}

function startBackgroundTasks() {

    if (
        !cleanupStarted
    ) {

        cleanupStarted =
            true

        try {

            cleanupTemp()

        } catch (err) {

            logger.error(
                `Cleanup Error: ${err.stack || err.message}`
            )

        }

        cleanupInterval =
            setInterval(
                () => {

                    try {

                        cleanupTemp()

                    } catch (err) {

                        logger.error(
                            `Cleanup Error: ${err.stack || err.message}`
                        )

                    }

                },
                1000 * 60
            )

    }

    if (
        !rewardMaintenanceStarted
    ) {

        rewardMaintenanceStarted =
            true

        executeRewardMaintenance()

        rewardMaintenanceInterval =
            setInterval(
                () => {

                    executeRewardMaintenance()

                },
                1000 * 60 * 5
            )

    }

    if (
        !milestoneMaintenanceStarted
    ) {

        milestoneMaintenanceStarted =
            true

        milestoneMaintenanceInterval =
            setInterval(
                () => {

                    executeMilestoneMaintenance()

                },
                1000 * 60 * 60 * 24
            )

    }

    if (
        !specialCardMaintenanceStarted
    ) {

        specialCardMaintenanceStarted =
            true

        executeSpecialCardMaintenance()

        specialCardMaintenanceInterval =
            setInterval(
                () => {

                    executeSpecialCardMaintenance()

                },
                1000 * 60 * 5
            )

    }

    if (
        !objectiveMaintenanceStarted
    ) {

        objectiveMaintenanceStarted =
            true

        executeObjectiveMaintenance()

        objectiveMaintenanceInterval =
            setInterval(
                () => {

                    executeObjectiveMaintenance()

                },
                1000 * 60 * 5
            )

    }

}

async function closeBotSocket(
    profileId
) {

    const state =
        getBotState(
            profileId
        )

    const sock =
        state.sock

    state.sock =
        null

    state.connected =
        false

    state.starting =
        false

    if (!sock) {

        return

    }

    try {

        if (
            typeof sock.clearQueue ===
            'function'
        ) {

            sock.clearQueue()

        }

    } catch {}

    try {

        sock.ev
            ?.removeAllListeners()

    } catch {}

    try {

        sock.ws
            ?.close()

    } catch {}

    logger.info(
        `Socket cerrado | ${profileId}`
    )

}

function scheduleReconnect(
    profileId
) {

    if (
        shuttingDown
    ) {

        return

    }

    let profile

    try {

        profile =
            getBotProfile(
                profileId
            )

    } catch (err) {

        logger.error(
            `${err.stack || err.message}`
        )

        return

    }

    const state =
        getBotState(
            profileId
        )

    if (
        state.reconnecting
    ) {

        return

    }

    state.reconnecting =
        true

    logger.info(
        `${profile.name} | Reconectando en 5 segundos...`
    )

    if (
        state.reconnectTimer
    ) {

        clearTimeout(
            state.reconnectTimer
        )

    }

    state.reconnectTimer =
        setTimeout(
            async () => {

                state.reconnectTimer =
                    null

                try {

                    await closeBotSocket(
                        profileId
                    )

                } catch {}

                state.reconnecting =
                    false

                await startBot(
                    profileId
                )

            },
            5000
        )

}

async function handleGlobalRoleParticipantUpdate(
    sock,
    profile,
    update
) {

    if (
        profile.globalRoleSync !==
        true
    ) {

        return

    }

    if (
        update.action !== 'promote' &&
        update.action !== 'demote'
    ) {

        return

    }

    if (
        !isProductionRoleGroup(
            update.id
        )
    ) {

        logger.info(
            `Global Role Sync ignorado en grupo de prueba/no productivo: ${update.id}`
        )

        return

    }

    try {

        const affected =
            Array.isArray(
                update.participants
            )
                ? update.participants
                : []

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    1500
                )
        )

        for (
            const participant
            of affected
        ) {

            const participantId =
                typeof participant ===
                'string'
                    ? participant
                    : participant?.id

            if (
                !participantId
            ) {

                continue

            }

            try {

                const result =
                    await syncGlobalRoleForMember(
                        sock,
                        participant
                    )

                if (
                    !result ||
                    !result.processed
                ) {

                    logger.warn(
                        `Global Role Sync: ` +
                        `${participantId} | ` +
                        `${result?.reason || 'UNKNOWN'}`
                    )

                    continue

                }

                const previousType =
                    result.result?.previousType ||
                    result.memberType ||
                    'UNKNOWN'

                const currentType =
                    result.result?.memberType ||
                    result.memberType ||
                    'UNKNOWN'

                if (
                    result.result?.changed
                ) {

                    logger.event(
                        `Global Role Sync: ` +
                        `${participantId} ` +
                        `${previousType} -> ` +
                        `${currentType}`
                    )

                }

            } catch (err) {

                logger.error(
                    `Global Role Sync Member ${participantId}: ${err.stack || err.message}`
                )

            }

        }

    } catch (err) {

        logger.error(
            `${profile.name} | Global Role Sync Event Error: ${err.stack || err.message}`
        )

    }

}

async function startBot(
    profileId
) {

    if (
        shuttingDown
    ) {

        return null

    }

    let profile

    try {

        profile =
            getBotProfile(
                profileId
            )

    } catch (err) {

        logger.error(
            `${err.stack || err.message}`
        )

        return null

    }

    const botState =
        getBotState(
            profileId
        )

    if (
        botState.starting
    ) {

        return botState.sock

    }

    if (
        botState.connected &&
        botState.sock
    ) {

        return botState.sock

    }

    botState.starting =
        true

    try {

        const authFolder =
            String(
                profile.authFolder || ''
            )
                .trim()

        if (
            !authFolder
        ) {

            throw new Error(
                `El perfil ${profileId} no tiene authFolder`
            )

        }

        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                authFolder
            )

        const {
            version
        } =
            await fetchLatestBaileysVersion()

        logger.info(
            `${profile.name} | Usando WA v${version.join('.')}`
        )

        let sock =
            makeWASocket({

                auth:
                    state,

                version,

                logger:
                    P({
                        level:
                            'silent'
                    }),

                printQRInTerminal:
                    false,

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

        sock.botProfile =
            profile

        sock.botProfileId =
            profileId

        sock =
            patchSocket(
                sock
            )

        botState.sock =
            sock

        if (
            usePairingCode &&
            !state.creds.registered
        ) {

            const phoneNumber =
                String(
                    profile.phoneNumber || ''
                )
                    .replace(
                        /\D/g,
                        ''
                    )

            if (
                !phoneNumber
            ) {

                logger.warn(
                    `${profile.name} | No hay phoneNumber configurado para pairing code`
                )

            } else {

                try {

                    const code =
                        await sock.requestPairingCode(
                            phoneNumber
                        )

                    console.log(
                        `\n📲 ${profile.name}\nCódigo de vinculación:\n${code}\n`
                    )

                } catch (err) {

                    logger.error(
                        `${profile.name} | Pairing Error: ${err.stack || err.message}`
                    )

                }

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
                    } =
                        update

                    if (
                        qr &&
                        !usePairingCode
                    ) {

                        console.log(
                            '\n━━━━━━━━━━━━━━━━━━━━━━━━━━'
                        )

                        console.log(
                            `📲 VINCULAR ${profile.name}`
                        )

                        console.log(
                            `🌎 Perfil: ${profile.flag || ''} ${profileId}`
                        )

                        console.log(
                            `📁 Sesión: ${profile.authFolder}`
                        )

                        console.log(
                            '━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                        )

                        try {

                            logger.qr()

                        } catch {}

                        qrcode.generate(
                            qr,
                            {
                                small:
                                    true
                            }
                        )

                    }

                    if (
                        connection ===
                        'open'
                    ) {

                        if (
                            botState.sock !==
                            sock
                        ) {

                            return

                        }

                        botState.connected =
                            true

                        botState.reconnecting =
                            false

                        botState.starting =
                            false

                        if (
                            botState.reconnectTimer
                        ) {

                            clearTimeout(
                                botState.reconnectTimer
                            )

                            botState.reconnectTimer =
                                null

                        }

                        logger.success(
                            `${profile.name} conectado`
                        )

                        logger.statusTable({

                            Bot:
                                profile.name,

                            Perfil:
                                `${profile.flag || ''} ${profileId}`,

                            Owner:
                                settings.ownerNumber?.[0] ||
                                'No configurado',

                            Sesión:
                                profile.authFolder,

                            Estado:
                                'Conectado ✅'

                        })

                        startBackgroundTasks()

                        if (
                            profile.globalRoleSync ===
                            true
                        ) {

                            await executeGlobalRoleSync(
                                sock
                            )

                        }

                    }

                    if (
                        connection ===
                        'close'
                    ) {

                        if (
                            botState.sock !==
                            sock
                        ) {

                            return

                        }

                        botState.connected =
                            false

                        botState.starting =
                            false

                        const reason =
                            lastDisconnect
                                ?.error
                                ?.output
                                ?.statusCode

                        logger.warn(
                            `${profile.name} desconectado: ${reason ?? 'desconocido'}`
                        )

                        if (
                            reason ===
                            DisconnectReason.loggedOut
                        ) {

                            botState.sock =
                                null

                            botState.reconnecting =
                                false

                            if (
                                botState.reconnectTimer
                            ) {

                                clearTimeout(
                                    botState.reconnectTimer
                                )

                                botState.reconnectTimer =
                                    null

                            }

                            logger.error(
                                `${profile.name} | Sesión cerrada.`
                            )

                            return

                        }

                        scheduleReconnect(
                            profileId
                        )

                    }

                } catch (err) {

                    logger.error(
                        `${profile.name} | Connection Update Error: ${err.stack || err.message}`
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
                        `${profile.name} | Welcome Event Error: ${err.stack || err.message}`
                    )

                }

                await handleGlobalRoleParticipantUpdate(
                    sock,
                    profile,
                    update
                )

            }
        )

        sock.ev.on(
            'messages.upsert',
            async ({
                messages
            }) => {

                try {

                    if (
                        botState.sock !==
                        sock
                    ) {

                        return

                    }

                    const msg =
                        messages?.[0]

                    if (
                        !msg
                    ) {

                        return

                    }

                    if (
                        !msg.message
                    ) {

                        return

                    }

                    if (
                        msg.key?.remoteJid ===
                        'status@broadcast'
                    ) {

                        return

                    }

                    await messagesEvent(
                        sock,
                        messages
                    )

                } catch (err) {

                    logger.error(
                        `${profile.name} | Messages Error: ${err.stack || err.message}`
                    )

                }

            }
        )

        botState.starting =
            false

        return sock

    } catch (err) {

        botState.starting =
            false

        botState.connected =
            false

        logger.error(
            `StartBot ${profile.name}: ${err.stack || err.message}`
        )

        scheduleReconnect(
            profileId
        )

        return null

    }

}

async function bootstrap() {

    try {

        if (
            bootstrapRetryTimer
        ) {

            clearTimeout(
                bootstrapRetryTimer
            )

            bootstrapRetryTimer =
                null

        }

        await initDB()

        logger.success(
            'Base de datos inicializada'
        )

        await executeRewardMaintenance()

        await executeMilestoneMaintenance()

        await executeSpecialCardMaintenance()

        await executeObjectiveMaintenance()

        const botProfiles =
            getBotProfiles()

        if (
            botProfiles.length ===
            0
        ) {

            throw new Error(
                'No hay perfiles de bot configurados'
            )

        }

        logger.info(
            `Iniciando ${botProfiles.length} instancia(s): ${botProfiles.join(', ')}`
        )

        const results =
            await Promise.allSettled(
                botProfiles.map(
                    profileId =>
                        startBot(
                            profileId
                        )
                )
            )

        results.forEach(
            (
                result,
                index
            ) => {

                const profileId =
                    botProfiles[
                        index
                    ]

                if (
                    result.status ===
                    'rejected'
                ) {

                    logger.error(
                        `No se pudo iniciar ${profileId}: ${result.reason?.stack || result.reason?.message || result.reason}`
                    )

                }

            }
        )

    } catch (err) {

        logger.error(
            `Bootstrap Error: ${err.stack || err.message}`
        )

        if (
            shuttingDown
        ) {

            return

        }

        if (
            bootstrapRetryTimer
        ) {

            clearTimeout(
                bootstrapRetryTimer
            )

        }

        bootstrapRetryTimer =
            setTimeout(
                () => {

                    bootstrapRetryTimer =
                        null

                    bootstrap()

                },
                5000
            )

    }

}

async function shutdown() {

    if (
        shuttingDown
    ) {

        return

    }

    shuttingDown =
        true

    logger.info(
        'Cerrando KennyBot...'
    )

    if (
        bootstrapRetryTimer
    ) {

        clearTimeout(
            bootstrapRetryTimer
        )

        bootstrapRetryTimer =
            null

    }

    for (
        const [
            profileId,
            state
        ]
        of botStates
    ) {

        if (
            state.reconnectTimer
        ) {

            clearTimeout(
                state.reconnectTimer
            )

            state.reconnectTimer =
                null

        }

        state.reconnecting =
            false

        state.starting =
            false

        logger.info(
            `Deteniendo ${profileId}...`
        )

    }

    if (
        cleanupInterval
    ) {

        clearInterval(
            cleanupInterval
        )

        cleanupInterval =
            null

    }

    if (
        rewardMaintenanceInterval
    ) {

        clearInterval(
            rewardMaintenanceInterval
        )

        rewardMaintenanceInterval =
            null

    }

    if (
        milestoneMaintenanceInterval
    ) {

        clearInterval(
            milestoneMaintenanceInterval
        )

        milestoneMaintenanceInterval =
            null

    }

    if (
        specialCardMaintenanceInterval
    ) {

        clearInterval(
            specialCardMaintenanceInterval
        )

        specialCardMaintenanceInterval =
            null

    }

    if (
        objectiveMaintenanceInterval
    ) {

        clearInterval(
            objectiveMaintenanceInterval
        )

        objectiveMaintenanceInterval =
            null

    }

    const profiles =
        [
            ...botStates.keys()
        ]

    await Promise.allSettled(
        profiles.map(
            profileId =>
                closeBotSocket(
                    profileId
                )
        )
    )

    logger.success(
        'Todas las sesiones fueron cerradas'
    )

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
    'Iniciando sistema multi-bot...'
)

logger.info(
    `Instancias configuradas: ${
        getBotProfiles()
            .join(', ')
    }`
)

bootstrap()