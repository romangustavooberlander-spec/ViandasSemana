# Documentación — ViandasSemana

Carpeta exigida por la consigna (sección 4). Cada documento está en Markdown (se lee directo en
GitHub) y en PDF dentro de [`pdf/`](pdf/). Para entregar o imprimir todo junto:
**[`pdf/documentacion-completa.pdf`](pdf/documentacion-completa.pdf)** (con portada e índice).

## Documentos generales

| Documento | Consigna | PDF |
|---|---|---|
| [Visión general](1-vision-general.md): problema, actores, módulos, reglas de negocio | 2 | [pdf](pdf/1-vision-general.pdf) |
| [Propuesta original](herramientas/propuesta.docx) | 2 | [pdf](pdf/propuesta.pdf) |
| [Diagramas de flujo de datos](2-dfd.md): Nivel 0, Nivel 1 (con tabla de consistencia) y Nivel 2 de los procesos 1 a 4 | 4.1, 4.2, 4.3 | [pdf](pdf/2-dfd.pdf) |
| [Casos de uso](3-casos-de-uso.md): diagrama general, catálogo, relaciones y narrativa de los 3 principales | 4.4 | [pdf](pdf/3-casos-de-uso.pdf) |
| [Modelo de datos (DER)](4-der.md): diagrama, cardinalidades y diccionario de datos | 4.5 | [pdf](pdf/4-der.pdf) |
| [Arquitectura y despliegue](5-arquitectura-despliegue.md): componentes, protocolos, secretos, pipeline, local vs. producción | 4.6 | [pdf](pdf/5-arquitectura-despliegue.pdf) |
| [Decisiones técnicas](6-decisiones-tecnicas.md) (2 páginas) y declaración de uso de IA | 4.7 y 8 | [pdf](pdf/6-decisiones-tecnicas.pdf) |

## Documentación por módulo

Cada módulo tiene: propósito, archivos del código, diagrama y **plantillas de todos sus casos de uso**,
DFD de nivel 2, tablas, endpoints, reglas y dónde se valida cada una, pantallas, tests y una guía de
"dónde tocar" para agregar un campo, un filtro, una validación o un total.

| Módulo | Casos de uso | Proceso del DFD | PDF |
|---|---|---|---|
| [1. Acceso](modulos/modulo-1-acceso.md) (registro, sesión, roles, recuperación de contraseña) | CU-01 a CU-04 | 1 | [pdf](pdf/modulo-1-acceso.pdf) |
| [2. Menús](modulos/modulo-2-menus.md) | CU-05 a CU-08 | 2 | [pdf](pdf/modulo-2-menus.pdf) |
| [3. Pedidos](modulos/modulo-3-pedidos.md) | CU-09 a CU-12 | 3 | [pdf](pdf/modulo-3-pedidos.pdf) |
| [4. Pagos con Mercado Pago](modulos/modulo-4-pagos.md) | CU-13 a CU-17 | 4 | [pdf](pdf/modulo-4-pagos.pdf) |
| [5. Plataforma](modulos/modulo-5-plataforma.md) (validación, errores, logs, tests, CI/CD) | transversal | 5 | [pdf](pdf/modulo-5-plataforma.pdf) |

## Diagramas

Las imágenes están en [`diagramas/`](diagramas/) (SVG) y sus fuentes, que son texto y se pueden editar,
en [`diagramas/fuentes/`](diagramas/fuentes/): los DFD en Graphviz (`.dot`) y el resto en PlantUML
(`.puml`). Para imprimir cada diagrama grande hay un PDF en hoja A3 por diagrama en
[`pdf/laminas/`](pdf/laminas/).

| Diagrama | Fuente |
|---|---|
| DFD Nivel 0, Nivel 1 y Nivel 2 (procesos 1 a 4) | `dfd-0-contexto.dot`, `dfd-1.dot`, `dfd-2-*.dot` |
| Casos de uso: general y uno por módulo | `cu-general.puml`, `cu-1-acceso.puml` … `cu-4-pagos.puml` |
| DER | `der.puml` (debe coincidir con `backend/prisma/schema.prisma`) |
| Arquitectura y despliegue; ambiente local vs. producción | `arquitectura.puml`, `ambientes.puml` |
| Secuencia de una reserva con su pago | `secuencia-reserva-pago.puml` |
| Estados del pedido y del pago | `estados-pedido-pago.puml` |

## Cómo regenerar los SVG y los PDF

Después de cambiar un `.md` o una fuente de diagrama:

```bash
bash docs/generar.sh
```

Necesita Java, Graphviz (`dot`), pandoc y Node con Playwright
(`npm i -g playwright && npx playwright install chromium`). La primera vez descarga PlantUML en
`docs/herramientas/` (no se sube al repositorio).
