module.exports = {
    name: 'groups',
    aliases: ['grupos'],
    description: 'Muestra los grupos donde está KennyBot',
    category: 'owner',
    cooldown: 5,

    async execute({ sock, from, settings }) {
        const groups =
            await sock.groupFetchAllParticipating()

        const entries =
            Object.entries(groups)

        if (!entries.length) {
            await sock.sendMessage(
                from,
                {
                    text: 'KennyBot no encontró grupos.'
                }
            )
            return
        }

        const text = entries
            .map(
                ([jid, group], index) =>
                    `${index + 1}. ${group.subject}\n${jid}`
            )
            .join('\n\n')

        await sock.sendMessage(
            from,
            {
                text:
                    `📋 *GRUPOS DE KENNYBOT*\n\n${text}`
            }
        )
    }
}