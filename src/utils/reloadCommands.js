const chokidar =
    require('chokidar')

const path =
    require('path')

const comandos =
    require('./commandRegistry')

const logger =
    require('./logger')

// =========================
// PATH
// =========================

const COMMANDS_DIR =
    path.join(
        __dirname,
        '../../comandos'
    )

// =========================
// CACHE
// =========================

const loadedFiles =
    new Map()

// =========================
// REMOVE COMMAND
// =========================

const removeCommand = filePath => {

    const old =
        loadedFiles.get(filePath)

    if (!old)
        return

    comandos.delete(old.name)

    if (Array.isArray(old.aliases)) {

        for (const alias of old.aliases) {

            comandos.delete(alias)

        }

    }

    loadedFiles.delete(filePath)

}

// =========================
// LOAD COMMAND
// =========================

const loadCommand = filePath => {

    try {

        // =========================
        // CLEAR OLD
        // =========================

        removeCommand(filePath)

        // =========================
        // REQUIRE CACHE
        // =========================

        const resolved =
            require.resolve(filePath)

        delete require.cache[resolved]

        // =========================
        // LOAD
        // =========================

        const cmd =
            require(filePath)

        // =========================
        // VALIDATE
        // =========================

        if (
            !cmd ||
            typeof cmd.name !== 'string'
        ) {

            throw new Error(
                'Comando inválido'
            )

        }

        // =========================
        // REGISTER
        // =========================

        comandos.set(
            cmd.name,
            cmd
        )

        if (Array.isArray(cmd.aliases)) {

            for (const alias of cmd.aliases) {

                comandos.set(alias, cmd)

            }

        }

        // =========================
        // SAVE
        // =========================

        loadedFiles.set(
            filePath,
            cmd
        )

        logger.success(
            `Hot Reload: ${cmd.name}`
        )

    } catch (err) {

        logger.error(

            `Reload Error: ${err.message} → ${path.basename(filePath)}`

        )

    }

}

// =========================
// EXPORT
// =========================

module.exports = () => {

    const watcher = chokidar.watch(

        COMMANDS_DIR,

        {

            ignoreInitial: false,

            persistent: true,

            awaitWriteFinish: {

                stabilityThreshold: 300,

                pollInterval: 100

            },

            ignored: [

                /(^|[\/\\])\../,
                /\.map$/,
                /~$/

            ]

        }

    )

    // =========================
    // ADD
    // =========================

    watcher.on('add', filePath => {

        loadCommand(filePath)

    })

    // =========================
    // CHANGE
    // =========================

    watcher.on('change', filePath => {

        loadCommand(filePath)

    })

    // =========================
    // DELETE
    // =========================

    watcher.on('unlink', filePath => {

        removeCommand(filePath)

        logger.warn(

            `Command Removed: ${path.basename(filePath)}`

        )

    })

    logger.info(
        'Hot Reload activado'
    )

}