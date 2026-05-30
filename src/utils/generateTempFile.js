const fs =
    require('fs')

const path =
    require('path')

const crypto =
    require('crypto')

const sanitize = value =>

    String(value || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')

module.exports = (

    folder = 'temp',
    extension = 'tmp'

) => {

    const safeFolder =
        sanitize(folder)

    const safeExt =
        sanitize(extension)

    const dir =
        path.join(
            __dirname,
            `../../${safeFolder}`
        )

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, {
            recursive: true
        })

    }

    const fileName =

        `${Date.now()}-` +

        `${crypto.randomUUID()}.` +

        safeExt

    return path.join(
        dir,
        fileName
    )

}