const chokidar =
    require('chokidar')

const fs =
    require('fs')

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

        return true

    } catch (err) {

        logger.error(
            `Reload Error: ${err.message} → ${path.basename(filePath)}`
        )

        return false

    }

}

const collectFiles = dir => {

    const files = []

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {

        if (entry.name.startsWith('.')) continue

        const fullPath =
            path.join(dir, entry.name)

        if (entry.isDirectory()) {

            files.push(...collectFiles(fullPath))

        } else if (
            entry.isFile() &&
            entry.name.endsWith('.js')
        ) {

            files.push(fullPath)

        }

    }

    return files

}

/*
 * Recarga TODOS los comandos de /comandos bajo demanda.
 * Lo usa el panel (botón "Recargar módulos").
 *
 * Devuelve cuántos cargó bien, cuántos fallaron
 * y cuántos se quitaron porque su archivo ya no existe.
 */
const reloadAll = () => {

    const files =
        collectFiles(COMMANDS_DIR)

    const onDisk =
        new Set(files)

    let removed = 0

    for (const filePath of [...loadedFiles.keys()]) {

        if (!onDisk.has(filePath)) {

            removeCommand(filePath)

            removed++

        }

    }

    let loaded = 0
    let failed = 0

    for (const filePath of files) {

        if (loadCommand(filePath)) {
            loaded++
        } else {
            failed++
        }

    }

    return {
        total: files.length,
        loaded,
        failed,
        removed
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

module.exports.reloadAll =
    reloadAll