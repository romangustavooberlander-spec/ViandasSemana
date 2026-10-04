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

El token se manda en el encabezado `Authorization: Bearer <token>`. Sin token, con token inválido,
vencido o cerrado con logout la API responde **401**; con un rol sin permiso, **403**.
Los roles (`COCINERO`, `CLIENTE`) están en la tabla `Rol` y los carga la migración inicial.
Todo registro crea un CLIENTE; para que un usuario sea cocinero se le cambia el rol en la base
(por ejemplo con `npx prisma studio`).

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Clave para firmar los tokens de sesión |
| `PORT` | Puerto de la API (por defecto 3000) |
| `CORS_ORIGIN` | Orígenes del frontend permitidos, separados por coma |
| `NODE_ENV` | `development` / `test` / `production` |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API |

En producción estos valores se cargan como **secretos de la plataforma**, nunca en el repositorio.

## Pipeline de CI/CD

Cada push a `main` ejecuta: instalar → tests con umbral de cobertura → build → desplegar.
Si cualquier paso falla, no se despliega. Secretos requeridos en GitHub
(Settings → Secrets and variables → Actions): `DEPLOY_HOOK_BACKEND`, `DEPLOY_HOOK_FRONTEND`.

## Flujo de trabajo

- Nadie hace push directo a `main` (rama protegida). Cada cambio va en una rama
  (`feature/login`, `fix/cupo`, …) y entra por Pull Request.
- Cada integrante commitea con su propio usuario de GitHub.
