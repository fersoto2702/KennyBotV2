const fs =
    require('fs/promises')

const path =
    require('path')

const logger =
    require('./logger')

// =========================
// CONFIG
// =========================

const tempDir =
    path.join(
        __dirname,
        '../../temp'
    )

const MAX_AGE =
    1000 * 60 * 5

// =========================
// CLEANUP
// =========================

module.exports = async () => {

    try {

        // =========================
        // EXISTS
        // =========================

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

        // =========================
        // LOOP
        // =========================

        for (const file of files) {

            try {

                const filePath =
                    path.join(
                        tempDir,
                        file
                    )

                const stats =
                    await fs.stat(filePath)

                // =========================
                // IGNORE DIRS
                // =========================

                if (
                    !stats.isFile()
                ) {

                    continue

                }

                // =========================
                // AGE
                // =========================

                const age =
                    now - stats.mtimeMs

                if (
                    age <= MAX_AGE
                ) {

                    continue

                }

                // =========================
                // DELETE
                // =========================

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

        // =========================
        // SUMMARY
        // =========================

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