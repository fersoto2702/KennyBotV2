const fs =
    require('fs')

const path =
    require('path')

const crypto =
    require('crypto')

// =========================
// SANITIZE
// =========================

const sanitize = value =>

    String(value || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')

// =========================
// GENERATE
// =========================

module.exports = (

    folder = 'temp',
    extension = 'tmp'

) => {

    // =========================
    // CLEAN
    // =========================

    const safeFolder =
        sanitize(folder)

    const safeExt =
        sanitize(extension)

    // =========================
    // DIR
    // =========================

    const dir =
        path.join(
            __dirname,
            `../../${safeFolder}`
        )

    // =========================
    // CREATE DIR
    // =========================

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, {
            recursive: true
        })

    }

    // =========================
    // FILE
    // =========================

    const fileName =

        `${Date.now()}-` +

        `${crypto.randomUUID()}.` +

        safeExt

    // =========================
    // RETURN
    // =========================

    return path.join(
        dir,
        fileName
    )

}