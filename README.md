# ViandasSemana

Sistema web para organizar los pedidos de un emprendimiento de viandas caseras. Quien cocina
carga el menú de cada día con su cupo máximo y su horario de corte; los clientes consultan
los menús y hacen o cancelan sus pedidos respetando esas reglas.

**Integrantes:** Segundo Enriquez Gatti · Roman Oberlander — 6° 1ra, E.T. N° 21

## URLs de producción

| Componente | URL |
|---|---|
| Frontend | https://viandassemana-web.onrender.com |
| Backend (API) | https://viandassemana.onrender.com/api/health |

## Arquitectura

| Componente | Plataforma | Región |
|---|---|---|
| Frontend (sitio estático) | Render Static Site | CDN global |
| Backend (API) | Render Web Service (Free) | Virginia (US East) |
| Base de datos | Neon PostgreSQL (Free) | AWS US East 1 |

> El backend del plan gratuito se suspende tras 15 min sin tráfico; la primera petición tarda ~1 min en despertarlo.

```
frontend/   React + Vite (TypeScript)        → se despliega como sitio estático
backend/    Node + Express + TypeScript       → API REST (JSON)
            Prisma ORM + PostgreSQL remoto    → persistencia
docs/       Documentación del TP (PDF + fuentes de diagramas)
.github/workflows/ci-cd.yml                   → pipeline de CI/CD
```

El frontend se comunica con el backend **sólo por HTTP**; nunca accede a la base de datos.

## Puesta en marcha local (desde cero)

Requisitos: [Node.js 22](https://nodejs.org), [Git](https://git-scm.com) y
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (para la base local).

```bash
# 1. Clonar
git clone <url-del-repo>
cd ViandasSemana

# 2. Levantar las bases locales (desarrollo en :5432, tests en :5433)
docker compose up -d

# 3. Backend
cd backend
cp .env.example .env        # en Windows: copy .env.example .env  → completar JWT_SECRET
npm install
npx prisma migrate dev      # crea las tablas en la base local
npm run dev                 # API en http://localhost:3000/api/health

# 4. Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Tests

```bash
cd backend
DATABASE_URL=postgresql://viandas:viandas@localhost:5433/viandas_test npx prisma migrate deploy  # sólo la primera vez
npm test
```

Un único comando ejecuta los tests **unitarios** (`tests/unit`, reglas de negocio sin base de datos)
y de **integración** (`tests/integration`, petición HTTP completa) y genera el informe de cobertura
en `backend/coverage/index.html`. Si la cobertura de líneas baja del **65 %**, el comando falla.

Los tests de integración usan una base de **pruebas** separada (`db_test`, puerto 5433, fijada en
`vitest.config.ts`); nunca la base de desarrollo ni la productiva.

## Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/registro` | Crea un usuario con rol CLIENTE (201) |
| POST | `/api/auth/login` | Devuelve un JWT (vence a las 8 h) |
| POST | `/api/auth/logout` | Invalida todos los tokens del usuario (204) |
| GET | `/api/auth/yo` | Datos del usuario del token |
| POST | `/api/auth/recuperar` | Manda por correo un código para recuperar la contraseña |
| POST | `/api/auth/recuperar/verificar` | Confirma que el código es válido |
| POST | `/api/auth/recuperar/cambiar` | Cambia la contraseña usando el código |

El token se manda en el encabezado `Authorization: Bearer <token>`. Sin token, con token inválido,
vencido o cerrado con logout la API responde **401**; con un rol sin permiso, **403**.
Los roles (`COCINERO`, `CLIENTE`) están en la tabla `Rol` y los carga la migración inicial.
Todo registro crea un CLIENTE; para que un usuario sea cocinero se le cambia el rol en la base
(por ejemplo con `npx prisma studio`).

Las contraseñas nunca se guardan en texto plano: se guardan con **bcrypt** (registro y recuperación).

### Recuperación de contraseña

1. En "Ingresar", **¿Olvidaste tu contraseña?** pide el email. La respuesta es siempre la misma,
   exista o no la cuenta, para no revelar quién está registrado; el correo sólo se manda si existe.
2. Se genera un código aleatorio de 6 dígitos (`crypto.randomInt`) que vence a los **15 minutos**.
   En la tabla `CodigoRecuperacion` se guarda sólo su HMAC, nunca el código. Pedir un código nuevo
   invalida los anteriores, y no se manda más de uno por minuto.
3. El usuario carga el código; si es válido, elige la contraseña nueva (8 a 72 caracteres, validada con zod).
4. Al cambiarla, el código queda **usado** (un solo uso, también ante pedidos simultáneos), la contraseña
   se guarda con bcrypt y se cierran las sesiones abiertas (`versionToken`).
5. Código incorrecto, vencido o ya usado → **400** con un mensaje claro. Tras 5 intentos fallidos el código se bloquea.

## Reservas y pagos (Mercado Pago)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/pedidos` | Crea la reserva pendiente de pago y devuelve `urlPago` (201) |
| POST | `/api/pedidos/:id/pagar` | Devuelve la URL para pagar (o reintentar) una reserva pendiente |
| PATCH | `/api/pedidos/:id/cancelar` | Cancela; si ya estaba pagada, devuelve el dinero |
| POST | `/api/pagos/notificacion` | Webhook de Mercado Pago (también lo llama el front al volver de pagar) |

Una reserva se paga **completa** con Checkout Pro y sólo queda confirmada cuando Mercado Pago aprueba el pago:

| Reserva (`Pedido.estado`) | Pago (`Pago.estado`) | Qué significa |
|---|---|---|
| `PENDIENTE_PAGO` | `PENDIENTE` / `RECHAZADO` / `CANCELADO` | Falta pagar. Ocupa su lugar en el cupo hasta pagarse o vencer |
| `CONFIRMADO` | `APROBADO` | Pagada: es la que se cocina |
| `CANCELADO` | `CANCELADO` / `DEVUELTO` | Cancelada por el cliente o vencida. Si se había pagado, se devolvió |

- El cliente tiene **30 minutos** para pagar (nunca más allá del horario de corte). Pasado ese plazo la
  reserva se cancela sola y libera el cupo; la preferencia de Mercado Pago también vence.
- El estado del pago **nunca se toma del frontend**: el webhook (y la vuelta del cliente) sólo traen el id
  del pago, y la API lo consulta a `GET /v1/payments/:id` de Mercado Pago. También se controla el monto.
- Si llega un pago aprobado para una reserva cancelada, vencida o con monto distinto, se devuelve automáticamente.
- Los menús tienen `precio` (pesos por vianda). Los menús cargados antes de esta versión quedan con
  precio 0 y no se pueden reservar hasta que el cocinero les ponga precio.
- Los pedidos hechos antes de esta versión quedaron `CONFIRMADO` (sin pago asociado).

## Frontend

| Pantalla | Cliente | Cocinero |
|---|---|---|
| Ingresar / crear cuenta | ✓ | ✓ |
| Menú de la semana | ve cada día con su precio y las viandas que quedan; reserva y paga con Mercado Pago | crea, edita y borra menús (con precio); ve cuántas hay reservadas |
| Pedidos | ve sus pedidos y el estado del pago; paga los pendientes y cancela antes del horario de corte | ve los pedidos pagados de cada día y el total a cocinar |

El token se guarda en `localStorage` y viaja en el encabezado `Authorization`. Ante un **401** el
frontend vuelve al inicio de sesión; ante un **403** avisa que falta permiso. Cada rol sólo ve los
botones que puede usar. El frontend no calcula reglas de negocio: la API devuelve en cada menú si
todavía acepta pedidos (`abierto`) y en cada pedido si se puede cancelar (`cancelable`) o pagar (`pagable`).

El logo (`frontend/public/logo.svg`) es una vianda con los aros de un calendario: las cinco porciones
son los días de lunes a viernes y la verde con el tilde es la vianda reservada.

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Clave para firmar los tokens de sesión |
| `PORT` | Puerto de la API (por defecto 3000) |
| `CORS_ORIGIN` | Orígenes del frontend permitidos, separados por coma |
| `NODE_ENV` | `development` / `test` / `production` |
| `SMTP_HOST` | Servidor SMTP para mandar correos (ej. `smtp.gmail.com`) |
| `SMTP_PORT` | Puerto SMTP: `465` (TLS) o `587` (STARTTLS) |
| `SMTP_USER` / `SMTP_PASS` | Usuario y contraseña del SMTP |
| `MAIL_FROM` | Remitente de los correos (por defecto, `SMTP_USER`) |
| `MP_ACCESS_TOKEN` | Access token privado de Mercado Pago |
| `FRONTEND_URL` | URL del frontend, adonde vuelve el cliente después de pagar |
| `API_URL` | URL pública de la API, para el webhook de Mercado Pago (vacía en local) |

Sin `SMTP_HOST` o sin `MP_ACCESS_TOKEN` la API arranca igual, pero recuperar la contraseña o reservar
responde **503** con un mensaje claro y lo registra en el log.

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API |

En producción estos valores se cargan como **secretos de la plataforma**, nunca en el repositorio.

### Configurar el correo (Mailer)

Cualquier SMTP sirve. Con Gmail: activar la verificación en dos pasos, crear una
[contraseña de aplicación](https://myaccount.google.com/apppasswords) y usar `SMTP_HOST=smtp.gmail.com`,
`SMTP_PORT=465`, `SMTP_USER=<la cuenta>`, `SMTP_PASS=<la contraseña de aplicación>`.
Para probar sin mandar correos reales sirve una casilla de prueba como [Mailtrap](https://mailtrap.io) o
[Ethereal](https://ethereal.email) (copiar el host, puerto, usuario y contraseña SMTP que muestran).

### Configurar Mercado Pago

1. Entrar a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app) → **Crear aplicación**
   (producto: Checkout Pro / pagos online).
2. En **Cuentas de prueba** crear dos usuarios de prueba: un **vendedor** y un **comprador**.
3. Ingresar con el vendedor de prueba, abrir la aplicación y copiar el **Access Token** de credenciales
   de producción de ese usuario de prueba en `MP_ACCESS_TOKEN`. (Con la cuenta real y su access token
   de producción se cobra de verdad.)
4. En producción: `FRONTEND_URL=https://viandassemana-web.onrender.com` y
   `API_URL=https://viandassemana.onrender.com`. La API le pasa a Mercado Pago
   `<API_URL>/api/pagos/notificacion` como URL de notificación en cada preferencia, así que no hace falta
   configurar el webhook en el panel.

### Probar la recuperación de contraseña

1. Configurar el SMTP, levantar backend y frontend, y crear una cuenta con un email al que tengas acceso.
2. En "Ingresar" → **¿Olvidaste tu contraseña?** → poner ese email → llega un correo con el código.
3. Cargar el código → elegir la contraseña nueva → ingresar con ella (la anterior ya no funciona).
4. Casos de error: un código inventado ("incorrecto"), volver a usar el mismo código ("ya no es válido"),
   o esperar 15 minutos ("venció").

### Probar la reserva y el pago

1. Configurar `MP_ACCESS_TOKEN` (vendedor de prueba) y hacer cocinero a un usuario (`npx prisma studio`).
2. El cocinero crea un menú con precio. Un cliente reserva → lo lleva a Mercado Pago por el total.
3. Pagar **con el comprador de prueba**, con una [tarjeta de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
   El nombre del titular decide el resultado: `APRO` aprobado, `OTHE` rechazado, `CONT` pendiente.
4. Al volver, "Mis pedidos" muestra **Pagado** (y el cocinero lo cuenta en el total a cocinar), o
   **Pago rechazado** con el botón para reintentar. En local el estado se consulta al volver; en producción
   también llega por el webhook aunque el cliente cierre la pestaña.
5. Cancelar una reserva pagada devuelve el dinero; una reserva sin pagar se cancela sola a los 30 minutos.

## Pipeline de CI/CD

Cada push a `main` ejecuta: instalar → tests con umbral de cobertura → build → desplegar.
Si cualquier paso falla, no se despliega. Secretos requeridos en GitHub
(Settings → Secrets and variables → Actions): `DEPLOY_HOOK_BACKEND`, `DEPLOY_HOOK_FRONTEND`.

## Flujo de trabajo

- Nadie hace push directo a `main` (rama protegida). Cada cambio va en una rama
  (`feature/login`, `fix/cupo`, …) y entra por Pull Request.
- Cada integrante commitea con su propio usuario de GitHub.
