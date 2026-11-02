# Documentación — ViandasSemana

Toda la documentación está en Word (`.docx`, para editar) con su copia en PDF, separada por módulos.
Cada diagrama está en su propio archivo.

## Documentos

| Documento | Contenido |
|---|---|
| [ViandasSemana](ViandasSemana.docx) ([pdf](ViandasSemana.pdf)) | Documento principal: el problema y la solución, metodología de trabajo, análisis de viabilidad, análisis de riesgos, alcance y roadmap |
| [Diseño técnico](ViandasSemana-Diseno-Tecnico.docx) ([pdf](ViandasSemana-Diseno-Tecnico.pdf)) | Consigna, sección 4: DFD niveles 0, 1 y 2 con la tabla de consistencia, casos de uso, DER y diccionario de datos, arquitectura y despliegue, decisiones técnicas y declaración de uso de IA |
| [Propuesta original](Propuesta-original.docx) ([pdf](Propuesta-original.pdf)) | Consigna, sección 2 |

## Módulos

Cada módulo tiene una descripción, el diagrama de casos de uso, la plantilla de **cada** caso de uso y
el funcionamiento técnico (stack, permisos, flujo, tablas, endpoints, DFD nivel 2, reglas, archivos y tests).

| Módulo | Casos de uso | Proceso del DFD |
|---|---|---|
| [1. Autenticación](modulos/Modulo-1-Autenticacion.docx) ([pdf](modulos/Modulo-1-Autenticacion.pdf)) | CU-01 a CU-04 | 1 Gestionar acceso |
| [2. Menús](modulos/Modulo-2-Menus.docx) ([pdf](modulos/Modulo-2-Menus.pdf)) | CU-05 a CU-08 | 2 Gestionar menús |
| [3. Pedidos](modulos/Modulo-3-Pedidos.docx) ([pdf](modulos/Modulo-3-Pedidos.pdf)) | CU-09 a CU-12 | 3 Gestionar pedidos |
| [4. Pagos](modulos/Modulo-4-Pagos.docx) ([pdf](modulos/Modulo-4-Pagos.pdf)) | CU-13 a CU-17 | 4 Procesar pagos |
| [5. Plataforma](modulos/Modulo-5-Plataforma.docx) ([pdf](modulos/Modulo-5-Plataforma.pdf)) | transversal | 5 Registrar eventos |

## Diagramas

En [`diagramas/`](diagramas/) cada diagrama tiene dos archivos:

- **`.drawio`**: editable. Se abre en [draw.io](https://app.diagrams.net) o se importa en Lucidchart
  con *File → Import → draw.io*.
- **`.pdf`**: una lámina A3 para imprimir.

| Diagrama | Archivo |
|---|---|
| DFD nivel 0 (contexto) | `dfd-0-contexto` |
| DFD nivel 1 | `dfd-1` |
| DFD nivel 2 de los procesos 1 a 4 | `dfd-2-acceso`, `dfd-2-menus`, `dfd-2-pedidos`, `dfd-2-pagos` |
| Casos de uso: general y uno por módulo | `cu-general`, `cu-1-autenticacion`, `cu-2-menus`, `cu-3-pedidos`, `cu-4-pagos` |
| DER | `der` |
| Arquitectura y despliegue; ambiente local y de producción | `arquitectura`, `ambientes` |
| Estados del pedido y del pago; secuencia de una reserva con su pago | `estados-pedido-pago`, `secuencia-reserva-pago` |

## Cómo regenerarlo

Los textos de los Word están en [`herramientas/word/`](herramientas/word/) (un archivo por documento) y
las fuentes de los diagramas en [`herramientas/fuentes/`](herramientas/fuentes/) (Graphviz y PlantUML).
Después de cambiar algo:

```bash
bash docs/generar.sh
```

Necesita Java, Graphviz, Python 3, LibreOffice y Node con `docx` y `playwright`
(`npm i -g docx playwright && npx playwright install chromium`). La primera vez descarga PlantUML.

Ojo: `generar.sh` vuelve a crear los `.drawio` desde las fuentes, así que pisa los cambios hechos a mano
en draw.io o Lucidchart. Un cambio que tenga que quedar en los Word se hace en la fuente.
