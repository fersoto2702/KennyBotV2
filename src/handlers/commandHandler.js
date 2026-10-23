const fs =

    require('fs')



const path =

    require('path')



const logger =

    require('../utils/logger')



const ui =

    require('../utils/ui')



const comandos =

    require('../utils/commandRegistry')



const isGroupAdmin =

    require('../utils/isAdmin')



const {

    addWarn,

    resetWarns

} = require('../utils/warnSystem')



const {

    isFlooding

} = require('../utils/floodSystem')



const {

    isLimited,

    isGroupLimited,

    getRemainingTime

} = require('../system/rateLimiter')



const soloAdminsPath =

    path.join(

        __dirname,

        '../../database/soloadmins.json'

    )



const aliasesCache =

    new Map()

const soloAdminsCache = {

    data:
        [],

    loadedAt:
        0

}

const SOLO_ADMINS_CACHE_TIME =
    5000



function normalizeJid(

    jid

) {



    if (!jid) {



        return null



    }



    return String(jid)

        .trim()

        .replace(

            /:\d+@/,

            '@'

        )



}



function isGroup(

    jid

) {



    return Boolean(

        jid &&

        jid.endsWith('@g.us')

    )



}



function getSender(

    sock,
    msg

) {

    if (
        msg?.key?.fromMe
    ) {

        return normalizeJid(
            sock?.user?.lid ||
            sock?.user?.id
        )

    }

    return normalizeJid(

        msg?.key?.participant ||

        msg?.participant ||

        msg?.key?.remoteJid

    )

}



function getSenderAlt(

    sock,
    msg

) {

    const sender =
        getSender(
            sock,
            msg
        )

    const candidates =
        msg?.key?.fromMe
            ? [
                sock?.user?.id,
                sock?.user?.lid
            ]
            : [
                msg?.key?.participantAlt,
                msg?.participantAlt
            ]

    for (
        const value
        of candidates
    ) {

        const normalized =
            normalizeJid(
                value
            )

        if (
            normalized &&
            normalized !== sender
        ) {

            return normalized

        }

    }

    return null

}



function getNumberFromJid(

    jid

) {



    const normalized =

        normalizeJid(

            jid

        )



    if (

        !normalized ||

        normalized.endsWith('@lid')

    ) {



        return null



    }



    return normalized

        .split('@')[0]



}



function getParticipantAliases(

    participant

) {



    if (!participant) {



        return []



    }



    return [



        participant.id,



        participant.phoneNumber,



        participant.lid



    ]

        .map(

            normalizeJid

        )

        .filter(Boolean)



}



function findParticipant(

    participants,

    ...jids

) {



    const targets =

        jids

            .map(

                normalizeJid

            )

            .filter(Boolean)



    if (

        !targets.length

    ) {



        return null



    }



    return (

        participants.find(



            participant => {



                const aliases =

                    getParticipantAliases(

                        participant

                    )



                return targets.some(

                    target =>

                        aliases.includes(

                            target

                        )

                )



            }



        ) ||

        null

    )



}



function getParticipantNumber(

    participant

) {



    if (!participant) {



        return null



    }



    const candidates = [



        participant.phoneNumber,



        participant.id,



        participant.lid



    ]



    for (

        const candidate

        of candidates

    ) {



        const number =

            getNumberFromJid(

                candidate

            )



        if (number) {



            return number



        }



    }



    return null



}



async function resolveSenderNumber(

    sock,

    from,

    sender,

    senderAlt

) {



    const direct =



        getNumberFromJid(

            sender

        )



        ||



        getNumberFromJid(

            senderAlt

        )



    if (direct) {



        return direct



    }



    if (

        isGroup(from)

    ) {



        try {



            const metadata =

                await sock.groupMetadata(

                    from

                )



            const participant =

                findParticipant(



                    metadata?.participants ||

                    [],



                    sender,



                    senderAlt



                )



            return getParticipantNumber(

                participant

            )



        } catch (err) {



            logger.error(

                `Resolve sender number: ${err.stack || err.message}`

            )



        }



    }



    return null



}



function ensureSoloAdminsDb() {



    try {



        const directory =

            path.dirname(

                soloAdminsPath

            )



        if (

            !fs.existsSync(

                directory

            )

        ) {



            fs.mkdirSync(

                directory,

                {

                    recursive:

                        true

                }

            )



        }



        if (

            !fs.existsSync(

                soloAdminsPath

            )

        ) {



            fs.writeFileSync(



                soloAdminsPath,



                JSON.stringify(

                    [],

                    null,

                    2

                ),



                'utf8'



            )



        }



    } catch (err) {



        logger.error(

            `SoloAdmins DB init: ${err.stack || err.message}`

        )



    }



}



function isSoloAdminsGroup(

    from

) {

    ensureSoloAdminsDb()

    try {

        const now =
            Date.now()

        if (
            now -
                soloAdminsCache.loadedAt <
            SOLO_ADMINS_CACHE_TIME
        ) {

            return soloAdminsCache.data.includes(
                from
            )

        }

        const data =
            JSON.parse(

                fs.readFileSync(
                    soloAdminsPath,
                    'utf8'
                )

            )

        if (
            !Array.isArray(
                data
            )
        ) {

            soloAdminsCache.data =
                []

            soloAdminsCache.loadedAt =
                now

            return false

        }

        soloAdminsCache.data =
            data

        soloAdminsCache.loadedAt =
            now

        return data.includes(
            from
        )

    } catch (err) {

        logger.error(
            `SoloAdmins DB read: ${err.stack || err.message}`
        )

        return false

    }

}



function getBotProfile(

    sock,

    settings

) {



    return (

        sock?.botProfile ||

        settings?.bots?.main ||

        {

            id:

                'main',



            name:

                settings?.botName ||

                'KennyBot'

        }

    )



}



function getBotProfileId(

    sock,

    settings

) {



    const profile =

        getBotProfile(

            sock,

            settings

        )



    return String(

        profile?.id ||

        sock?.botProfileId ||

        'main'

    )

        .trim()

        .toLowerCase()



}



function getBotName(

    sock,

    settings

) {



    const profile =

        getBotProfile(

            sock,

            settings

        )



    return String(

        profile?.name ||

        settings?.botName ||

        'KennyBot'

    )

        .trim()



}



function getMaintenanceCommands(

    settings

) {



    return new Set(



        (

            Array.isArray(

                settings?.maintenanceCommands

            )

                ? settings.maintenanceCommands

                : []

        )

            .map(

                value =>

                    String(

                        value || ''

                    )

                        .trim()

                        .toLowerCase()

            )

            .filter(Boolean)



    )



}



async function sendMaintenanceMessage({



    sock,



    from,



    command,



    prefix,



    settings



}) {



    const profile =

        getBotProfile(

            sock,

            settings

        )



    const brazil =

        profile?.id ===

        'brazil'



    const botName =

        getBotName(

            sock,

            settings

        )



    const flag =

        String(

            profile?.flag ||

            ''

        )

            .trim()



    const config =

        settings?.maintenanceMessage ||

        {}



    const title =

        String(

            config.title ||

            (

                brazil

                    ? 'SISTEMA EM MANUTENÇÃO'

                    : 'SISTEMA EN MANTENIMIENTO'

            )

        )



    const description =

        String(

            config.description ||

            (

                brazil

                    ? 'Este sistema está temporariamente em manutenção.'

                    : 'Este sistema se encuentra temporalmente en mantenimiento.'

            )

        )



    const footer =

        String(

            config.footer ||

            (

                brazil

                    ? 'Estará disponível novamente em breve.'

                    : 'Estará disponible nuevamente próximamente.'

            )

        )



    const status =

        brazil

            ? 'EM MANUTENÇÃO'

            : 'EN MANTENIMIENTO'



    const commandLabel =

        brazil

            ? 'Comando'

            : 'Comando'



    const statusLabel =

        brazil

            ? 'Status'

            : 'Estado'



    await sock.safeSendMessage(



        from,



        {



            text: [



                `ㅤ۟∩　ׅ　🛠️　ׅ　\*${title}\*　ׄᰙ`,



                '',



                `𖣣ֶㅤ֯⌗ 🤖  ׄ ⬭ \*Bot:\* ${flag ? `${flag} ` : ''}${botName}`,



                `𖣣ֶㅤ֯⌗ ⚙️  ׄ ⬭ \*${commandLabel}:\* ${prefix}${command.name}`,



                `𖣣ֶㅤ֯⌗ 🚧  ׄ ⬭ \*${statusLabel}:\* ${status}`,



                '',



                `╰─ 𓂃 ${description}`,



                `╰─ 𓂃 ${footer}`



            ]

                .filter(Boolean)

                .join('\n')



        }



    )



}



function registerCommand(

    cmd,

    file

) {



    if (

        !cmd ||

        typeof cmd !==

        'object'

    ) {



        logger.error(

            `${file} no exporta un comando válido`

        )



        return



    }



    const name =

        String(

            cmd.name ||

            ''

        )

            .trim()

            .toLowerCase()



    if (!name) {



        logger.error(

            `${file} no tiene name`

        )



        return



    }



    cmd.name =

        name



    if (

        aliasesCache.has(

            name

        )

    ) {



        logger.warn(

            `Comando duplicado ignorado: ${name} (${file})`

        )



        return



    }



    comandos.set(

        name,

        cmd

    )



    aliasesCache.set(

        name,

        cmd

    )



    if (

        Array.isArray(

            cmd.aliases

        )

    ) {



        for (

            const rawAlias

            of cmd.aliases

        ) {



            const alias =

                String(

                    rawAlias ||

                    ''

                )

                    .trim()

                    .toLowerCase()



            if (

                !alias ||

                alias === name

            ) {



                continue



            }



            if (

                aliasesCache.has(

                    alias

                )

            ) {



                logger.warn(

                    `Alias duplicado "${alias}" en ${file}`

                )



                continue



            }



            aliasesCache.set(

                alias,

                cmd

            )



        }



    }



    logger.success(

        `Comando cargado: ${name}`

    )



}



function loadCommands(

    dir

) {



    if (

        !fs.existsSync(

            dir

        )

    ) {



        logger.error(

            `Directorio de comandos inexistente: ${dir}`

        )



        return



    }



    const files =

        fs.readdirSync(

            dir

        )



    for (

        const file

        of files

    ) {



        const fullPath =

            path.join(

                dir,

                file

            )



        let stat



        try {



            stat =

                fs.statSync(

                    fullPath

                )



        } catch (err) {



            logger.error(

                `No se pudo leer ${fullPath}: ${err.message}`

            )



            continue



        }



        if (

            stat.isDirectory()

        ) {



            loadCommands(

                fullPath

            )



            continue



        }



        if (

            !file.endsWith(

                '.js'

            )

        ) {



            continue



        }



        try {



            const resolved =

                require.resolve(

                    fullPath

                )



            delete require.cache[

                resolved

            ]



            const cmd =

                require(

                    fullPath

                )



            registerCommand(

                cmd,

                file

            )



        } catch (err) {



            logger.error(

                `Error cargando ${file}: ${err.stack || err.message}`

            )



        }



    }



}



loadCommands(



    path.join(

        __dirname,

        '../../comandos'

    )



)



module.exports =

    async ({



        sock,



        msg,



        from,



        text,



        settings



    }) => {



        try {



            if (

                !msg?.message

            ) {



                return false



            }



            if (

                !text ||

                typeof text !==

                'string'

            ) {



                return false



            }



            const sender =

                getSender(

                    sock,
                    msg

                )



            const senderAlt =

                getSenderAlt(

                    sock,
                    msg

                )

            const isFromMe =
                msg?.key?.fromMe ===
                true



            if (!sender) {



                return false



            }



            const botProfile =

                getBotProfile(

                    sock,

                    settings

                )



            const botProfileId =

                getBotProfileId(

                    sock,

                    settings

                )



            const botName =

                getBotName(

                    sock,

                    settings

                )



            const rateLimitScope =

                botProfileId



            const prefixes =

                Array.isArray(

                    settings?.prefixes

                )



                    ? settings.prefixes



                    : [

                        settings?.prefix ||

                        '/'

                    ]



            const prefix =

                prefixes.find(



                    value =>



                        typeof value ===

                        'string' &&



                        value &&



                        text.startsWith(

                            value

                        )



                )



            if (!prefix) {



                return false



            }



            const content =

                text

                    .slice(

                        prefix.length

                    )

                    .trim()



            if (!content) {



                return false



            }



            const args =

                content

                    .split(/\s+/)



            const commandName =

                args

                    .shift()

                    ?.toLowerCase()



            if (!commandName) {



                return false



            }



            const command =

                aliasesCache.get(

                    commandName

                )



            if (!command) {



                return false



            }



            const maintenanceCommands =

                getMaintenanceCommands(

                    settings

                )



            if (

                maintenanceCommands.has(

                    command.name

                )

            ) {



                try {



                    await sendMaintenanceMessage({



                        sock,



                        from,



                        command,



                        prefix,



                        settings



                    })



                } catch (err) {



                    logger.error(

                        `${botName} | Maintenance Message Error: ${err.stack || err.message}`

                    )



                }



                logger.info(

                    `${botName} | Comando en mantenimiento: ${command.name} | ${sender.split('@')[0]}`

                )



                return false



            }



            if (

                !isFromMe &&
                isGroup(from) &&

                isFlooding(

                    sender,

                    5,

                    7000,

                    botProfileId

                )

                ) {



                logger.warn(

                    `${botName} | Flood: ${sender.split('@')[0]}`

                )



                const warns =

                    addWarn(

                        from,

                        sender

                    )



                const bar =



                    '●'.repeat(

                        Math.min(

                            warns,

                            3

                        )

                    )



                    +



                    '○'.repeat(

                        Math.max(

                            0,

                            3 - warns

                        )

                    )



                if (

                    warns >=

                    3

                ) {



                    try {



                        if (

                            typeof sock.safeGroupUpdate ===

                            'function'

                        ) {



                            await sock.safeGroupUpdate(

                                from,

                                [sender],

                                'remove'

                            )



                        } else {



                            await sock.groupParticipantsUpdate(

                                from,

                                [sender],

                                'remove'

                            )



                        }



                        resetWarns(

                            from,

                            sender

                        )



                        logger.event(

                            `${botName} | Expulsado por flood: ${sender.split('@')[0]}`

                        )



                        await sock.safeSendMessage(



                            from,



                            {



                                text:

                                    ui.error(

                                        'USUARIO EXPULSADO',

                                        `@${sender.split('@')[0]} fue expulsado por flood.`

                                    ),



                                mentions:

                                    [sender]



                            }



                        )



                    } catch (err) {



                        logger.error(

                            `${botName} | Expulsión antiflood: ${err.stack || err.message}`

                        )



                        try {



                            await sock.safeSendMessage(



                                from,



                                {



                                    text:

                                        ui.error(

                                            'SIN PERMISOS',

                                            'No pude expulsar al usuario.'

                                        )



                                }



                            )



                        } catch {}



                    }



                    return false



                }



                await sock.safeSendMessage(



                    from,



                    {



                        text:

                            ui.warn(

                                'FLOOD DETECTADO',

                                `@${sender.split('@')[0]}\nWarns: ${bar} ${warns}/3`

                            ),



                        mentions:

                            [sender]



                    }



                )



                return false



            }



            if (

                isGroup(from) &&

                command.name !==

                'admins' &&

                isSoloAdminsGroup(

                    from

                )

            ) {



                let senderAdmin =

                    await isGroupAdmin(

                        sock,

                        from,

                        sender

                    )



                if (

                    !senderAdmin &&

                    senderAlt

                ) {



                    senderAdmin =

                        await isGroupAdmin(

                            sock,

                            from,

                            senderAlt

                        )



                }



                if (

                    !senderAdmin

                ) {



                    await sock.safeSendMessage(



                        from,



                        {



                            text:

                                ui.error(

                                    'MODO SOLO ADMINS',

                                    'El bot está restringido a administradores en este grupo.'

                                )



                        }



                    )



                    return false



                }



            }



            if (

                command.ownerOnly

            ) {



                const senderNumber =

                    await resolveSenderNumber(

                        sock,

                        from,

                        sender,

                        senderAlt

                    )



                const owners =

                    (

                        Array.isArray(

                            settings?.ownerNumber

                        )



                            ? settings.ownerNumber



                            : [

                                settings?.ownerNumber

                            ]

                    )

                        .map(

                            value =>

                                String(

                                    value ||

                                    ''

                                )

                                    .replace(

                                        /\D/g,

                                        ''

                                    )

                        )

                        .filter(Boolean)



                if (

                    !senderNumber ||

                    !owners.includes(

                        senderNumber

                    )

                ) {



                    await sock.safeSendMessage(



                        from,



                        {



                            text:

                                ui.error(

                                    'ACCESO DENEGADO',

                                    'Solo el owner puede usar este comando.'

                                )



                        }



                    )



                    return false



                }



            }



            if (

                command.groupOnly &&

                !isGroup(from)

            ) {



                await sock.safeSendMessage(



                    from,



                    {



                        text:

                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona en grupos.'

                            )



                    }



                )



                return false



            }



            if (

                command.privateOnly &&

                isGroup(from)

            ) {



                await sock.safeSendMessage(



                    from,



                    {



                        text:

                            ui.error(

                                'SOLO PRIVADO',

                                'Este comando solo funciona en privado.'

                            )



                    }



                )



                return false



            }



            if (

                command.adminOnly

            ) {



                if (

                    !isGroup(from)

                ) {



                    await sock.safeSendMessage(



                        from,



                        {



                            text:

                                ui.error(

                                    'SOLO GRUPOS',

                                    'Este comando solo funciona en grupos.'

                                )



                        }



                    )



                    return false



                }



                let senderAdmin =

                    await isGroupAdmin(

                        sock,

                        from,

                        sender

                    )



                if (

                    !senderAdmin &&

                    senderAlt

                ) {



                    senderAdmin =

                        await isGroupAdmin(

                            sock,

                            from,

                            senderAlt

                        )



                }



                if (

                    !senderAdmin

                ) {



                    await sock.safeSendMessage(



                        from,



                        {



                            text:

                                ui.error(

                                    'ACCESO DENEGADO',

                                    'Solo administradores pueden usar este comando.'

                                )



                        }



                    )



                    return false



                }



            }



            if (

                !isFromMe &&
                isLimited(

                    sender,

                    'commands',

                    rateLimitScope

                )

            ) {



                const left =

                    getRemainingTime(

                        sender,

                        'commands',

                        rateLimitScope

                    )



                await sock.safeSendMessage(



                    from,



                    {



                        text:

                            ui.warn(

                                'RATE LIMIT',

                                `Estás usando demasiados comandos.\n\nEspera ${left}s.`

                            )



                    }



                )



                return false



            }



            if (

                !isFromMe &&
                isGroup(from) &&

                isGroupLimited(

                    from,

                    'commands',

                    rateLimitScope

                )

            ) {



                await sock.safeSendMessage(



                    from,



                    {



                        text:

                            ui.warn(

                                'GRUPO SATURADO',

                                'Demasiados comandos en poco tiempo.'

                            )



                    }



                )



                return false



            }



            logger.cmd(

                `${botName} | ${command.name} → ${sender.split('@')[0]}`

            )



            try {



                await command.execute({



                    sock,



                    msg,



                    from,



                    args,



                    settings,



                    prefix,



                    botProfile



                })



                return true



            } catch (err) {



                logger.error(

                    `${botName} | Execute ${command.name}: ${err.stack || err.message}`

                )



                try {



                    await sock.safeSendMessage(



                        from,



                        {



                            text:

                                ui.error(

                                    'ERROR',

                                    'Ocurrió un error ejecutando el comando.'

                                )



                        }



                    )



                } catch {}



                return false



            }



        } catch (err) {



            logger.error(

                `CommandHandler Error: ${err.stack || err.message}`

            )



            return false



        }



    }