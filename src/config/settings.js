function normalizeArray(
    values
) {

    return [
        ...new Set(
            (Array.isArray(values)
                ? values
                : []
            )
                .map(
                    value =>
                        String(value || '')
                            .trim()
                )
                .filter(Boolean)
        )
    ]

}


const settings = {

    botName:
        'KennyBot',

    prefixes:
        normalizeArray([
            '/',
            '.',
            '#'
        ]),

    ownerNumber:
        normalizeArray([
            '50933490758'
        ]),

    roleAuthorityGroup:
        null,

    stickerPack:
        'KennyBot',

    stickerAuthor:
        'Kenny'

}


module.exports =
    settings