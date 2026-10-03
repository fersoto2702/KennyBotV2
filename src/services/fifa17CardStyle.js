const path = require('path')

const FIFA17_CARD_STYLES = {
    toty: {
    template: path.join(
        __dirname,
        '..',
        '..',
        'wefut-fifa17-gold5.png'
    ),
    textColor: '#F9E99E',
    chemistryColor: '#F9E99E',

    playerImage: {
        height: 143,
        x: 100,
        y: 37,
        visibleBottom: 174
    }
},
    silver: {
    template: path.join(
        __dirname,
        '..',
        '..',
        'fifa17-silver-template.png'
    ),
    textColor: '#36211B',
    chemistryColor: '#36211B',

    playerImage: {
        height: 143,
        x: 100,
        y: 37,
        visibleBottom: 174,
        rightInset: 6
    },

    nameBand: {
    top: 158,
    height: 29
    },

    rightBorder: {
    width: 10,
    top: 110,
    height: 85
    }
    },

    gold: {
    template: path.join(
        __dirname,
        '..',
        '..',
        'fifa17-gold-template.png'
    ),
    textColor: '#36211B',
    chemistryColor: '#36211B',

    playerImage: {
        height: 143,
        x: 100,
        y: 37,
        visibleBottom: 174
    },

     nameBand: {
    top: 158,
    height: 29
    },

    rightBorder: {
    width: 10,
    top: 110,
    height: 85
    }
    },

    rare_gold: {
        template: path.join(
            __dirname,
            '..',
            '..',
            'fifa17-rare-gold-template.png'
        ),
        textColor: '#36211B',
        chemistryColor: '#36211B',

    playerImage: {
        height: 143,
        x: 100,
        y: 37,
        visibleBottom: 174
    },

        nameBand: {
        top: 158,
        height: 29
        },

        rightBorder: {
        width: 10,
        top: 110,
        height: 85
        }
        },

    fut_birthday: {
        template: path.join(__dirname, '..', '..', 'fifa17-fut-birthday-template.png'),
        textColor: '#FFFFFF',
        ratingPositionColor: '#28669A',
        chemistryColor: '#FFFFFF',
        playerImage: {
        height: 125,
        x: 90,
        y: 46,
        visibleBottom: 174
    },
    club: {
        size: 42,
        x: 42,
        y: 91
    },

    nation: {
        width: 50,
        x: 38,
        y: 132
    },

    name: {
    x: 113.5,
    y: 192
    },

stats: {
    row1Y: 220,
    row2Y: 246,
    row3Y: 272
},

chemistry: {
    textY: 309,
    iconX: 70,
    iconY: 291
},
},

halloween: {
    template: path.join(__dirname, '..', '..', 'fifa17-halloween-template.png'),
    textColor: '#171717',
    ratingPositionColor: '#F58213',
    statsColor: '#F58213',
    chemistryColor: '#171717',

    playerImage: {
        height: 132,
        x: 86,
        y: 53,
        visibleBottom: 174
    },

    club: {
        size: 44,
        x: 44,
        y: 96
    },

    nation: {
        width: 50,
        x: 41,
        y: 142
    },

    rating: {
        x: 44.5,
        y: 72,
        size: 36
    },

    position: {
        x: 65.5,
        y: 91,
        size: 22
    },

    name: {
        x: 113.5,
        y: 197,
        size: 23
    },

    stats: {
        row1Y: 220,
        row2Y: 246,
        row3Y: 272
    },

    chemistry: {
        textX: 119,
        textY: 306,
        iconX: 61,
        iconY: 288
    },

    cardSize: {
        width: 220,
        height: 346
    },

    condensedText: {},
},

movember: {
    template: path.join(__dirname, '..', '..', 'fifa17-movember-template.png'),
    textColor: '#4A2B19',
    chemistryColor: '#4A2B19',
    statsColor: '#C9BEA5',

    playerImage: {
        height: 130,
        x: 92,
        y: 46,
        visibleBottom: 174
    },

    club: {
        size: 44,
        x: 44,
        y: 96
    },

    nation: {
        width: 50,
        x: 41,
        y: 142
    },

    rating: {
        x: 44.5,
        y: 72,
        size: 36
    },

    position: {
        x: 65.5,
        y: 91,
        size: 22
    },

    name: {
        x: 113.5,
        y: 197,
        size: 23
    },

    stats: {
        row1Y: 223,
        row2Y: 244,
        row3Y: 265,
        valuesize: 18,
        namesize: 17,

        leftValueX: 31,
        leftNameX: 56,

        rightValueX: 127,
        rightNameX: 152,

        valueSize: 18,
        nameSize: 17
    },

    chemistry: {
        textX: 119,
        textY: 306,
        iconX: 61,
        iconY: 288
    },

    cardSize: {
        width: 220,
        height: 346
    },
},
}

function getFifa17CardStyle(color) {
    const normalizedColor = String(color || '')
        .trim()
        .toLowerCase()

    const style = FIFA17_CARD_STYLES[normalizedColor]

    if (!style) {
        throw new Error(
            `No existe un estilo FIFA 17 configurado para color="${normalizedColor}"`
        )
    }

    return {
        color: normalizedColor,
        ...style
    }
}

function hasFifa17CardStyle(color) {
    const normalizedColor = String(color || '')
        .trim()
        .toLowerCase()

    return Boolean(FIFA17_CARD_STYLES[normalizedColor])
}

module.exports = {
    FIFA17_CARD_STYLES,
    getFifa17CardStyle,
    hasFifa17CardStyle
}