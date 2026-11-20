/*
 * Vigilante externo de KennyBot.
 *
 * Corre APARTE del bot (otro proceso) y pregunta cada 30 s si la API del
 * panel responde. Si falla 2 veces seguidas avisa por Telegram; cuando el
 * bot vuelve, avisa también. Opcionalmente puede intentar reiniciarlo.
 *
 *     node tools/watchdog.js
 *     pm2 start tools/watchdog.js --name KennyWatchdog
 *
 * .env:
 *     ALERT_TELEGRAM_TOKEN=...
 *     ALERT_TELEGRAM_CHAT=...
 *     WATCHDOG_URL=http://127.0.0.1:4000/health      (opcional)
 *     WATCHDOG_RESTART_CMD=pm2 restart KennyBot      (opcional)
 *     WATCHDOG_START_CMD=pm2 start index.js --name KennyBot   (opcional)
 *
 * Control desde el celular (Telegram, solo tu chat):
 *     /estado      dice si el bot responde
 *     /iniciar     lo enciende si está apagado
 *     /reiniciar   lo reinicia
 */

const { exec } = require('child_process')

try { require('dotenv').config() } catch {}


const URL_HEALTH = process.env.WATCHDOG_URL || 'http://127.0.0.1:4000/health'
const TOKEN = process.env.ALERT_TELEGRAM_TOKEN
const CHAT = process.env.ALERT_TELEGRAM_CHAT
const RESTART = process.env.WATCHDOG_RESTART_CMD
const START = process.env.WATCHDOG_START_CMD || RESTART

let fails = 0
let down = false
let downAt = 0


async function telegram(text) {
    console.log(text)

    if (!TOKEN || !CHAT) {
        return
    }

    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT, text }),
            signal: AbortSignal.timeout(10000)
        })
    } catch (err) {
        console.error('No pude avisar por Telegram:', err.message)
    }
}


async function isUp() {
    try {
        const res = await fetch(URL_HEALTH, { signal: AbortSignal.timeout(8000) })

        return res.ok
    } catch {
        return false
    }
}


function run(cmd) {
    return new Promise(done => {
        exec(cmd, { timeout: 60000 }, err => done(err ? err.message : null))
    })
}


async function onCommand(text) {
    const cmd = text.trim().split(/[\s@]/)[0].toLowerCase()

    if (cmd === '/estado' || cmd === '/start') {
        return telegram((await isUp()) ? '✅ KennyBot responde.' : '🔴 KennyBot NO responde. Usa /iniciar.')
    }

    if (cmd === '/iniciar' || cmd === '/reiniciar') {
        const command = cmd === '/iniciar' ? START : RESTART

        if (!command) {
            return telegram('No hay comando configurado. Pon WATCHDOG_START_CMD / WATCHDOG_RESTART_CMD en tu .env.')
        }

        if (cmd === '/iniciar' && await isUp()) {
            return telegram('El bot ya está encendido. Si quieres reiniciarlo usa /reiniciar.')
        }

        await telegram(`⏳ Ejecutando: ${command}`)

        const err = await run(command)

        if (err) {
            return telegram(`❌ Falló: ${err.slice(0, 300)}`)
        }

        await new Promise(r => setTimeout(r, 15000))

        return telegram((await isUp()) ? '✅ Listo, el bot ya responde.' : '⚠️ El comando corrió pero el bot aún no responde. Prueba /estado en un minuto.')
    }

    if (cmd.startsWith('/')) {
        return telegram('Comandos: /estado, /iniciar, /reiniciar')
    }
}


/* Escucha tus mensajes de Telegram. Solo obedece al chat configurado. */
async function listen() {
    if (!TOKEN || !CHAT) {
        return
    }

    let offset = 0

    for (;;) {
        try {
            const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=25&offset=${offset}`, {
                signal: AbortSignal.timeout(35000)
            })

            const data = await res.json()

            for (const update of data.result || []) {
                offset = update.update_id + 1

                const msg = update.message

                if (msg?.text && String(msg.chat?.id) === String(CHAT) && String(msg.from?.id) === String(CHAT)) {
                    await onCommand(msg.text)
                }
            }
        } catch {
            await new Promise(r => setTimeout(r, 5000))
        }
    }
}


async function tick() {
    let ok = false

    try {
        const res = await fetch(URL_HEALTH, { signal: AbortSignal.timeout(8000) })

        ok = res.ok
    } catch {}

    if (ok) {
        fails = 0

        if (down) {
            down = false

            await telegram(`✅ KennyBot volvió a responder (estuvo caído ${Math.round((Date.now() - downAt) / 1000)} s).`)
        }

        return
    }

    fails++

    if (fails >= 2 && !down) {
        down = true
        downAt = Date.now()

        await telegram('🚨 KennyBot no responde. Revisa tu PC o servidor.')

        if (RESTART) {
            await telegram(`Intentando reiniciar con: ${RESTART}`)

            exec(RESTART, err => err && console.error('Falló el reinicio:', err.message))
        }
    }
}


console.log(`Vigilando ${URL_HEALTH} cada 30 s…`)

tick()

setInterval(tick, 30000)

listen()
