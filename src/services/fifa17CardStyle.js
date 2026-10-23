const path = require('path')

const FIFA17_CARD_STYLES = {
    toty: {
    template: path.join(
        __dirname,
        '..',
        '..',
        'wefut-fifa17-gold5.png'
    ),
    textColor: '#D1E6FE',
    chemistryColor: '#D1E6FE',

    playerImage: {
        height: 129,
        x: 90,
        y: 46,
        visibleBottom: 174
    },

    club: {
        size: 41,
        x: 43,
        y: 96
    },

    nation: {
        width: 54,
        x: 37,
        y: 137
    },

    chemistry: {
        textX: 119,
        textY: 306,
        iconX: 61,
        iconY: 288
    },

    condensedText: {
        rating: {
            x: 63.6,
            y: 69.1,
            size: 34
        },

        position: {
            x: 64.4,
            y: 89,
            size: 21.2
        },

        name: {
            x: 113.8,
            y: 196.9,
            size: 23.5,
            weight: 'bold',
            letterSpacing: 0.3
        },

        stats: {
            valueCenterX: [49.7, 141.6],
            labelX: [67.1, 160],
            rowsY: [227.3, 252.4, 277.5],
            valueSize: 22.9,
            labelSize: 22.9
        }
    },
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
        height: 133,
        x: 81,
        y: 41,
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
    },

    club: {
        size: 41,
        x: 45,
        y: 94
    },

    nation: {
        width: 55,
        x: 39,
        y: 135
    },

    chemistry: {
        textX: 125,
        textY: 311.5,
        iconX: 63,
        iconY: 292
    },

    condensedText: {
        rating: {
            x: 66.1,
            y: 65.8,
            size: 36.5
        },

        position: {
            x: 66,
            y: 84,
            size: 20.6
        },

        name: {
            x: 114.8,
            y: 197.3,
            size: 22.5,
            weight: 'bold',
            letterSpacing: 0.1
        },

        stats: {
            valueCenterX: [47.2, 149.9],
            labelX: [62.3, 164.8],
            rowsY: [224.6, 251, 277.4],
            valueSize: 22.6,
            labelSize: 22.6
        },

        chemistry: {
            x: 125,
            y: 311.5,
            size: 22
        }
    },
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
        height: 142,
        x: 78,
        y: 34,
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
    },

    club: {
        size: 41,
        x: 37,
        y: 98
    },

    nation: {
        width: 36,
        x: 42,
        y: 143
    },

    chemistry: {
        textX: 125,
        textY: 311.5,
        iconX: 63,
        iconY: 292
    },

    condensedText: {
        rating: {
            x: 59.6,
            y: 66.1,
            size: 35
        },

        position: {
            x: 58.5,
            y: 88.3,
            size: 24
        },

        name: {
            x: 113,
            y: 196.9,
            size: 23,
            weight: 'wide',
            letterSpacing: 1.05
        },

        stats: {
            valueCenterX: [55.5, 139.8],
            labelX: [74.5, 158.9],
            rowsY: [224, 251.2, 277.1],
            valueSize: 22,
            labelSize: 22
        },

        chemistry: {
            x: 125,
            y: 311.5,
            size: 22
        }
    },
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

    condensedText: {
        name: {
            x: 113.5,
            y: 196.4,
            size: 20.6,
            weight: 'bold',
            letterSpacing: -0.6
        }
    },
},

movember: {
    template: path.join(__dirname, '..', '..', 'fifa17-movember-template.png'),
    textColor: '#3D2415',
    chemistryColor: '#3D2415',
    statsColor: '#C9BEA5',

    playerImage: {
        height: 138,
        x: 76,
        y: 43,
        visibleBottom: 174
    },

    club: {
        size: 38,
        x: 40,
        y: 105
    },

    nation: {
        width: 35,
        x: 44,
        y: 148
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

    condensedText: {
        rating: {
            x: 61,
            y: 75.7,
            size: 31.3
        },

        position: {
            x: 61,
            y: 97,
            size: 23.7
        },

        name: {
            x: 112,
            y: 196.5,
            size: 21.8,
            weight: 'wide',
            letterSpacing: 0.4
        },

        statsBlock: {
            top: 202,
            bottom: 277
        }
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