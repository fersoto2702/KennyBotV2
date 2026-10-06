const {
    pool
} = require('../mysql')


function validatePositiveInteger(
    value,
    name
) {

    const number =
        Number(value)


    if (
        !Number.isInteger(number) ||
        number <= 0
    ) {

        throw new Error(
            `${name} inválido: ${value}`
        )

    }


    return number

}


/* ─────────────────────────────
   CARTA EQUIPADA
───────────────────────────── */

async function getEquippedMemberCard(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const [rows] =
        await pool.execute(

            `
            SELECT
                *
            FROM kb_member_cards
            WHERE member_id = ?
              AND equipped = 1
              AND enabled = 1
            ORDER BY
                obtained_at DESC,
                id DESC
            LIMIT 1
            `,

            [id]

        )


    return rows?.[0] || null

}


/* ─────────────────────────────
   TODAS LAS CARTAS
───────────────────────────── */

async function getMemberCards(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const [rows] =
        await pool.execute(

            `
            SELECT
                *
            FROM kb_member_cards
            WHERE member_id = ?
              AND enabled = 1
            ORDER BY
                obtained_at DESC,
                id DESC
            `,

            [id]

        )


    return Array.isArray(rows)
        ? rows
        : []

}


/* ─────────────────────────────
   CARTA INICIAL GOLD RARE
───────────────────────────── */

async function ensureInitialGoldCard(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        /*
            Bloqueamos al miembro para que dos
            mensajes simultáneos no creen dos
            cartas iniciales.
        */

        const [members] =
            await conn.execute(

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

                [id]

            )


        if (
            !members.length
        ) {

            throw new Error(
                `No existe member_id ${id}`
            )

        }


        const member =
            members[0]


        /*
            Solamente los miembros normales
            reciben la carta inicial.
        */

        if (
            member.member_type !==
            'MEMBER'
        ) {

            await conn.commit()

            return null

        }


        /* ─────────────────────────────
           BUSCAR GOLD RARE EXISTENTE
        ───────────────────────────── */

        const [existing] =
            await conn.execute(

                `
                SELECT
                    *
                FROM kb_member_cards
                WHERE member_id = ?
                  AND family = 'PLAYER'
                  AND promo_code = 'GOLD_RARE'
                  AND card_key = ?
                LIMIT 1
                FOR UPDATE
                `,

                [
                    id,
                    `member:${id}:gold_rare:initial`
                ]

            )


        if (
            existing.length > 0
        ) {

            const card =
                existing[0]


            /*
                Si por alguna razón la carta
                inicial quedó deshabilitada,
                la reactivamos.
            */

            if (
                Number(card.enabled) !== 1
            ) {

                await conn.execute(

                    `
                    UPDATE kb_member_cards
                    SET
                        enabled = 1
                    WHERE id = ?
                    `,

                    [card.id]

                )


                card.enabled = 1

            }


            /*
                Comprobamos si el usuario ya
                tiene alguna carta equipada.
            */

            const [equippedCards] =
                await conn.execute(

                    `
                    SELECT
                        id
                    FROM kb_member_cards
                    WHERE member_id = ?
                      AND equipped = 1
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,

                    [id]

                )


            /*
                Si no hay ninguna equipada,
                equipamos la Gold Rare inicial.
            */

            if (
                equippedCards.length === 0
            ) {

                await conn.execute(

                    `
                    UPDATE kb_member_cards
                    SET
                        equipped = 1
                    WHERE id = ?
                      AND member_id = ?
                      AND enabled = 1
                    `,

                    [
                        card.id,
                        id
                    ]

                )


                card.equipped = 1

            }


            await conn.commit()


            return card

        }


        /* ─────────────────────────────
           CREAR CARTA INICIAL
        ───────────────────────────── */

        const cardKey =
            `member:${id}:gold_rare:initial`


        const rating =
            75


        const baseStat =
            75


        /*
            Dejamos cualquier otra carta
            desequipada antes de crear
            la inicial equipada.
        */

        await conn.execute(

            `
            UPDATE kb_member_cards
            SET
                equipped = 0
            WHERE member_id = ?
              AND equipped = 1
            `,

            [id]

        )


        const [result] =
            await conn.execute(

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
                    1,
                    1
                )
                `,

                [
                    id,
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


        if (
            !result.insertId
        ) {

            throw new Error(
                'No se pudo crear la carta inicial'
            )

        }


        const [cards] =
            await conn.execute(

                `
                SELECT
                    *
                FROM kb_member_cards
                WHERE id = ?
                  AND member_id = ?
                LIMIT 1
                `,

                [
                    result.insertId,
                    id
                ]

            )


        if (
            !cards.length
        ) {

            throw new Error(
                'La carta inicial fue creada pero no pudo recuperarse'
            )

        }


        await conn.commit()


        return cards[0]


    } catch (error) {

        try {

            await conn.rollback()

        } catch {}


        throw error


    } finally {

        conn.release()

    }

}


/* ─────────────────────────────
   CARTA POR ID
───────────────────────────── */

async function getMemberCardById(
    memberId,
    cardId
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const card =
        validatePositiveInteger(
            cardId,
            'cardId'
        )


    const [rows] =
        await pool.execute(

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
                card,
                member
            ]

        )


    return rows?.[0] || null

}


/* ─────────────────────────────
   EQUIPAR CARTA
───────────────────────────── */

async function equipMemberCard(
    memberId,
    cardId
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const cardIdValue =
        validatePositiveInteger(
            cardId,
            'cardId'
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        /*
            Bloquear al miembro serializa los
            cambios de carta equipada.
        */

        const [members] =
            await conn.execute(

                `
                SELECT
                    id
                FROM kb_members
                WHERE id = ?
                FOR UPDATE
                `,

                [member]

            )


        if (
            !members.length
        ) {

            await conn.rollback()


            return {

                success:
                    false,

                reason:
                    'MEMBER_NOT_FOUND'

            }

        }


        /*
            Verificar que la carta exista,
            pertenezca al miembro y esté activa.
        */

        const [cards] =
            await conn.execute(

                `
                SELECT
                    id,
                    member_id,
                    card_key,
                    card_name,
                    rating,
                    family,
                    promo_code,
                    subpromo,
                    design_variant,
                    game_code,
                    equipped,
                    enabled
                FROM kb_member_cards
                WHERE id = ?
                  AND member_id = ?
                  AND enabled = 1
                LIMIT 1
                FOR UPDATE
                `,

                [
                    cardIdValue,
                    member
                ]

            )


        if (
            !cards.length
        ) {

            await conn.rollback()


            return {

                success:
                    false,

                reason:
                    'CARD_NOT_FOUND'

            }

        }


        const card =
            cards[0]


        /*
            Si ya está equipada no hacemos
            escrituras innecesarias.
        */

        if (
            Number(card.equipped) === 1
        ) {

            await conn.commit()


            return {

                success:
                    true,

                changed:
                    false,

                reason:
                    'ALREADY_EQUIPPED',

                card

            }

        }


        /*
            Desequipar cualquier otra carta.
        */

        await conn.execute(

            `
            UPDATE kb_member_cards
            SET
                equipped = 0
            WHERE member_id = ?
              AND equipped = 1
            `,

            [member]

        )


        /*
            Equipar la seleccionada.
        */

        const [equipResult] =
            await conn.execute(

                `
                UPDATE kb_member_cards
                SET
                    equipped = 1
                WHERE id = ?
                  AND member_id = ?
                  AND enabled = 1
                `,

                [
                    cardIdValue,
                    member
                ]

            )


        if (
            Number(
                equipResult.affectedRows
            ) !== 1
        ) {

            throw new Error(
                `No se pudo equipar card_id ${cardIdValue}`
            )

        }


        await conn.commit()


        return {

            success:
                true,

            changed:
                true,

            reason:
                'EQUIPPED',

            card: {

                ...card,

                equipped:
                    1

            }

        }


    } catch (error) {

        try {

            await conn.rollback()

        } catch {}


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