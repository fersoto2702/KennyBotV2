const { pool } = require('../mysql')


async function getEquippedMemberCard(memberId) {

    const [rows] = await pool.execute(
        `
        SELECT *
        FROM kb_member_cards
        WHERE member_id = ?
          AND equipped = TRUE
          AND enabled = TRUE
        ORDER BY obtained_at DESC, id DESC
        LIMIT 1
        `,
        [memberId]
    )

    return rows[0] || null
}


async function getMemberCards(memberId) {

    const [rows] = await pool.execute(
        `
        SELECT *
        FROM kb_member_cards
        WHERE member_id = ?
          AND enabled = TRUE
        ORDER BY obtained_at DESC, id DESC
        `,
        [memberId]
    )

    return rows
}


async function ensureInitialGoldCard(memberId) {

    const conn = await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [members] = await conn.execute(
            `
            SELECT
                id,
                user_jid,
                display_name,
                member_type
            FROM kb_members
            WHERE id = ?
            FOR UPDATE
            `,
            [memberId]
        )


        if (members.length === 0) {

            throw new Error(
                `No existe member_id ${memberId}`
            )

        }


        const member = members[0]

        if (member.member_type !== 'MEMBER') {

            await conn.commit()

            return null
        }

        const [existing] = await conn.execute(
            `
            SELECT *
            FROM kb_member_cards
            WHERE member_id = ?
              AND family = 'PLAYER'
              AND promo_code = 'GOLD_RARE'
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE
            `,
            [memberId]
        )


        if (existing.length > 0) {

            const [equippedCards] = await conn.execute(
                `
                SELECT id
                FROM kb_member_cards
                WHERE member_id = ?
                  AND equipped = TRUE
                  AND enabled = TRUE
                LIMIT 1
                `,
                [memberId]
            )


            if (equippedCards.length === 0) {

                await conn.execute(
                    `
                    UPDATE kb_member_cards
                    SET equipped = TRUE
                    WHERE id = ?
                    `,
                    [existing[0].id]
                )

                existing[0].equipped = 1
            }


            await conn.commit()

            return existing[0]
        }

        const cardKey =
            `member:${memberId}:gold_rare:initial`


        const rating = 75

        const baseStat = 75

        await conn.execute(
            `
            UPDATE kb_member_cards
            SET equipped = FALSE
            WHERE member_id = ?
              AND equipped = TRUE
            `,
            [memberId]
        )


        const [result] = await conn.execute(
            `
            INSERT INTO kb_member_cards (
                member_id,
                card_key,
                family,
                promo_code,
                card_name,
                rating,

                msg_stat,
                act_stat,
                cmd_stat,
                rac_stat,
                ant_stat,
                int_stat,

                obtained_reason,
                equipped,
                enabled
            )
            VALUES (
                ?,
                ?,
                'PLAYER',
                'GOLD_RARE',
                'Gold Rare',
                ?,

                ?,
                ?,
                ?,
                ?,
                ?,
                ?,

                'Carta inicial de miembro',
                TRUE,
                TRUE
            )
            `,
            [
                memberId,
                cardKey,
                rating,

                baseStat,
                baseStat,
                baseStat,
                baseStat,
                baseStat,
                baseStat
            ]
        )


        const [cards] = await conn.execute(
            `
            SELECT *
            FROM kb_member_cards
            WHERE id = ?
            LIMIT 1
            `,
            [result.insertId]
        )


        await conn.commit()

        return cards[0]


    } catch (error) {

        await conn.rollback()

        throw error

    } finally {

        conn.release()

    }
}

async function getMemberCardById(memberId, cardId) {

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            member_id,
            card_key,
            family,
            promo_code,
            subpromo,
            design_variant,
            game_code,
            card_name,
            rating,

            msg_stat,
            act_stat,
            cmd_stat,
            rac_stat,
            ant_stat,
            int_stat,

            image_path,
            obtained_reason,
            obtained_at,
            equipped,
            enabled

        FROM kb_member_cards

        WHERE id = ?
          AND member_id = ?
          AND enabled = 1

        LIMIT 1
        `,
        [
            cardId,
            memberId
        ]
    )

    return rows[0] || null
}

async function equipMemberCard(memberId, cardId) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        /*
         * Bloquear al miembro para serializar
         * cualquier cambio de carta equipada.
         */
        const [members] =
            await conn.execute(
                `
                SELECT id
                FROM kb_members
                WHERE id = ?
                FOR UPDATE
                `,
                [memberId]
            )

        if (!members.length) {

            await conn.rollback()

            return {
                success: false,
                reason: 'MEMBER_NOT_FOUND'
            }
        }


        /*
         * Verificar que la carta exista,
         * esté habilitada y pertenezca al usuario.
         */
        const [cards] =
            await conn.execute(
                `
                SELECT
                    id,
                    card_name,
                    rating,
                    family,
                    promo_code,
                    equipped
                FROM kb_member_cards
                WHERE id = ?
                  AND member_id = ?
                  AND enabled = 1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    cardId,
                    memberId
                ]
            )


        if (!cards.length) {

            await conn.rollback()

            return {
                success: false,
                reason: 'CARD_NOT_FOUND'
            }
        }


        const card =
            cards[0]


        /*
         * Si ya está equipada no hacemos
         * escrituras innecesarias.
         */
        if (Number(card.equipped) === 1) {

            await conn.commit()

            return {
                success: true,
                changed: false,
                reason: 'ALREADY_EQUIPPED',
                card
            }
        }


        /*
         * Desequipar cualquier carta activa.
         */
        await conn.execute(
            `
            UPDATE kb_member_cards
            SET equipped = 0
            WHERE member_id = ?
              AND equipped = 1
            `,
            [memberId]
        )


        /*
         * Equipar la seleccionada.
         */
        await conn.execute(
            `
            UPDATE kb_member_cards
            SET equipped = 1
            WHERE id = ?
              AND member_id = ?
            `,
            [
                cardId,
                memberId
            ]
        )


        await conn.commit()


        return {
            success: true,
            changed: true,
            reason: 'EQUIPPED',
            card: {
                ...card,
                equipped: 1
            }
        }


    } catch (error) {

        try {
            await conn.rollback()
        } catch (_) {}

        throw error

    } finally {

        conn.release()

    }
}

module.exports = {
    getEquippedMemberCard,
    getMemberCards,
    getMemberCardById,
    ensureInitialGoldCard,
    equipMemberCard
}