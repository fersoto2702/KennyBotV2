/*
 * Alertas del panel.
 *
 * Vigila los perfiles de WhatsApp (main, brazil…). Si uno se desconecta
 * más de `graceSec` segundos, avisa por Telegram y/o por WhatsApp. Cuando
 * vuelve, avisa que se recuperó.
 *
 * IMPORTANTE: si el proceso completo del bot se cae, esta API cae con él y
 * no puede avisar. Para eso existe tools/watchdog.js, que corre aparte.
 *
 * Configuración (.env):
 *     ALERT_TELEGRAM_TOKEN=123456:ABC...   (lo da @BotFather)
 *     ALERT_TELEGRAM_CHAT=123456789        (tu chat id)
 *     ALERT_WA_NUMBER=5216621234567        (tu número, con lada, solo dígitos)
 */

function createAlerts({
    getProfiles,
    notifyWhatsApp,
    telegramToken,
    telegramChat,
    waNumber,
    graceSec = 60,
    getMute = null,
    onAlert = () => {},
    logger = console
}) {
    const state = new Map()


    const status = () => ({
        telegram: Boolean(telegramToken && telegramChat),
        whatsapp: Boolean(waNumber && notifyWhatsApp),
        graceSec
    })


    async function sendTelegram(text) {
        if (!telegramToken || !telegramChat) {
            return { channel: 'telegram', ok: false, reason: 'no configurado' }
        }

        try {
            const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramChat, text }),
                signal: AbortSignal.timeout(10000)
            })

            return { channel: 'telegram', ok: res.ok, reason: res.ok ? null : `HTTP ${res.status}` }
        } catch (err) {
            return { channel: 'telegram', ok: false, reason: err.message }
        }
    }


    async function sendWhatsApp(text, exclude) {
        if (!waNumber || !notifyWhatsApp) {
            return { channel: 'whatsapp', ok: false, reason: 'no configurado' }
        }

        try {
            const sent = await notifyWhatsApp(waNumber, text, { exclude })

            return { channel: 'whatsapp', ok: Boolean(sent), reason: sent ? null : 'ningún perfil conectado para enviarlo' }
        } catch (err) {
            return { channel: 'whatsapp', ok: false, reason: err.message }
        }
    }


    async function send(text, { exclude } = {}) {
        const results = await Promise.all([ sendTelegram(text), sendWhatsApp(text, exclude) ])

        onAlert({ text, results })

        return results
    }


    async function check() {
        let profiles = []

        try {
            profiles = (await getProfiles?.()) || []
        } catch (err) {
            logger.error?.(`Alertas: no pude leer los perfiles: ${err.message}`)

            return
        }

        for (const p of profiles) {
            const s = state.get(p.id) || { downSince: null, alerted: false }

            if (p.connected) {
                /* Conectado pero mudo: recibe comandos y no contesta. */
                const mute = getMute ? getMute(p.id) : { muted: false }

                if (mute.muted && !s.muteAlerted) {
                    s.muteAlerted = true

                    const mins = Math.max(1, Math.round((Date.now() - mute.since) / 60000))

                    send(`🔇 El perfil "${p.name}" está conectado pero no contesta: ${mute.waiting} comandos llevan ${mins} min sin respuesta.`)
                } else if (!mute.muted && s.muteAlerted) {
                    s.muteAlerted = false

                    send(`🔊 El perfil "${p.name}" volvió a responder.`)
                }

                if (s.alerted) {
                    const secs = Math.round((Date.now() - s.downSince) / 1000)

                    send(`✅ El perfil "${p.name}" volvió a conectarse (estuvo ${secs} s fuera).`)
                }

                state.set(p.id, { downSince: null, alerted: false, muteAlerted: s.muteAlerted })

                continue
            }

            if (!s.downSince) {
                s.downSince = Date.now()
            }

            if (!s.alerted && Date.now() - s.downSince >= graceSec * 1000) {
                s.alerted = true

                send(`⚠️ El perfil "${p.name}" lleva más de ${graceSec} s desconectado.`, { exclude: p.id })
            }

            state.set(p.id, s)
        }
    }


    const timer = setInterval(check, 15000)

    timer.unref()


    return {
        status,
        send,
        check,
        test: () => send('🔔 Prueba de alertas del panel de KennyBot: todo funciona.')
    }
}


module.exports = createAlerts