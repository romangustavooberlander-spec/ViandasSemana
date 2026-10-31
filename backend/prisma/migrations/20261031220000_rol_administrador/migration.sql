-- Rol ADMINISTRADOR: asigna o quita el rol COCINERO desde la página, sin entrar a la base.
INSERT INTO "Rol" ("nombre") VALUES ('ADMINISTRADOR') ON CONFLICT ("nombre") DO NOTHING;

-- Cuenta de administrador inicial. Se ingresa con usuario "admin" y contraseña "admin"
-- (se guarda sólo el hash bcrypt de "admin"). CAMBIAR la contraseña en producción.
INSERT INTO "Usuario" ("email", "nombre", "passwordHash", "rolId")
SELECT 'admin', 'Administrador', '$2a$10$BzW.YPuRm/f.105EU4MQ3OaALJRcbDyp2JzxnepW2pDoVfhHAD5MK', "id"
FROM "Rol" WHERE "nombre" = 'ADMINISTRADOR'
ON CONFLICT ("email") DO NOTHING;
