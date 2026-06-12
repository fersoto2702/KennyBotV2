const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { getAllStats } = require('../../src/database/mysql')

const iconPath = path.join(__dirname, '../../assets/icons/msgstats.jpeg')
const tempPath = path.join(__dirname, '../../temp')

module.exports = {

    name: 'exportstats',
    aliases: ['excelstats', 'statsexcel'],
    description: 'Exporta estadísticas a Excel',
    category: 'general',
    adminOnly: true,
    cooldown: 30,

    async execute({ sock, from, args }) {

        try {

            if (!from.endsWith('@g.us'))
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('SOLO GRUPOS', 'Este comando solo funciona en grupos.')
                })

            const days = parseInt(args[0]) || 30

            if (days < 1 || days > 365)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('DÍAS INVÁLIDOS', 'Usa un número entre 1 y 365.\nEjemplo: /exportstats 30')
                })

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.info('EXPORTANDO', [
                    ['Período', `📅 Últimos ${days} días`],
                    ['Estado', '⏳ Generando Excel...']
                ])
            })

            const stats = await getAllStats(from, days)

            if (!stats || stats.length === 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('SIN DATOS', `No hay estadísticas de los últimos ${days} días.`)
                })

            if (!fs.existsSync(tempPath))
                fs.mkdirSync(tempPath, { recursive: true })

            const workbook = new ExcelJS.Workbook()
            const sheet = workbook.addWorksheet('Estadísticas')

            sheet.columns = [
                { header: '#', key: 'rank', width: 6 },
                { header: 'Usuario', key: 'usuario', width: 30 },
                { header: 'Mensajes', key: 'total', width: 15 },
                { header: 'Último mensaje', key: 'ultimo', width: 25 },
                { header: 'Primer registro', key: 'primera', width: 25 }
            ]

            sheet.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } }
                cell.alignment = { horizontal: 'center' }
            })

            stats.forEach((u, i) => {
                const ultimoDate = u.ultimo ? new Date(Number(u.ultimo)).toLocaleString('es-MX') : 'Sin datos'
                const primeraDate = u.primera_fecha || 'Sin datos'

                const row = sheet.addRow({
                    rank: i + 1,
                    usuario: u.usuario.split('@')[0],
                    total: Number(u.total),
                    ultimo: ultimoDate,
                    primera: primeraDate
                })

                if (i % 2 === 0) {
                    row.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
                    })
                }
            })

            const groupName = from.split('@')[0]
            const fileName = `stats_${groupName}_${days}dias_${Date.now()}.xlsx`
            const filePath = path.join(tempPath, fileName)

            await workbook.xlsx.writeFile(filePath)

            await sock.sendMessage(from, {
                document: fs.readFileSync(filePath),
                fileName,
                mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                caption: ui.success('EXCEL GENERADO', [
                    ['Período', `📅 Últimos ${days} días`],
                    ['Usuarios', `👥 ${stats.length}`],
                    ['Archivo', `📊 ${fileName}`]
                ])
            })

            fs.unlinkSync(filePath)

            logger.event(`ExportStats: ${from.split('@')[0]} → ${stats.length} usuarios`)

        } catch (err) {
            logger.error(`ExportStats Error: ${err.message}`)
            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.error('ERROR', 'No se pudo generar el Excel.')
            })
        }

    }

}