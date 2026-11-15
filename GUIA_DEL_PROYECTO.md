# Guía del proyecto ViandasSemana: dónde está cada cosa

Cómo usarla: buscá primero **qué te piden** en la sección 1, y después abrí el archivo y buscá la palabra clave de la sección 8 (Ctrl+Shift+F en VS Code).

---

## 1. Si te piden… entrá a…

| Si te piden… | Archivos, en orden | Ojo con |
| --- | --- | --- |
| Agregar un campo al **registro** (ej. teléfono) | `frontend/src/pantallas/Acceso.tsx` → `backend/src/routes/auth.ts` (`esquemaRegistro` y `prisma.usuario.create`) → `backend/prisma/schema.prisma` (modelo `Usuario`) + migración nueva | El front manda todo el formulario junto: alcanza con sumar el `<input name="...">` |
| Agregar un campo al **login** | `Acceso.tsx` (el input y el objeto `login`) → `auth.ts` (`esquemaLogin` y la ruta `/login`) | El front arma `login` con sólo email y password: hay que sumar el campo a mano |
| Cambiar el mensaje de error del login | `backend/src/routes/auth.ts` (`Email o contraseña incorrectos`) | El 403 genérico se escribe en `frontend/src/api/cliente.ts` |
| Cambiar textos, botones o pestañas del ingreso | `frontend/src/pantallas/Acceso.tsx` | |
| Cambiar la regla de la contraseña | `auth.ts` (`esquemaPassword`) y `Acceso.tsx` (`minLength` y el texto «Al menos 8 caracteres») | Los dos lados |
| Cambiar cuánto dura la sesión | `auth.ts` (`expiresIn: '8h'` en `/login`) | |
| Cambiar el código de recuperación (vigencia, intentos, espera) | `auth.ts` (`MINUTOS_VALIDEZ_CODIGO`, `MAX_INTENTOS_CODIGO`, `SEGUNDOS_ENTRE_CODIGOS`) · `frontend/src/pantallas/Recuperar.tsx` · `backend/src/lib/mailer.ts` | El texto del correo está en `auth.ts`, en la llamada a `enviarCorreo` |
| Agregar un campo a un **menú** (ej. calorías) | `schema.prisma` (`MenuDia`) + migración → `backend/src/routes/menus.ts` (`esquemaMenu`) → `frontend/src/pantallas/Menus.tsx` (`FormularioMenu` y la tarjeta) → `frontend/src/tipos.ts` (`Menu`) | `FormularioMenu` y la lista están en el mismo archivo |
| Cambiar hora de corte, cupo o cómo se cuentan | `backend/src/domain/reglasPedido.ts` · valores iniciales del formulario en `Menus.tsx` | La regla vive en el backend; el front sólo muestra `abierto` y `disponibles` |
| Agregar un campo a un **pedido** (ej. aclaraciones) | `schema.prisma` (`Pedido`) + migración → `backend/src/routes/pedidos.ts` (`esquemaPedido` y el `POST /`) → `Menus.tsx` (función `reservar`) → `Pedidos.tsx` (para mostrarlo) → `tipos.ts` (`Pedido`) | |
| Cambiar cuándo se puede cancelar | `reglasPedido.ts` (`validarCancelacion`) · `pedidos.ts` (`cancelable` en el `GET /`) · `Pedidos.tsx` (el botón) | |
| Cambiar el plazo para pagar | `reglasPedido.ts` (`MINUTOS_PARA_PAGAR` y `vencimientoDelPago`) · `backend/src/lib/pagos.ts` (`vencerReservasImpagas`) | |
| Tocar Mercado Pago | `backend/src/lib/mercadoPago.ts` · `backend/src/routes/pagos.ts` · `backend/src/lib/pagos.ts` · `backend/src/config/env.ts` | Las claves van en variables de entorno, nunca en el código |
| Agregar una columna a la tabla de usuarios del administrador | `backend/src/routes/usuarios.ts` (`seleccion`) · `frontend/src/pantallas/Usuarios.tsx` | |
| Cambiar quién puede hacer qué | `backend/src/middleware/auth.ts` (`exigirRol`) y el `exigirRol('...')` de cada ruta · `frontend/src/App.tsx` (qué ve cada rol) | Hay que proteger en el backend; ocultar un botón no alcanza |
| Agregar una pantalla o pestaña | Archivo nuevo en `frontend/src/pantallas/` · `App.tsx` (estado `pestana`, botones y render) | |
| Agregar un endpoint nuevo | Archivo nuevo en `backend/src/routes/` · `backend/src/app.ts` (un `app.use`) · llamarlo desde el front con `pedirApi` | |
| Cambiar colores o diseño | `frontend/src/estilos.css` | |
| Cambiar formato de fecha o precio | `frontend/src/tipos.ts` (`formatearFecha`, `formatearPrecio`, `hoy`) | |
| Cambiar la URL del backend o el CORS | `frontend/.env.example` (`VITE_API_URL`) · `backend/src/config/env.ts` (`CORS_ORIGIN`) | |

---

## 2. Recorrido de un dato (de la pantalla a la base)

1. El usuario completa un formulario en una pantalla (`frontend/src/pantallas/*.tsx`). Cada `<input name="...">` es un campo.
2. La pantalla llama a `pedirApi` o `enviar` (`frontend/src/api/cliente.ts`), que hace el `fetch`.
3. `backend/src/app.ts` manda la ruta (`/api/auth`, `/api/menus`…) al router de `backend/src/routes/`.
4. El router valida lo que llegó con un esquema de **zod** (`esquemaRegistro`, `esquemaMenu`, `esquemaPedido`…).
5. Prisma lee o guarda en la base según `backend/prisma/schema.prisma`.
6. La respuesta vuelve al front. Las formas de los datos están en `frontend/src/tipos.ts` y en `cliente.ts` (`Sesion`).

Regla práctica: un campo nuevo que se guarda toca el formulario (1), el esquema de zod (4) y el modelo de Prisma (5) más una migración. Si además se muestra, suma `tipos.ts` y la pantalla que lo muestra.

---

## 3. Frontend (`frontend/`)

### Archivos sueltos
| Archivo | Qué tiene |
| --- | --- |
| `index.html` | Página base donde se monta React |
| `vite.config.ts`, `tsconfig.json` | Configuración de Vite y TypeScript |
| `.env.example` | Variable `VITE_API_URL` (URL del backend) |
| `public/logo.svg` | Logo |
| `package.json` | Scripts: `npm run dev` (desarrollo), `npm run build` |

### `frontend/src/`
| Archivo | Qué tiene |
| --- | --- |
| `main.tsx` | Arranca React |
| `App.tsx` | Barra superior, pestañas, avisos, y decide qué ve cada rol (ADMINISTRADOR ve `Usuarios`; COCINERO y CLIENTE ven Menús y Pedidos; sin sesión ve `Acceso`). Funciones: `avisar`, `ingresar`, `salir`, `volverDeMercadoPago` |
| `api/cliente.ts` | Único archivo que habla con el backend. `pedirApi` (hace el fetch y agrega el token), `enviar` (atajo para POST, PUT, PATCH), `ErrorApi`, `leerSesion`, `guardarSesion` (guarda la sesión en localStorage), `cuandoVenzaLaSesion` (si hay un 401 vuelve al login) |
| `tipos.ts` | Formas de los datos (`Menu`, `Pedido`) y formateo: `formatearFecha`, `hoy`, `formatearPrecio` |
| `estilos.css` | Todo el CSS |
| `vite-env.d.ts` | Tipos de Vite (no se toca) |

### `frontend/src/pantallas/`
| Archivo | Qué es | Qué tiene adentro |
| --- | --- | --- |
| `Acceso.tsx` | Ingreso, registro y acceso a recuperar contraseña | Estado `modo` (`login`, `registro`, `recuperar`) y `enviarFormulario`. **Los formularios de ingreso y registro están en este archivo** |
| `Recuperar.tsx` | Recuperar contraseña en 3 pasos | Pide email → verifica código → cambia contraseña |
| `Menus.tsx` | Menús de la semana. El cliente reserva; el cocinero crea, edita y borra | `reservar`, `guardar`, `borrar`, `FormularioMenu` (**formulario del menú**) y `achicarImagen` (achica la foto antes de enviarla) |
| `Pedidos.tsx` | «Mis pedidos» (cliente) o «Pedidos a cocinar» (cocinero) | `cancelar`, `pagar` y el componente `Estado` |
| `Usuarios.tsx` | Pantalla del administrador | Lista usuarios y `cambiarRol` (CLIENTE ↔ COCINERO). Define su propio tipo `Usuario` |

---

## 4. Backend (`backend/`)

### `backend/src/`
| Archivo | Qué tiene |
| --- | --- |
| `server.ts` | Arranque en local (`npm run dev`): levanta el servidor |
| `app.ts` | Arma Express: seguridad, CORS, lectura de JSON y **monta cada router en su ruta**. Agregar un router nuevo se hace acá |
| `config/env.ts` | Lee todas las variables de entorno. Si falta `DATABASE_URL` o `JWT_SECRET`, el servidor no arranca |
| `middleware/auth.ts` | `autenticar` (valida el token) y `exigirRol` (deja pasar sólo a ciertos roles) |
| `middleware/errorHandler.ts` | `noEncontrado` (404) y `manejadorErrores` (traduce errores a respuestas) |
| `domain/reglasPedido.ts` | Reglas de negocio puras: `instanteDeCorte`, `yaPasoElCorte`, `cuposDisponibles`, `validarNuevoPedido`, `validarCancelacion`, `MINUTOS_PARA_PAGAR`, `vencimientoDelPago`, `estadoDelPago` |
| `lib/prisma.ts` | Conexión a la base |
| `lib/errors.ts` | `HttpError`: un error con código HTTP (400, 401, 403, 404, 409) |
| `lib/logger.ts` | Logs en JSON |
| `lib/mailer.ts` | `enviarCorreo` (Nodemailer por SMTP) |
| `lib/mercadoPago.ts` | Conexión con la API de Mercado Pago: `crearPreferencia`, `obtenerPago`, `devolverPago` |
| `lib/pagos.ts` | `OCUPAN_CUPO` (qué estados ocupan lugar), `vencerReservasImpagas`, `procesarPago` |

### `backend/src/routes/` (los endpoints)
| Método y ruta | Quién puede | Archivo |
| --- | --- | --- |
| `POST /api/auth/registro` | Cualquiera | `auth.ts` |
| `POST /api/auth/login` | Cualquiera | `auth.ts` |
| `POST /api/auth/logout`, `GET /api/auth/yo` | Con sesión | `auth.ts` |
| `POST /api/auth/recuperar`, `/recuperar/verificar`, `/recuperar/cambiar` | Cualquiera | `auth.ts` |
| `GET /api/menus`, `GET /api/menus/:id` | Con sesión | `menus.ts` |
| `POST /api/menus`, `PUT /api/menus/:id`, `DELETE /api/menus/:id` | COCINERO | `menus.ts` |
| `GET /api/pedidos` | Con sesión (el cocinero ve todos, el cliente los suyos) | `pedidos.ts` |
| `POST /api/pedidos`, `POST /api/pedidos/:id/pagar`, `PATCH /api/pedidos/:id/cancelar` | CLIENTE | `pedidos.ts` |
| `POST /api/pagos/notificacion` | Sin autenticación (el estado real se consulta a Mercado Pago) | `pagos.ts` |
| `GET /api/usuarios`, `PATCH /api/usuarios/:id/rol` | ADMINISTRADOR | `usuarios.ts` |
| `GET /api/health` | Cualquiera (para comprobar que la API está viva) | `health.ts` |

### Base de datos (`backend/prisma/`)
| Archivo | Qué es |
| --- | --- |
| `schema.prisma` | Las tablas: `Rol`, `Usuario`, `CodigoRecuperacion`, `MenuDia`, `Pedido`, `Pago` y los estados (`EstadoPedido`, `EstadoPago`). Es la fuente de verdad del DER |
| `migrations/…_inicial` | Primeras tablas |
| `migrations/…_recuperacion_y_pagos` | Agrega códigos de recuperación y pagos |
| `migrations/…_rol_administrador` | Agrega el rol administrador (la cuenta `admin` inicial sale de esta migración) |
| `migrations/…_imagen_menu` | Agrega la foto del menú |

Cuando cambiás `schema.prisma` se genera una migración nueva con `npx prisma migrate dev --name algo` (en la carpeta `backend`).

### Tests (`backend/tests/`)
| Archivo | Qué prueba |
| --- | --- |
| `unit/reglasPedido.test.ts` | Las reglas de negocio (corte, cupos, cancelación, plazo de pago) |
| `unit/mailer.test.ts` | El envío de correo |
| `integration/auth.test.ts` | Registro, login, logout, 401 y 403 |
| `integration/recuperacion.test.ts` | Recuperación de contraseña |
| `integration/menus.test.ts` | API de menús |
| `integration/pedidos.test.ts` | API de pedidos |
| `integration/pagos.test.ts` | Reserva y pago con Mercado Pago |
| `integration/usuarios.test.ts` | Cuenta admin y cambio de roles |
| `integration/health.test.ts` | Health y manejo de errores |
| `integration/ayudantes.ts` | Funciones de apoyo para los tests |

Se corren con `npm test` dentro de `backend`. La cobertura mínima es 65 %.

---

## 5. Raíz del repositorio

| Archivo | Qué es |
| --- | --- |
| `README.md` | Presentación, URLs de producción, arquitectura, cómo levantarlo en local |
| `docker-compose.yml` | Dos bases locales: desarrollo (puerto 5432) y tests (5433) |
| `.github/workflows/ci-cd.yml` | Pipeline: corre los tests con cada push a `main` y, si pasan, despliega |
| `docs/` | Documentación del TP |
| `backend/.env.example` | Variables del backend: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`, `SMTP_*`, `MAIL_FROM`, `MP_ACCESS_TOKEN`, `FRONTEND_URL`, `API_URL` |

---

## 6. Roles

| Rol | Qué ve y puede hacer |
| --- | --- |
| `CLIENTE` | Ve menús, reserva, paga, cancela y ve sus pedidos |
| `COCINERO` | Crea, edita y borra menús; ve todos los pedidos |
| `ADMINISTRADOR` | Sólo ve la pantalla de usuarios y asigna el rol COCINERO |

Todo usuario nuevo nace CLIENTE. Los permisos reales se controlan en el backend con `exigirRol`; el front sólo decide qué mostrar.

---

## 7. Para levantar el proyecto en local

```
docker compose up -d                 # bases locales (carpeta raíz)
cd backend  && npm install && npx prisma migrate dev && npm run dev
cd frontend && npm install && npm run dev
```

El backend queda en `http://localhost:3000` y el front en `http://localhost:5173`.

---

## 8. Palabras clave para buscar

| Buscás… | Escribí en el buscador |
| --- | --- |
| Un formulario | `<form` · `onSubmit` · `name="` |
| Qué valida el backend | `z.object` · `esquema` |
| Qué endpoints existen | `Router.get` · `Router.post` · `app.use('/api` |
| Una llamada del front al backend | `pedirApi` · `enviar(` · `/api/` |
| Quién puede entrar a una ruta | `exigirRol` |
| Un mensaje de error | El texto que ves en pantalla, tal cual |
| Una columna de la base | `model ` en `schema.prisma` |
| Una variable de entorno | `process.env` · `env.` |
