const mysql = require('mysql2/promise')
const logger = require('../utils/logger')

const config = {
    host: 'localhost',
    user: 'root',
    password: 'fersoto27',
    database: 'kennybotdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}

const pool = mysql.createPool(config)

async function initDB() {

    try {

        const conn = await pool.getConnection()

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS mensajes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grupo VARCHAR(255) NOT NULL,
                usuario VARCHAR(255) NOT NULL,
                cantidad INT DEFAULT 1,
                fecha DATE NOT NULL,
                ultimo_mensaje BIGINT NOT NULL,
                INDEX idx_grupo (grupo),
                INDEX idx_usuario (usuario),
                INDEX idx_fecha (fecha)
            )
        `)

        conn.release()

        logger.success('MySQL conectado y tabla lista')

    } catch (err) {
        logger.error(`MySQL init error: ${err.message}`)
    }

}

async function registerMessage(grupo, usuario) {

    try {

        const today = new Date().toISOString().split('T')[0]
        const now = Date.now()

        await pool.execute(`
            INSERT INTO mensajes (grupo, usuario, cantidad, fecha, ultimo_mensaje)
            VALUES (?, ?, 1, ?, ?)
            ON DUPLICATE KEY UPDATE
                cantidad = cantidad + 1,
                ultimo_mensaje = ?
        `, [grupo, usuario, today, now, now])

    } catch (err) {
        logger.error(`MySQL registerMessage: ${err.message}`)
    }

}

async function getTopMessages(grupo, days = 7, limit = 10) {

    try {

        const [rows] = await pool.execute(`
            SELECT
                usuario,
                SUM(cantidad) as total,
                MAX(ultimo_mensaje) as ultimo
            FROM mensajes
            WHERE grupo = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY usuario
            ORDER BY total DESC
            LIMIT ?
        `, [grupo, days, limit])

        return rows

    } catch (err) {
        logger.error(`MySQL getTopMessages: ${err.message}`)
        return []
    }

}

async function getInactive(grupo, days = 7, limit = 10) {

    try {

        const [rows] = await pool.execute(`
            SELECT
                usuario,
                SUM(cantidad) as total,
                MAX(ultimo_mensaje) as ultimo
            FROM mensajes
            WHERE grupo = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY usuario
            ORDER BY total ASC
            LIMIT ?
        `, [grupo, days, limit])

        return rows

    } catch (err) {
        logger.error(`MySQL getInactive: ${err.message}`)
        return []
    }

}

async function getUserStats(grupo, usuario, days = 7) {

    try {

        const [rows] = await pool.execute(`
            SELECT
                SUM(cantidad) as total,
                MAX(ultimo_mensaje) as ultimo
            FROM mensajes
            WHERE grupo = ?
            AND usuario = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [grupo, usuario, days])

        const [ranking] = await pool.execute(`
            SELECT usuario, SUM(cantidad) as total
            FROM mensajes
            WHERE grupo = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY usuario
            ORDER BY total DESC
        `, [grupo, days])

        const position = ranking.findIndex(r => r.usuario === usuario) + 1

        return {
            total: rows[0]?.total || 0,
            ultimo: rows[0]?.ultimo || null,
            position
        }

    } catch (err) {
        logger.error(`MySQL getUserStats: ${err.message}`)
        return { total: 0, ultimo: null, position: 0 }
    }

}

async function getAllStats(grupo, days = 30) {

    try {

        const [rows] = await pool.execute(`
            SELECT
                usuario,
                SUM(cantidad) as total,
                MAX(ultimo_mensaje) as ultimo,
                MIN(fecha) as primera_fecha
            FROM mensajes
            WHERE grupo = ?
            AND fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY usuario
            ORDER BY total DESC
        `, [grupo, days])

        return rows

    } catch (err) {
        logger.error(`MySQL getAllStats: ${err.message}`)
        return []
    }

}

module.exports = {
    pool,
    initDB,
    registerMessage,
    getTopMessages,
    getInactive,
    getUserStats,
    getAllStats
}