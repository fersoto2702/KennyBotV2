const ranks = [

    {
        level: 100,
        name: '👑 Rey'
    },

    {
        level: 80,
        name: '💎 Diamante'
    },

    {
        level: 60,
        name: '🏆 Maestro'
    },

    {
        level: 40,
        name: '🥇 Oro'
    },

    {
        level: 25,
        name: '🥈 Plata'
    },

    {
        level: 10,
        name: '🥉 Bronce'
    },

    {
        level: 0,
        name: '🔰 Novato'
    }

]

module.exports = level => {

    const current =
        ranks.find(
            rank => level >= rank.level
        )

    return current?.name || '🔰 Novato'

}