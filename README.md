# micasaestuya-api

REST API for **micasaestuya**, a free platform that connects hosts offering accommodation and meals with travellers who help out a few hours a day in exchange. Built with Node.js 22, Express, MongoDB, and Redis.

The project's source of truth (product vision, architecture, decisions and current status) is the [`micasaestuya-docs`](https://github.com/marlonbdez/micasaestuya-docs) repo. Coding conventions for this repo are in `CLAUDE.md` and `docs/`.

## Tech Stack

| Layer                | Technology            |
| -------------------- | --------------------- |
| Runtime              | Node.js 22            |
| Framework            | Express 4             |
| Database             | MongoDB (Mongoose 6)  |
| Cache / autocomplete | Redis (ioredis)       |
| Authentication       | JWT (jsonwebtoken)    |
| Testing              | node:test + Supertest |
| Hot reload (dev)     | nodemon               |

## Prerequisites

- Node.js 22+
- npm 8+
- A running MongoDB instance
- A running Redis instance

The easiest way to meet the last two is to start the full stack with Docker Compose from the `micasaestuya-infra` repo (see Option 2 or the infra README).

## Getting Started

### Option 1 — Local development (without Docker)

1. Clone this repository.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file and fill in the values:

   ```bash
   cp .env.example .env
   ```

4. Start the development server (with hot reload via nodemon):

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3001`.

### Option 2 — Docker Compose (recommended)

> The repos (`micasaestuya-api`, `micasaestuya-web`, `micasaestuya-infra`, and `micasaestuya-docs` for the documentation) should be cloned as siblings in the same parent directory.

1. From the parent directory, start all services:

   ```bash
   docker compose -f micasaestuya-infra/docker-compose.yml up --build
   ```

2. The API will be available at `http://localhost:3001`.

See the [micasaestuya-infra README](../micasaestuya-infra/README.md) for the full Docker Compose flow.

### Option 3 — VS Code Dev Container

> This requires the repos to be cloned as siblings and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension for VS Code.

1. Open the `micasaestuya-api/` folder in VS Code.
2. When the prompt appears, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
3. VS Code will start the full Docker Compose stack and connect to the `express` container.
4. The terminal inside VS Code is a shell inside the container. The server starts automatically with `npm run dev`.

## Environment Variables

| Variable           | Required | Description                                                                 |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| `PORT`             | Yes      | Port used by the Express server                                             |
| `NODE_ENV`         | No       | `development`, `test` or `production` (the npm scripts set it for you)      |
| `MONGODB_URI`      | Yes      | Full MongoDB connection URI (includes database and authSource)              |
| `MONGODB_TEST_URI` | Tests    | MongoDB URI used only by `npm test` (a separate database)                   |
| `REDIS_URI`        | No       | Redis connection URI (default: `redis://localhost:6379`)                    |
| `REDIS_TEST_URI`   | Tests    | Redis URI used only by `npm test` (default: `redis://localhost:6379/1`)     |
| `SECRET`           | Yes      | Secret key used to sign and verify JWT tokens                               |

In production (`NODE_ENV=production`) the server refuses to start if `PORT`, `MONGODB_URI`, `REDIS_URI` or `SECRET` is missing.

Copy `.env.example` to `.env` for local development without Docker.

## npm Scripts

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start the server with nodemon (hot reload)   |
| `npm start`          | Start the server in production mode          |
| `npm test`           | Run the test suite with node:test            |
| `npm run lint`       | Run ESLint (Standard style)                  |
| `npm run redis:seed` | Populate Redis with location and region data |

## API Endpoints

### Health

| Method | Route         | Auth | Description               |
| ------ | ------------- | ---- | ------------------------- |
| `GET`  | `/api/health` | No   | Returns the server status |

### Users

| Method | Route                | Auth         | Description                                   |
| ------ | -------------------- | ------------ | --------------------------------------------- |
| `POST` | `/api/users/login`   | No           | Authenticates a user and returns a JWT        |
| `POST` | `/api/users/create`  | No           | Registers a new user                          |
| `GET`  | `/api/users/current` | Bearer token | Returns the profile of the authenticated user |
| `GET`  | `/api/users/profile` | Bearer token | Alias of `/api/users/current`                 |
| `GET`  | `/api/users`         | Bearer token | Lists all users                               |

**Body — login:**

```json
{ "email": "user@example.com", "password": "password123" }
```

**Body — create:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

### Regions

A region is a node of the administrative tree (province, municipality, locality) for Cuba (`CU`) and the Dominican Republic (`DO`). The tree lives in `data/regions_*.json`; see `CLAUDE.md` for why there are two ways to read it.

| Method | Route                                                                    | Auth | Description                                                   |
| ------ | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| `GET`  | `/api/regions/suggest?term=<term>&country_code=<cc>[&level_type=1\|2\|3]` | No   | Autocomplete by prefix (Redis), optionally filtered by level  |
| `GET`  | `/api/regions/children?country_code=<cc>[&level1=&level2=&level3=]`      | No   | Children of a node of the tree (read from memory, not Redis) |

## Testing

Tests use Node's native test runner (`node:test`) and Supertest. The suite requires an active MongoDB instance.

```bash
npm test
```

The `--test-concurrency=1` flag runs test files in series to avoid race conditions on the shared database.

## Redis — Populate location data

The `/api/regions/suggest` endpoint uses Redis sorted sets for prefix-based autocomplete (`/api/regions/children` does not need Redis). Redis must be populated before the endpoint returns results.

**Populate Redis (once per new instance):**

```bash
npm run redis:seed
```

**When running with Docker Compose, from outside the container:**

```bash
docker exec express npm run redis:seed
```

The script loads location data for Cuba (`CU`) and the Dominican Republic (`DO`) from the `data/` directory. It **flushes the whole Redis database** (`flushdb`) before loading, so running it again replaces all existing data. Don't run it just to check that Redis works.
