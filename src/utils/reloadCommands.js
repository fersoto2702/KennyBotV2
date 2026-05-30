const chokidar =
    require('chokidar')

const path =
    require('path')

const comandos =
    require('./commandRegistry')

const logger =
    require('./logger')

const COMMANDS_DIR =
    path.join(
        __dirname,
        '../../comandos'
    )

const loadedFiles =
    new Map()

const removeCommand = filePath => {

    const old =
        loadedFiles.get(filePath)

    if (!old) return

    comandos.delete(old.name)

    if (Array.isArray(old.aliases)) {

        for (const alias of old.aliases) {
            comandos.delete(alias)
        }

    }

    loadedFiles.delete(filePath)

}

const loadCommand = filePath => {

    try {

        removeCommand(filePath)

        const resolved =
            require.resolve(filePath)

        delete require.cache[resolved]

        const cmd =
            require(filePath)

        if (!cmd || typeof cmd.name !== 'string') {
            throw new Error('Comando inválido')
        }

        comandos.set(cmd.name, cmd)

        if (Array.isArray(cmd.aliases)) {

            for (const alias of cmd.aliases) {
                comandos.set(alias, cmd)
            }

        }

        loadedFiles.set(filePath, cmd)

        logger.success(
            `Hot Reload: ${cmd.name}`
        )

    } catch (err) {

        logger.error(
            `Reload Error: ${err.message} → ${path.basename(filePath)}`
        )

    }

}

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

    watcher.on('add', filePath => {
        loadCommand(filePath)
    })

    watcher.on('change', filePath => {
        loadCommand(filePath)
    })

    watcher.on('unlink', filePath => {

        removeCommand(filePath)

        logger.warn(
            `Command Removed: ${path.basename(filePath)}`
        )

    })

    logger.info('Hot Reload activado')

}