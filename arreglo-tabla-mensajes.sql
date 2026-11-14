CREATE TABLE mensajes_nueva LIKE mensajes;

ALTER TABLE mensajes_nueva
    ADD UNIQUE KEY uq_grupo_usuario_fecha (grupo, usuario, fecha);

INSERT INTO mensajes_nueva (grupo, usuario, cantidad, fecha, ultimo_mensaje)
SELECT
    grupo,
    usuario,
    SUM(cantidad),
    fecha,
    MAX(ultimo_mensaje)
FROM mensajes
GROUP BY grupo, usuario, fecha;

RENAME TABLE
    mensajes TO mensajes_vieja,
    mensajes_nueva TO mensajes;