# ViandasSemana — Visión general

**Integrantes:** Segundo Enriquez Gatti · Roman Oberlander — 6.° 1.ª, E.T. N.° 21

## 1. El problema

Una persona que vende viandas caseras recibe los pedidos por mensajes. Cuando aumentan los clientes,
los pedidos se acumulan, cuesta organizarlos y se pueden aceptar más viandas de las que se pueden
cocinar en el día. Además, el cobro queda librado a la confianza: hay reservas que nunca se pagan.

## 2. La solución

ViandasSemana es un sistema web donde quien cocina publica el menú de cada día con un **cupo máximo**,
un **horario de corte** y un **precio**, y los clientes reservan y pagan sus viandas con **Mercado
Pago**. El sistema no deja pedir más de lo que hay, ni pedir o cancelar después del horario de corte, y
sólo cuenta como reserva confirmada la que está pagada. Quien cocina ve en todo momento cuántas viandas
tiene que preparar cada día.

## 3. Actores

| Actor | Tipo | Qué hace |
|---|---|---|
| Visitante | humano | Crea su cuenta |
| Cliente | humano (rol `CLIENTE`) | Consulta menús, reserva y paga, consulta y cancela sus pedidos |
| Cocinero | humano (rol `COCINERO`) | Carga, modifica y borra menús; consulta las viandas a cocinar |
| Mercado Pago | sistema externo | Cobra, avisa los pagos (webhook) y hace devoluciones |
| Servicio de correo (SMTP de Gmail) | sistema externo | Entrega los códigos para recuperar la contraseña |
| Plataforma de logs (Render Logs) | sistema externo | Guarda los eventos para consultar qué pasó en producción |

"Usuario" es la generalización de Cliente y Cocinero (lo que pueden hacer los dos: iniciar y cerrar
sesión, recuperar la contraseña y consultar menús).

## 4. Módulos

El sistema está dividido en cinco módulos. Cada uno tiene su propio documento con casos de uso,
plantillas, DFD de nivel 2, datos, endpoints, reglas, pantallas, tests y una guía de "dónde tocar".

| Módulo | Proceso del DFD | Casos de uso | Backend | Frontend | Tablas |
|---|---|---|---|---|---|
| [1. Acceso](modulos/modulo-1-acceso.md) | 1 Gestionar acceso | CU-01 a CU-04 | `routes/auth.ts`, `middleware/auth.ts`, `lib/mailer.ts` | `Acceso.tsx`, `Recuperar.tsx` | `Rol`, `Usuario`, `CodigoRecuperacion` |
| [2. Menús](modulos/modulo-2-menus.md) | 2 Gestionar menús | CU-05 a CU-08 | `routes/menus.ts` | `Menus.tsx` | `MenuDia` |
| [3. Pedidos](modulos/modulo-3-pedidos.md) | 3 Gestionar pedidos | CU-09 a CU-12 | `routes/pedidos.ts`, `domain/reglasPedido.ts` | `Menus.tsx`, `Pedidos.tsx` | `Pedido` |
| [4. Pagos](modulos/modulo-4-pagos.md) | 4 Procesar pagos | CU-13 a CU-17 | `routes/pagos.ts`, `lib/pagos.ts`, `lib/mercadoPago.ts` | `App.tsx`, `Pedidos.tsx` | `Pago` |
| [5. Plataforma](modulos/modulo-5-plataforma.md) | 5 Registrar eventos | (transversal) | `app.ts`, `middleware/errorHandler.ts`, `lib/logger.ts`, `config/env.ts` | `api/cliente.ts` | — |

## 5. Reglas de negocio

| N.º | Regla | Dónde se controla |
|---|---|---|
| RN-1 | No se puede pedir más viandas que el cupo disponible del día | `validarNuevoPedido` + bloqueo `FOR UPDATE` (módulo 3) |
| RN-2 | No se puede pedir después del horario de corte (hora de Argentina) | `validarNuevoPedido` (módulo 3) |
| RN-3 | No se puede cancelar después del horario de corte | `validarCancelacion` (módulo 3) |
| RN-4 | Sólo el cocinero carga, modifica y borra menús y ve todos los pedidos; el cliente sólo ve y cancela los suyos | `exigirRol` y filtros por usuario (módulos 1 y 3) |
| RN-5 | Una reserva se paga completa y sólo queda confirmada cuando Mercado Pago aprueba el pago por el monto exacto | `procesarPago` (módulo 4) |
| RN-6 | Una reserva sin pagar ocupa cupo hasta 30 minutos (nunca después del corte); luego se cancela sola | `vencimientoDelPago`, `vencerReservasImpagas` (módulo 4) |
| RN-7 | Cancelar una reserva pagada devuelve el dinero; un pago no esperado también se devuelve | `devolverPago` (módulos 3 y 4) |
| RN-8 | Un menú por fecha; un menú con pedidos no se borra | `routes/menus.ts` (módulo 2) |

## 6. Mapa de la documentación

| Documento | Sección de la consigna |
|---|---|
| [Visión general](1-vision-general.md) (este documento) | 2 — Propuesta (actualizada) |
| [Diagramas de flujo de datos](2-dfd.md) | 4.1, 4.2 y 4.3 |
| [Casos de uso](3-casos-de-uso.md) | 4.4 |
| [Modelo de datos (DER)](4-der.md) | 4.5 |
| [Arquitectura y despliegue](5-arquitectura-despliegue.md) | 4.6 |
| [Decisiones técnicas y uso de IA](6-decisiones-tecnicas.md) | 4.7 y 8 |
| [Módulos 1 a 5](modulos/) | Detalle por módulo (plantillas de todos los casos de uso, DFD nivel 2, API, tests) |
