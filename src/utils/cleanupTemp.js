const fs =
    require('fs/promises')

const path =
    require('path')

const logger =
    require('./logger')

const tempDir =
    path.join(
        __dirname,
        '../../temp'
    )

const MAX_AGE =
    1000 * 60 * 5

module.exports = async () => {

    try {

        try {

            await fs.access(tempDir)

        } catch {

            return

        }

        const now =
            Date.now()

        const files =
            await fs.readdir(tempDir)

        let deleted =
            0

        let freedSpace =
            0

        for (const file of files) {

            try {

                const filePath =
                    path.join(
                        tempDir,
                        file
                    )

                const stats =
                    await fs.stat(filePath)

                if (
                    !stats.isFile()
                ) {

                    continue

                }

                const age =
                    now - stats.mtimeMs

                if (
                    age <= MAX_AGE
                ) {

                    continue

                }

                await fs.unlink(filePath)

                deleted++

                freedSpace +=
                    stats.size

                logger.info(
                    `Temp eliminado: ${file}`
                )

            } catch (err) {

                logger.error(
                    `Error limpiando temp: ${err.message}`
                )

            }

        }

        if (deleted > 0) {

            const mb =
                (
                    freedSpace /
                    1024 /
                    1024
                ).toFixed(2)

            logger.success(

                `Cleanup completado → ${deleted} archivos eliminados (${mb} MB liberados)`

            )

        }

    } catch (err) {

        logger.error(
            `CleanupTemp Error: ${err.message}`
        )

    }

}