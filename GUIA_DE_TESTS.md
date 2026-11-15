# Guía de tests de ViandasSemana: dónde está cada cosa

Los tests están sólo en el backend: `backend/tests/`. El frontend no tiene tests.
Esta guía complementa a `GUIA_DEL_PROYECTO.md`.

---

## 1. Cómo se corren

Todos los comandos se ejecutan dentro de la carpeta `backend`.

| Qué querés | Comando |
| --- | --- |
| Correr **todos** los tests y ver la cobertura | `npm test` |
| Correr **un solo archivo** | `npx vitest run tests/unit/reglasPedido.test.ts` |
| Correr **un solo test** por su nombre | `npx vitest run -t "nombre del test"` |

Antes de los tests de integración hace falta tener la base de pruebas levantada:

```
docker compose up -d                  # desde la raíz del repo (levanta db en 5432 y db_test en 5433)
cd backend
DATABASE_URL=postgresql://viandas:viandas@localhost:5433/viandas_test npx prisma migrate deploy   # sólo la primera vez
npm test
```

Los tests **nunca** usan la base de desarrollo ni la de producción: la URL está fijada en `backend/vitest.config.ts`.

---

## 2. Dos tipos de tests

| | Unitarios | De integración |
| --- | --- | --- |
| Carpeta | `backend/tests/unit/` | `backend/tests/integration/` |
| Qué prueban | Una función aislada | Una petición HTTP completa: ruta, validación, base de datos y respuesta |
| ¿Usan base de datos? | No | Sí (la de pruebas) |
| ¿Cómo se ven? | `expect(funcion(datos)).toBe(resultado)` | `request(app).post('/api/...').send(datos)` y se mira `res.status` y `res.body` |
| Velocidad | Milisegundos | Más lentos |

---

## 3. Cómo es un test (ejemplo real de `auth.test.ts`)

```ts
describe('POST /api/auth/login', () => {                       // grupo: de qué se trata
  it('devuelve 401 con contraseña incorrecta', async () => {   // un caso, en una frase
    await request(app).post('/api/auth/registro').send(datos); // 1. preparar: crear el usuario
    const res = await request(app)                             // 2. actuar: llamar a la API
      .post('/api/auth/login')
      .send({ email: datos.email, password: 'otra-clave' });
    expect(res.status).toBe(401);                              // 3. comprobar el resultado
  });
});
```

- `describe(...)` agrupa los tests de un tema.
- `it(...)` es un caso. Si lo dejás vacío no prueba nada.
- `expect(...).toBe(...)` es la comprobación. Si no se cumple, el test falla.
- `beforeEach` se ejecuta antes de cada test (acá limpia la base) y `afterAll` al final (cierra la conexión).
- `request(app)` viene de la librería **supertest**: llama a la API sin levantar un servidor.

---

## 4. Si te piden cambiar un test de…

| Tema | Archivo | Qué hay adentro |
| --- | --- | --- |
| Reglas de corte, cupos, cancelación o plazo de pago | `tests/unit/reglasPedido.test.ts` | Un `describe` por función: `instanteDeCorte`, `yaPasoElCorte`, `cuposDisponibles`, `validarNuevoPedido`, `validarCancelacion`, `vencimientoDelPago`, `estadoDelPago` |
| Registro, login, logout, 401 y 403 | `tests/integration/auth.test.ts` | Registro (201, 400, 409), login (token, 401), endpoints protegidos, control por rol, logout |
| Recuperar contraseña | `tests/integration/recuperacion.test.ts` | Flujo completo, email inexistente, código incorrecto con bloqueo a los 5 intentos, código vencido, código nuevo y espera de 1 minuto, 503 si falla el correo |
| Menús | `tests/integration/menus.test.ts` | Crear, listar, editar, borrar, foto del plato, 409 por fecha repetida o pedidos asociados, 400, 404, 401, 403 |
| Pedidos | `tests/integration/pedidos.test.ts` | Crear, cupo completo (409), fuera de horario (409), pedidos simultáneos, ver pedidos según rol, cancelar |
| Pagos y Mercado Pago | `tests/integration/pagos.test.ts` | Reserva pendiente, confirmación al aprobarse, rechazos, monto distinto, devoluciones, vencimiento de reservas sin pagar |
| Usuarios y roles | `tests/integration/usuarios.test.ts` | Cuenta `admin`, listado, cambio de rol a COCINERO y de vuelta a CLIENTE |
| Health, CORS y errores generales | `tests/integration/health.test.ts` | `/api/health`, CORS, 404 en ruta inexistente, 400 con JSON mal formado |
| Envío de correo | `tests/unit/mailer.test.ts` | Sin SMTP configurado responde 503 |

---

## 5. Si cambiás el código, qué test se rompe o hay que actualizar

| Cambiaste… | Revisá este test |
| --- | --- |
| Un campo del registro (`esquemaRegistro` en `routes/auth.ts`) | `auth.test.ts`: el objeto `datos` del principio y el caso «devuelve 400 con datos inválidos» |
| El largo mínimo de la contraseña | `auth.test.ts` y `recuperacion.test.ts` (casos de contraseña inválida) |
| El mensaje o el código de un error | El test que mira `res.status` o `res.body` de esa ruta |
| El corte horario, el cupo o el plazo de pago (`reglasPedido.ts`) | `tests/unit/reglasPedido.test.ts` |
| Cuántos intentos o cuánto dura el código de recuperación (`routes/auth.ts`) | `recuperacion.test.ts` |
| Qué rol puede usar una ruta (`exigirRol`) | Los casos «403» de ese archivo (`menus`, `pedidos`, `usuarios`, `auth`) |
| Un campo de un menú (`esquemaMenu` en `routes/menus.ts`) | `menus.test.ts` |
| Un campo de un pedido (`esquemaPedido` en `routes/pedidos.ts`) | `pedidos.test.ts` |
| Cómo se paga o se devuelve (`lib/mercadoPago.ts`, `lib/pagos.ts`, `routes/pagos.ts`) | `pagos.test.ts` y el simulador de `ayudantes.ts` |
| La contraseña o el nombre del `admin` inicial (migración) | `usuarios.test.ts` |
| La configuración de CORS (`app.ts`) | `health.test.ts` |
| Una columna de la base (`schema.prisma`) | `limpiarBase()` en `ayudantes.ts` si la tabla es nueva, y los tests que crean esos datos |

---

## 6. Archivos de apoyo

### `tests/integration/ayudantes.ts` (funciones compartidas)

| Función | Para qué sirve |
| --- | --- |
| `limpiarBase()` | Vacía las tablas antes de cada test (no borra roles ni la cuenta `admin`). Si agregás una tabla nueva, hay que sumarla acá |
| `crearUsuario(rol, email?)` | Crea un usuario con el rol que le pidas y devuelve su encabezado `Authorization` listo para usar. Ejemplo: `const { auth } = await crearUsuario('COCINERO')` |
| `simularMercadoPago()` | Reemplaza `fetch` por una Mercado Pago falsa (los tests no salen a internet). Devuelve `pagar(pedidoId, estado?)` para simular un pago, `preferencias`, `devoluciones` y `estado.fallarPreferencia` para simular una falla |

### `backend/vitest.config.ts` (configuración de los tests)

| Quiero cambiar… | Dónde dentro del archivo |
| --- | --- |
| La base que usan los tests | `env.DATABASE_URL` |
| Las claves falsas de los tests | `env` (`JWT_SECRET`, `MP_ACCESS_TOKEN`, `FRONTEND_URL`) |
| Qué archivos se consideran tests | `include: ['tests/**/*.test.ts']` |
| El mínimo de cobertura (hoy 65 %) | `coverage.thresholds.lines` |
| Qué archivos no cuentan para la cobertura | `coverage.exclude` (hoy `src/server.ts` y `src/config/**`) |
| Si los archivos corren de a uno | `fileParallelism: false` (de a uno, porque comparten la base) |

El pipeline (`.github/workflows/ci-cd.yml`) corre estos mismos tests en cada push a `main`. Si falla un test o la cobertura baja del 65 %, no se despliega.

---

## 7. Todos los casos que existen hoy

**`unit/reglasPedido.test.ts`**: un `describe` por función (`instanteDeCorte`, `yaPasoElCorte`, `cuposDisponibles`, `validarNuevoPedido`, `validarCancelacion`, `vencimientoDelPago`, `estadoDelPago`). Usa fechas fijas de un menú del lunes 12/10/2026 con corte a las 10:00 hora Argentina.

**`unit/mailer.test.ts`**
- sin SMTP configurado responde 503 en vez de fallar en silencio

**`integration/auth.test.ts`**
- registro: crea un CLIENTE (201) con la contraseña hasheada · 400 con datos inválidos · 409 si el email ya existe
- login: devuelve un token con credenciales correctas · 401 con contraseña incorrecta
- endpoints protegidos (401) y control por rol (403)
- logout

**`integration/recuperacion.test.ts`**
- flujo completo (pide código, verifica, cambia la contraseña) · mismo mensaje si el email no existe y no manda correo · código incorrecto y bloqueo tras 5 intentos · código vencido · un código nuevo invalida el anterior y no se manda otro antes de un minuto · valida la contraseña nueva (400) · 503 si no se puede mandar el correo

**`integration/menus.test.ts`**
- POST crea (201) · GET lista y GET `/:id` · PUT modifica · foto del plato (guarda, conserva al editar, quita con `null`) · rechaza imagen inválida o pesada (400) · DELETE elimina · no borra un menú con pedidos (409) · no permite dos menús en la misma fecha (409) · 400 con datos inválidos · 404 si no existe · 401 sin token · 403 si es cliente

**`integration/pedidos.test.ts`**
- POST crea un pedido pendiente de pago (201) · supera el cupo (409 `CUPO_COMPLETO`) · después del corte (409 `FUERA_DE_HORARIO`) · pedidos simultáneos no superan el cupo · 400 y 404 · 403 si el cocinero intenta pedir · el cliente ve los suyos y el cocinero todos · total de viandas a preparar · PATCH cancela y libera el cupo · no cancela dos veces ni un pedido ajeno · no cancela después del corte

**`integration/pagos.test.ts`**
- reserva pendiente con el 100 % del pago · se confirma sólo cuando Mercado Pago aprueba · pago rechazado y reintento · pago cancelado o pendiente · aviso con datos en la URL · 404 y 400 · monto distinto devuelve el dinero · pago de una reserva cancelada devuelve el dinero · cancelar una reserva pagada devuelve el dinero · devolución hecha desde Mercado Pago cancela la reserva · reserva sin pagar vence y libera el cupo · no paga un pedido ajeno ni uno ya pagado · si Mercado Pago falla, se cancela y se libera el cupo · no reserva un menú sin precio

**`integration/usuarios.test.ts`**
- cuenta `admin` (ingresa con `admin` / `admin`, rechaza contraseña incorrecta) · el administrador lista usuarios sin contraseñas · cliente y cocinero reciben 403 · cambia el rol a COCINERO y lo revierte · no permite el rol ADMINISTRADOR ni uno inexistente · no cambia el rol de un administrador · 404 y 403

**`integration/health.test.ts`**
- `/api/health` responde 200 · CORS permitido y no permitido · 404 en ruta inexistente · 400 (no 500) con JSON mal formado

---

## 8. Receta: agregar un test nuevo

1. Elegí el archivo según el tema (sección 4). Si no hay uno, creá `tests/integration/algo.test.ts`: el nombre tiene que terminar en `.test.ts` o no se ejecuta.
2. Copiá un `it(...)` parecido del mismo archivo y cambiale el nombre y los datos.
3. Preparar: usá `crearUsuario('CLIENTE')` y los `await request(app)...` que haga falta.
4. Actuar: `await request(app).post('/api/...').set('Authorization', auth).send({...})`.
5. Comprobar: `expect(res.status).toBe(...)` y, si hace falta, `expect(res.body.campo).toBe(...)`.
6. Corrélo solo: `npx vitest run tests/integration/menus.test.ts`. Después corré `npm test` completo.

Si el test falla y no entendés por qué, mirá primero que la base de pruebas esté levantada (`docker compose up -d`) y que `npx prisma migrate deploy` ya se haya corrido.

---

## 9. Palabras clave para buscar

| Buscás… | Escribí en el buscador |
| --- | --- |
| Todos los tests de un tema | `describe(` |
| Un caso concreto | `it('` más una palabra del caso |
| Dónde se prueba un código de estado | `toBe(409)`, `toBe(403)`… |
| Quién usa un helper | `crearUsuario` · `limpiarBase` · `simularMercadoPago` |
| Dónde se reemplaza algo por uno falso | `vi.mock` · `vi.stubGlobal` |
