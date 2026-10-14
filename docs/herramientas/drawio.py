#!/usr/bin/env python3
"""Genera los diagramas de ViandasSemana en formato draw.io (.drawio), importable en Lucidchart.
La posición de los nodos la calcula Graphviz (dot -Tjson)."""
import json, re, subprocess, sys, html, os

OUT = sys.argv[1]
FUENTES = sys.argv[2]  # carpeta con los .dot de los DFD

def esc(s):
    return html.escape(s, quote=True)

class Doc:
    def __init__(self, nombre):
        self.nombre, self.celdas, self.n = nombre, [], 2
    def id(self):
        self.n += 1
        return f"c{self.n}"
    def vertex(self, value, style, x, y, w, h, parent="1", id=None):
        id = id or self.id()
        self.celdas.append(f'<mxCell id="{id}" value="{esc(value)}" style="{style}" vertex="1" parent="{parent}">'
                           f'<mxGeometry x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" as="geometry"/></mxCell>')
        return id
    def edge(self, src, dst, value="", style="", puntos=None, parent="1"):
        id = self.id()
        pts = ""
        if puntos:
            pts = '<Array as="points">' + "".join(f'<mxPoint x="{x:.1f}" y="{y:.1f}"/>' for x, y in puntos) + "</Array>"
        self.celdas.append(f'<mxCell id="{id}" value="{esc(value)}" style="html=1;fontSize=10;labelBackgroundColor=#ffffff;{style}" edge="1" parent="{parent}" source="{src}" target="{dst}">'
                           f'<mxGeometry relative="1" as="geometry">{pts}</mxGeometry></mxCell>')
        return id
    def guardar(self, archivo):
        xml = (f'<mxfile host="app.diagrams.net" type="device"><diagram name="{esc(self.nombre)}" id="{archivo}">'
               '<mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">'
               '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(self.celdas) + '</root></mxGraphModel></diagram></mxfile>\n')
        open(os.path.join(OUT, archivo + ".drawio"), "w", encoding="utf-8").write(xml)
        print("  ✓", archivo + ".drawio")

def layout(dot_src):
    r = subprocess.run(["dot", "-Tjson"], input=dot_src.encode(), capture_output=True, check=True)
    return json.loads(r.stdout)

def pos(j):
    alto = float(j["bb"].split(",")[3])
    def p(s):
        x, y = s.split(",")[:2]
        return float(x), alto - float(y)
    return p

def titulo(d, texto, ancho):
    d.vertex(texto, "text;html=1;fontSize=18;fontStyle=1;align=center;verticalAlign=middle;", 0, -60, ancho, 40)

# ---------------------------------------------------------------- estilos
ENTIDAD = "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#2f5d8a;strokeWidth=2;fontStyle=1;"
PROCESO = "rounded=1;arcSize=18;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#b08900;strokeWidth=2;"
PROCESO_OTRO = "rounded=1;arcSize=18;whiteSpace=wrap;html=1;fillColor=#eeeeee;strokeColor=#888888;strokeWidth=2;"
ALMACEN = "shape=partialRectangle;right=0;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#3c7a35;strokeWidth=2;align=left;spacingLeft=8;"
ACTOR = "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#dae8fc;strokeColor=#2f5d8a;"
CASO = "ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#b08900;"
LIMITE = "rounded=0;whiteSpace=wrap;html=1;fillColor=none;verticalAlign=top;align=left;spacingLeft=8;fontStyle=1;strokeColor=#555555;"
NOTA = "shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#fffce8;strokeColor=#999999;align=left;spacingLeft=6;fontSize=11;"

# ---------------------------------------------------------------- DFD (desde los .dot existentes)
def texto_html(lbl):
    lbl = re.sub(r"<BR/>", " ", lbl)
    partes = [t.strip() for t in re.findall(r"<TD[^>]*>(.*?)</TD>", lbl, re.S)]
    return [re.sub(r"<[^>]+>", "", t).strip() for t in partes]

def dfd(archivo, nombre):
    src = open(os.path.join(FUENTES, archivo + ".dot"), encoding="utf-8").read()
    j = layout(src)
    p = pos(j)
    d = Doc(nombre)
    ancho = float(j["bb"].split(",")[2])
    titulo(d, nombre, ancho)
    ids = {}
    for o in j["objects"]:
        if "pos" not in o:
            continue
        x, y = p(o["pos"])
        w, h = float(o["width"]) * 72, float(o["height"]) * 72
        n = o["name"]
        lbl = o.get("label", n)
        if lbl.startswith("<"):
            partes = texto_html(lbl)
            if n.startswith("d"):
                ids[o["_gvid"]] = d.vertex(f"<b>{partes[0]}</b>&nbsp;&nbsp;{partes[1]}", ALMACEN, x - w / 2, y - h / 2, w, h)
            else:
                otro = 'BGCOLOR="#eeeeee"' in lbl
                ids[o["_gvid"]] = d.vertex(f"<b>{partes[0]}</b><hr>{partes[1]}", PROCESO_OTRO if otro else PROCESO, x - w / 2, y - h / 2, w, h)
        else:
            ids[o["_gvid"]] = d.vertex(lbl.replace("\\n", "<br>"), ENTIDAD, x - w / 2, y - h / 2, w, h)
    for e in j["edges"]:
        pts = [p(s) for s in e["pos"].split(" ")[1:]]
        # se usan algunos puntos de control de la curva como quiebres
        quiebres = pts[3:-3:3] if len(pts) > 6 else []
        lbl = e.get("label", "").replace("\\l", "<br>").rstrip("<br>")
        d.edge(ids[e["tail"]], ids[e["head"]], lbl, "endArrow=classic;curved=1;", quiebres)
    d.guardar(archivo)

# ---------------------------------------------------------------- casos de uso
def casos_de_uso(archivo, nombre, actores, paquetes, enlaces, notas=()):
    """actores: [(id, nombre, externo)]; paquetes: [(titulo, [(id, texto)])];
    enlaces: [(a, b, tipo, rotulo)] tipo: asoc | gen | include | extend"""
    lineas = ["digraph G { rankdir=LR; nodesep=0.35; ranksep=1.2; compound=true; node [fontsize=12];"]
    for i, n, _ in actores:
        lineas.append(f'{i} [shape=box, width=1.3, height=1.1, label="{n}"];')
    for k, (t, casos) in enumerate(paquetes):
        lineas.append(f'subgraph cluster_{k} {{ label="{t}"; margin=22;')
        for i, txt in casos:
            lineas.append(f'{i} [shape=ellipse, width=2.6, height=0.8, label="{txt}"];')
        lineas.append("}")
    for a, b, tipo, r in enlaces:
        extra = ", constraint=false" if tipo == "gen" else ""
        lineas.append(f'{a} -> {b} [label="{r}"{extra}];')
    lineas.append("}")
    j = layout("\n".join(lineas))
    p = pos(j)
    d = Doc(nombre)
    titulo(d, nombre, float(j["bb"].split(",")[2]))
    ids = {}
    for o in j["objects"]:
        if o["name"].startswith("cluster_"):
            x1, y1, x2, y2 = map(float, o["bb"].split(","))
            alto = float(j["bb"].split(",")[3])
            d.vertex(o["label"], LIMITE, x1, alto - y2, x2 - x1, y2 - y1)
    for o in j["objects"]:
        if "pos" not in o or o["name"].startswith("cluster_"):
            continue
        x, y = p(o["pos"])
        w, h = float(o["width"]) * 72, float(o["height"]) * 72
        if o["shape"] == "box":
            ext = dict((a[0], a[2]) for a in actores)[o["name"]]
            lbl = o["label"] + ("<br><i>«sistema externo»</i>" if ext else "")
            ids[o["_gvid"]] = d.vertex(lbl, ACTOR, x - 15, y - 35, 30, 60)
        else:
            ids[o["_gvid"]] = d.vertex(o["label"], CASO, x - w / 2, y - h / 2, w, h)
    estilos = {"asoc": "endArrow=none;", "gen": "endArrow=block;endFill=0;endSize=12;",
               "include": "endArrow=open;dashed=1;", "extend": "endArrow=open;dashed=1;"}
    for e in j["edges"]:
        a, b, tipo, r = enlaces[e["_gvid"]]
        rot = {"include": "«include»", "extend": "«extend»"}.get(tipo, "")
        if r:
            rot += ("<br>" if rot else "") + r
        d.edge(ids[e["tail"]], ids[e["head"]], rot, estilos[tipo])
    y0 = float(j["bb"].split(",")[3]) + 20
    for k, t in enumerate(notas):
        d.vertex(t, NOTA, 0 + k * 330, y0, 310, 70)
    d.guardar(archivo)

A_VIS = ("Visitante", "Visitante", False)
A_USU = ("Usuario", "Usuario", False)
A_CLI = ("Cliente", "Cliente", False)
A_COC = ("Cocinero", "Cocinero", False)
A_MP = ("MP", "Mercado Pago", True)
A_COR = ("Correo", "Servicio de correo", True)
CU = {
    "CU01": "CU-01 Registrar cuenta", "CU02": "CU-02 Iniciar sesión", "CU03": "CU-03 Cerrar sesión",
    "CU04": "CU-04 Recuperar contraseña", "CU05": "CU-05 Consultar menús", "CU06": "CU-06 Crear menú",
    "CU07": "CU-07 Modificar menú", "CU08": "CU-08 Eliminar menú", "CU09": "CU-09 Registrar pedido",
    "CU10": "CU-10 Consultar mis pedidos", "CU11": "CU-11 Cancelar pedido", "CU12": "CU-12 Consultar viandas a cocinar",
    "CU13": "CU-13 Generar orden de pago", "CU14": "CU-14 Pagar reserva", "CU15": "CU-15 Confirmar pago",
    "CU16": "CU-16 Devolver pago", "CU17": "CU-17 Vencer reservas impagas",
}
def pq(t, ids):
    return (t, [(i, CU[i]) for i in ids])
GEN = [("Cliente", "Usuario", "gen", ""), ("Cocinero", "Usuario", "gen", "")]

# ---------------------------------------------------------------- DER
ENTIDADES = [
    ("Rol", ["PK  id : SERIAL", "nombre : TEXT (UNIQUE)"]),
    ("Usuario", ["PK  id : SERIAL", "email : TEXT (UNIQUE)", "nombre : TEXT", "passwordHash : TEXT",
                 "FK  rolId : INTEGER → Rol", "versionToken : INTEGER = 0", "creadoEn : TIMESTAMP(3)"]),
    ("CodigoRecuperacion", ["PK  id : SERIAL", "FK  usuarioId : INTEGER → Usuario", "codigoHash : TEXT",
                            "venceEn : TIMESTAMP(3)", "usadoEn : TIMESTAMP(3) NULL", "intentos : INTEGER = 0", "creadoEn : TIMESTAMP(3)"]),
    ("MenuDia", ["PK  id : SERIAL", "fecha : DATE (UNIQUE)", "descripcion : TEXT", "cupoMaximo : INTEGER",
                 "horaCorte : TEXT (HH:mm)", "precio : INTEGER (pesos)", "creadoEn : TIMESTAMP(3)"]),
    ("Pedido", ["PK  id : SERIAL", "cantidad : INTEGER", "estado : EstadoPedido", "FK  usuarioId : INTEGER → Usuario",
                "FK  menuId : INTEGER → MenuDia", "creadoEn : TIMESTAMP(3)"]),
    ("Pago", ["PK  id : SERIAL", "FK  pedidoId : INTEGER → Pedido (UNIQUE)", "monto : INTEGER (pesos)", "estado : EstadoPago",
              "preferenciaId : TEXT NULL (UNIQUE)", "urlPago : TEXT NULL", "mpPagoId : TEXT NULL", "venceEn : TIMESTAMP(3)",
              "creadoEn : TIMESTAMP(3)", "actualizadoEn : TIMESTAMP(3)"]),
    ("«enum» EstadoPedido", ["PENDIENTE_PAGO", "CONFIRMADO", "CANCELADO"]),
    ("«enum» EstadoPago", ["PENDIENTE", "APROBADO", "RECHAZADO", "CANCELADO", "DEVUELTO"]),
]
RELACIONES = [  # (padre, hijo, inicio, fin, rótulo)
    ("Rol", "Usuario", "ERmandOne", "ERzeroToMany", "tiene"),
    ("Usuario", "CodigoRecuperacion", "ERmandOne", "ERzeroToMany", "solicita"),
    ("Usuario", "Pedido", "ERmandOne", "ERzeroToMany", "hace"),
    ("MenuDia", "Pedido", "ERmandOne", "ERzeroToMany", "recibe"),
    ("Pedido", "Pago", "ERmandOne", "ERzeroToOne", "se paga con"),
]
def der():
    FILA, ANCHO = 22, 270
    nid = lambda n: re.sub(r"\W", "", n)
    lineas = ["digraph G { rankdir=TB; nodesep=0.8; ranksep=0.9;"]
    for n, campos in ENTIDADES:
        lineas.append(f'{nid(n)} [shape=box, width={ANCHO/72:.2f}, height={(26 + FILA*len(campos))/72:.2f}, label=""];')
    for a, b, *_ in RELACIONES:
        lineas.append(f"{a} -> {b};")
    lineas.append("Pedido -> enumEstadoPedido [style=invis]; Pago -> enumEstadoPago [style=invis]; }")
    j = layout("\n".join(lineas))
    p = pos(j)
    d = Doc("DER — ViandasSemana")
    titulo(d, "ViandasSemana — Modelo de datos (DER)", float(j["bb"].split(",")[2]))
    ids = {}
    for o in j["objects"]:
        x, y = p(o["pos"])
        n = next(e for e in ENTIDADES if nid(e[0]) == o["name"])
        campos = n[1]
        h = 26 + FILA * len(campos)
        enum = n[0].startswith("«")
        cont = d.vertex(n[0], f"swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;collapsible=0;marginBottom=0;html=1;fillColor={'#f5f5f5' if enum else '#dae8fc'};strokeColor={'#888888' if enum else '#2f5d8a'};",
                        x - ANCHO / 2, y - h / 2, ANCHO, h)
        ids[o["name"]] = cont
        for k, c in enumerate(campos):
            negrita = "fontStyle=1;" if c.startswith("PK") else ""
            d.vertex(c, f"text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;html=1;{negrita}", 0, 26 + k * FILA, ANCHO, FILA, parent=cont)
    for a, b, ini, fin, r in RELACIONES:
        d.edge(ids[a], ids[b], r, f"edgeStyle=entityRelationEdgeStyle;startArrow={ini};endArrow={fin};startFill=0;endFill=0;startSize=12;endSize=12;")
    d.edge(ids["Pedido"], ids["enumEstadoPedido"], "", "dashed=1;endArrow=none;")
    d.edge(ids["Pago"], ids["enumEstadoPago"], "", "dashed=1;endArrow=none;")
    d.vertex("Cardinalidad en notación pata de gallo: una raya = exactamente uno; círculo + pata = cero o muchos; círculo + raya = cero o uno.<br>"
             "CodigoRecuperacion y Pago se borran en cascada con su Usuario / Pedido. Un MenuDia o un Usuario con pedidos no se puede borrar.",
             NOTA, 0, float(j["bb"].split(",")[3]) + 20, 620, 60)
    d.guardar("der")

# ---------------------------------------------------------------- grafos genéricos (arquitectura, ambientes, estados)
def grafo(archivo, nombre, nodos, enlaces, rankdir="TB", grupos=()):
    """nodos: [(id, texto, estilo, ancho, alto)]; enlaces: [(a, b, rótulo, estilo)]; grupos: [(titulo, [ids], estilo)]"""
    lineas = [f"digraph G {{ rankdir={rankdir}; nodesep=0.7; ranksep=1.0; compound=true;"]
    en_grupo = {i for _, ids_, _ in grupos for i in ids_}
    for k, (t, ids_, _) in enumerate(grupos):
        lineas.append(f'subgraph cluster_{k} {{ label="{t}"; margin=26;')
        for i in ids_:
            n = next(x for x in nodos if x[0] == i)
            lineas.append(f'{i} [shape=box, width={n[3]/72:.2f}, height={n[4]/72:.2f}];')
        lineas.append("}")
    for i, _, _, w, h in nodos:
        if i not in en_grupo:
            lineas.append(f'{i} [shape=box, width={w/72:.2f}, height={h/72:.2f}];')
    for a, b, r, _ in enlaces:
        lineas.append(f'{a} -> {b} [label="{r[:30]}"];')
    lineas.append("}")
    j = layout("\n".join(lineas))
    p = pos(j)
    alto = float(j["bb"].split(",")[3])
    d = Doc(nombre)
    titulo(d, nombre, float(j["bb"].split(",")[2]))
    for k, o in enumerate(o for o in j["objects"] if o["name"].startswith("cluster_")):
        x1, y1, x2, y2 = map(float, o["bb"].split(","))
        est = next(g[2] for g in grupos if g[0] == o["label"])
        d.vertex(o["label"], est, x1, alto - y2, x2 - x1, y2 - y1)
    ids = {}
    for o in j["objects"]:
        if "pos" not in o or o["name"].startswith("cluster_"):
            continue
        x, y = p(o["pos"])
        n = next(x_ for x_ in nodos if x_[0] == o["name"])
        ids[o["name"]] = d.vertex(n[1], n[2], x - n[3] / 2, y - n[4] / 2, n[3], n[4])
    for a, b, r, est in enlaces:
        d.edge(ids[a], ids[b], r, est)
    d.guardar(archivo)

NODO = "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#555555;"
BASE = "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;size=12;fillColor=#d5e8d4;strokeColor=#3c7a35;"
NUBE = "ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#999999;"
SECRETO = "shape=note;whiteSpace=wrap;html=1;size=12;fillColor=#fff2cc;strokeColor=#b08900;fontSize=10;"
GRUPO = "rounded=0;whiteSpace=wrap;html=1;fillColor=none;dashed=1;verticalAlign=top;align=left;spacingLeft=8;fontStyle=1;strokeColor=#555555;"
FLECHA = "endArrow=classic;"
PUNTEADA = "endArrow=classic;dashed=1;"

def arquitectura():
    nodos = [
        ("nav", "Cliente / Cocinero<br>(navegador)", ACTOR.replace("verticalLabelPosition=bottom;", "verticalLabelPosition=bottom;"), 40, 70),
        ("front", "<b>Frontend React + Vite</b><br>sitio estático (HTML, JS, CSS)<br>VITE_API_URL fijada al construir", NODO, 230, 70),
        ("api", "<b>API Node 22 + Express 5</b><br>/api/health · /api/auth · /api/menus<br>/api/pedidos · /api/pagos", NODO, 250, 70),
        ("sec", "<b>Variables de entorno (secretos)</b><br>DATABASE_URL · JWT_SECRET · CORS_ORIGIN<br>MP_ACCESS_TOKEN · SMTP_* · MAIL_FROM<br>FRONTEND_URL · API_URL", SECRETO, 260, 80),
        ("logs", "<b>Render Logs</b><br>logs JSON (pino)", NODO, 160, 50),
        ("neon", "<b>Neon PostgreSQL 16</b><br>(Free, AWS us-east-1)", BASE, 190, 90),
        ("mp", "<b>Mercado Pago</b><br>api.mercadopago.com", NODO, 190, 55),
        ("gmail", "<b>Gmail SMTP</b><br>smtp.gmail.com", NODO, 170, 55),
        ("dev", "Integrante<br>(push / merge de PR)", ACTOR, 40, 70),
        ("repo", "<b>Repositorio</b><br>main protegida", NODO, 180, 55),
        ("actions", "<b>GitHub Actions (ci-cd.yml)</b><br>1. backend: npm ci → migrate deploy (base efímera)<br>→ npm test (cobertura ≥ 65 %) → build<br>2. frontend: npm ci → build<br>3. desplegar: sólo push a main y si 1 y 2 pasan", NODO, 330, 100),
        ("ghsec", "<b>Secretos de Actions</b><br>DEPLOY_HOOK_BACKEND<br>DEPLOY_HOOK_FRONTEND", SECRETO, 190, 60),
    ]
    enlaces = [
        ("nav", "front", "HTTPS 443 · Internet", FLECHA),
        ("nav", "api", "HTTPS 443 · JSON · Bearer token · Internet", FLECHA),
        ("api", "neon", "PostgreSQL 5432 sobre TLS · Internet", FLECHA),
        ("api", "mp", "HTTPS 443 · REST · Internet", FLECHA),
        ("mp", "api", "webhook HTTPS 443 · /api/pagos/notificacion", PUNTEADA),
        ("api", "gmail", "SMTP 465 TLS · Internet", FLECHA),
        ("api", "logs", "stdout (interno de Render)", PUNTEADA),
        ("sec", "api", "process.env (interno)", PUNTEADA),
        ("dev", "repo", "git push / merge", FLECHA),
        ("repo", "actions", "evento push o pull_request a main", FLECHA),
        ("ghsec", "actions", "secrets.*", PUNTEADA),
        ("actions", "front", "POST deploy hook (HTTPS)", FLECHA),
        ("actions", "api", "POST deploy hook (HTTPS)", FLECHA),
    ]
    grupos = [
        ("Render Static Site (CDN) — https://viandassemana-web.onrender.com", ["front"], GRUPO),
        ("Render Web Service Free (Virginia) — https://viandassemana.onrender.com", ["api", "sec", "logs"], GRUPO),
        ("GitHub", ["repo", "actions", "ghsec"], GRUPO),
    ]
    grafo("arquitectura", "ViandasSemana — Arquitectura y despliegue", nodos, enlaces, "TB", grupos)

def ambientes():
    nodos = [
        ("lf", "Vite dev server<br>http://localhost:5173", NODO, 180, 50),
        ("la", "API (tsx watch)<br>http://localhost:3000", NODO, 180, 50),
        ("le", "backend/.env y frontend/.env<br>(no se suben: .gitignore)", SECRETO, 200, 50),
        ("ld", "Docker: viandas_dev<br>localhost:5432", BASE, 170, 75),
        ("lt", "Docker: viandas_test<br>localhost:5433 (sólo tests)", BASE, 190, 75),
        ("pf", "Render Static Site<br>https://viandassemana-web.onrender.com", NODO, 250, 50),
        ("pa", "Render Web Service<br>https://viandassemana.onrender.com", NODO, 250, 50),
        ("pe", "Variables de entorno de Render<br>(secretos de la plataforma)", SECRETO, 210, 50),
        ("pd", "Neon PostgreSQL<br>(remota y compartida)", BASE, 180, 75),
        ("pl", "Render Logs", NODO, 130, 40),
    ]
    enlaces = [
        ("lf", "la", "HTTP (misma máquina)", FLECHA), ("la", "ld", "TCP 5432", FLECHA), ("le", "la", "", PUNTEADA),
        ("pf", "pa", "HTTPS 443 por Internet", FLECHA), ("pa", "pd", "TLS 5432 por Internet", FLECHA),
        ("pe", "pa", "", PUNTEADA), ("pa", "pl", "", PUNTEADA),
    ]
    grupos = [("LOCAL (computadora del integrante)", ["lf", "la", "le", "ld", "lt"], GRUPO),
              ("PRODUCCIÓN (sin depender de ninguna computadora)", ["pf", "pa", "pe", "pd", "pl"], GRUPO)]
    grafo("ambientes", "Ambiente local vs. ambiente productivo", nodos, enlaces, "TB", grupos)

def estados():
    INI = "ellipse;html=1;fillColor=#000000;strokeColor=#000000;"
    FIN = "ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;"
    EST = "rounded=1;arcSize=30;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#b08900;"
    nodos = [
        ("ini", "", INI, 24, 24),
        ("pp", "<b>PENDIENTE_PAGO</b><br>pago: PENDIENTE, RECHAZADO o CANCELADO", EST, 260, 60),
        ("c", "<b>CONFIRMADO</b><br>pago: APROBADO", EST, 200, 60),
        ("x", "<b>CANCELADO</b><br>pago: CANCELADO o DEVUELTO", EST, 230, 60),
        ("fin", "", FIN, 28, 28),
    ]
    enlaces = [
        ("ini", "pp", "CU-09 Registrar pedido (ocupa cupo)", FLECHA),
        ("pp", "c", "CU-15 Mercado Pago aprueba y el monto coincide", FLECHA),
        ("pp", "x", "CU-11 cancela antes del corte · CU-17 vence el plazo · falla la orden de pago", FLECHA),
        ("c", "x", "CU-11 cancela antes del corte → CU-16 devolución · contracargo", FLECHA),
        ("c", "fin", "pasa la hora de corte (se cocina)", FLECHA),
        ("x", "fin", "", FLECHA),
        ("pp", "pp", "pago rechazado o pendiente (reintenta)", FLECHA),
        ("x", "x", "llega un pago aprobado → CU-16 se devuelve", FLECHA),
    ]
    grafo("estados-pedido-pago", "Estados del pedido y de su pago", nodos, enlaces, "LR")

# ---------------------------------------------------------------- secuencia (disposición propia)
def secuencia():
    part = [("cli", "Cliente", True), ("f", "Frontend (React)", False), ("p", "API /api/pedidos y /api/pagos", False),
            ("db", "PostgreSQL", False), ("mp", "Mercado Pago", False)]
    msgs = [
        ("cli", "f", "elige menú y cantidad", 0), ("f", "p", "POST /api/pedidos {menuId, cantidad} + Bearer token", 0),
        ("p", "db", "BEGIN; SELECT … FROM \"MenuDia\" FOR UPDATE", 0), ("p", "db", "vence reservas impagas; suma viandas que ocupan cupo", 0),
        ("p", "p", "validarNuevoPedido() (cupo y hora de corte)", 0),
        ("p", "f", "[sin cupo o fuera de horario] 409 CUPO_COMPLETO / FUERA_DE_HORARIO", 1),
        ("p", "db", "INSERT Pedido (PENDIENTE_PAGO) + Pago (PENDIENTE); COMMIT", 0),
        ("p", "mp", "POST /checkout/preferences", 0), ("mp", "p", "{id, init_point}", 1),
        ("p", "f", "[si Mercado Pago falla] cancela la reserva y responde 502", 1),
        ("p", "db", "guarda preferenciaId y urlPago", 0), ("p", "f", "201 {pedido, urlPago}", 1),
        ("f", "mp", "redirige al cliente a urlPago", 0), ("cli", "mp", "paga con tarjeta", 0),
        ("mp", "p", "POST /api/pagos/notificacion (webhook, en producción)", 0),
        ("mp", "f", "vuelve a /?pedido=ID&payment_id=…", 1),
        ("f", "p", "POST /api/pagos/notificacion {data: {id}}", 0),
        ("p", "mp", "GET /v1/payments/{id}", 0), ("mp", "p", "{status, transaction_amount, external_reference}", 1),
        ("p", "db", "FOR UPDATE del pedido; APROBADO y monto correcto → Pago APROBADO, Pedido CONFIRMADO", 0),
        ("p", "f", "{estadoPedido: CONFIRMADO}", 1), ("f", "cli", "«¡Pago aprobado! Tu reserva está confirmada.»", 1),
    ]
    d = Doc("Secuencia de una reserva con su pago")
    SEP, ANCHO, Y0, PASO = 300, 200, 40, 42
    alto = Y0 + 60 + PASO * (len(msgs) + 1)
    titulo(d, "Reserva y pago de una vianda (CU-09, CU-13, CU-14, CU-15)", SEP * len(part))
    ids = {}
    for k, (i, n, actor) in enumerate(part):
        cx = 100 + k * SEP
        est = "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=50;"
        est += "participant=umlActor;" if actor else "fillColor=#dae8fc;strokeColor=#2f5d8a;"
        ids[i] = d.vertex(n, est, cx - ANCHO / 2, Y0, ANCHO, alto)
    for k, (a, b, t, resp) in enumerate(msgs):
        y = Y0 + 80 + k * PASO
        xa = 100 + [p[0] for p in part].index(a) * SEP
        xb = 100 + [p[0] for p in part].index(b) * SEP
        est = "verticalAlign=bottom;endArrow=" + ("open;dashed=1;" if resp else "block;")
        mid = self_id = d.id()
        if a == b:
            pts = f'<Array as="points"><mxPoint x="{xa+60}" y="{y}"/><mxPoint x="{xa+60}" y="{y+18}"/></Array>'
            d.celdas.append(f'<mxCell id="{mid}" value="{esc(t)}" style="html=1;fontSize=10;align=left;spacingLeft=4;{est}" edge="1" parent="1">'
                            f'<mxGeometry relative="1" as="geometry"><mxPoint x="{xa}" y="{y}" as="sourcePoint"/><mxPoint x="{xa}" y="{y+18}" as="targetPoint"/>{pts}</mxGeometry></mxCell>')
        else:
            d.celdas.append(f'<mxCell id="{mid}" value="{esc(t)}" style="html=1;fontSize=10;{est}" edge="1" parent="1">'
                            f'<mxGeometry relative="1" as="geometry"><mxPoint x="{xa}" y="{y}" as="sourcePoint"/><mxPoint x="{xb}" y="{y}" as="targetPoint"/></mxGeometry></mxCell>')
    d.guardar("secuencia-reserva-pago")

# ---------------------------------------------------------------- todo
print("Diagramas draw.io:")
dfd("dfd-0-contexto", "DFD Nivel 0 — Diagrama de contexto")
dfd("dfd-1", "DFD Nivel 1")
dfd("dfd-2-acceso", "DFD Nivel 2 — Proceso 1: Gestionar acceso")
dfd("dfd-2-menus", "DFD Nivel 2 — Proceso 2: Gestionar menús")
dfd("dfd-2-pedidos", "DFD Nivel 2 — Proceso 3: Gestionar pedidos")
dfd("dfd-2-pagos", "DFD Nivel 2 — Proceso 4: Procesar pagos")

casos_de_uso("cu-general", "Casos de uso — general",
    [A_VIS, A_USU, A_CLI, A_COC, A_MP, A_COR],
    [pq("1. Autenticación", ["CU01", "CU02", "CU03", "CU04"]), pq("2. Menús", ["CU05", "CU06", "CU07", "CU08"]),
     pq("3. Pedidos", ["CU09", "CU10", "CU11", "CU12"]), pq("4. Pagos", ["CU13", "CU14", "CU15", "CU16", "CU17"])],
    GEN + [("Visitante", "CU01", "asoc", ""), ("Usuario", "CU02", "asoc", ""), ("Usuario", "CU03", "asoc", ""),
     ("Usuario", "CU04", "asoc", ""), ("CU04", "Correo", "asoc", ""), ("Usuario", "CU05", "asoc", ""),
     ("Cocinero", "CU06", "asoc", ""), ("Cocinero", "CU07", "asoc", ""), ("Cocinero", "CU08", "asoc", ""),
     ("Cliente", "CU09", "asoc", ""), ("Cliente", "CU10", "asoc", ""), ("Cliente", "CU11", "asoc", ""),
     ("Cocinero", "CU12", "asoc", ""), ("Cliente", "CU14", "asoc", ""), ("CU13", "MP", "asoc", ""),
     ("CU14", "MP", "asoc", ""), ("MP", "CU15", "asoc", ""), ("CU16", "MP", "asoc", ""),
     ("CU09", "CU13", "include", ""), ("CU05", "CU17", "include", ""), ("CU09", "CU17", "include", ""),
     ("CU10", "CU17", "include", ""), ("CU14", "CU17", "include", ""),
     ("CU16", "CU11", "extend", "[pedido ya pagado]"), ("CU16", "CU15", "extend", "[pago no esperado]")])
casos_de_uso("cu-1-autenticacion", "Módulo 1 — Autenticación: casos de uso",
    [A_VIS, A_USU, A_CLI, A_COC, A_COR], [pq("Autenticación", ["CU01", "CU02", "CU03", "CU04"])],
    GEN + [("Visitante", "CU01", "asoc", ""), ("Usuario", "CU02", "asoc", ""), ("Usuario", "CU03", "asoc", ""),
     ("Usuario", "CU04", "asoc", ""), ("CU04", "Correo", "asoc", "")],
    ["Toda cuenta nueva es CLIENTE. El rol COCINERO se asigna en la base."])
casos_de_uso("cu-2-menus", "Módulo 2 — Menús: casos de uso",
    [A_USU, A_CLI, A_COC], [pq("Menús", ["CU05", "CU06", "CU07", "CU08"]), pq("Pagos", ["CU17"])],
    GEN + [("Usuario", "CU05", "asoc", ""), ("Cocinero", "CU06", "asoc", ""), ("Cocinero", "CU07", "asoc", ""),
     ("Cocinero", "CU08", "asoc", ""), ("CU05", "CU17", "include", "")])
casos_de_uso("cu-3-pedidos", "Módulo 3 — Pedidos: casos de uso",
    [A_CLI, A_COC, A_MP], [pq("Pedidos", ["CU09", "CU10", "CU11", "CU12"]), pq("Pagos", ["CU13", "CU16", "CU17"])],
    [("Cliente", "CU09", "asoc", ""), ("Cliente", "CU10", "asoc", ""), ("Cliente", "CU11", "asoc", ""),
     ("Cocinero", "CU12", "asoc", ""), ("CU09", "CU13", "include", ""), ("CU09", "CU17", "include", ""),
     ("CU10", "CU17", "include", ""), ("CU16", "CU11", "extend", "[pedido ya pagado]"),
     ("CU13", "MP", "asoc", ""), ("CU16", "MP", "asoc", "")])
casos_de_uso("cu-4-pagos", "Módulo 4 — Pagos: casos de uso",
    [A_CLI, A_MP], [pq("Pagos", ["CU13", "CU14", "CU15", "CU16", "CU17"]), pq("Pedidos", ["CU09", "CU11"])],
    [("Cliente", "CU14", "asoc", ""), ("CU14", "MP", "asoc", ""), ("CU13", "MP", "asoc", ""), ("MP", "CU15", "asoc", ""),
     ("CU16", "MP", "asoc", ""), ("CU09", "CU13", "include", ""), ("CU14", "CU17", "include", ""),
     ("CU16", "CU11", "extend", "[pedido ya pagado]"), ("CU16", "CU15", "extend", "[pago no esperado]")],
    ["No hay tarea programada: CU-17 se ejecuta cada vez que alguien consulta menús o pedidos, reserva o pide pagar."])
der()
arquitectura()
ambientes()
estados()
secuencia()
