# micasaestuya-backend

REST API for the property rental and sale platform **Mi Casa Es Tuya**. Built with Node.js 18, Express, MongoDB, and Redis.

## Tech Stack

| Layer                | Technology            |
| -------------------- | --------------------- |
| Runtime              | Node.js 18            |
| Framework            | Express 4             |
| Database             | MongoDB (Mongoose 6)  |
| Cache / autocomplete | Redis (ioredis)       |
| Authentication       | JWT (jsonwebtoken)    |
| Testing              | node:test + Supertest |
| Hot reload (dev)     | nodemon               |

## Prerequisites

- Node.js 18+
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

> The three repos (`micasaestuya-backend`, `micasaestuya-frontend`, `micasaestuya-infra`) should be cloned as siblings in the same parent directory.

1. From the parent directory, start all services:

   ```bash
   docker compose -f micasaestuya-infra/dev/docker/docker-compose.yml up --build
   ```

2. The API will be available at `http://localhost:3001`.

See the [micasaestuya-infra README](../micasaestuya-infra/README.md) for the full Docker Compose flow.

### Option 3 — VS Code Dev Container

> This requires the three repos to be cloned as siblings and the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension for VS Code.

1. Open the `micasaestuya-backend/` folder in VS Code.
2. When the prompt appears, click **Reopen in Container** (or run `Dev Containers: Reopen in Container` from the command palette).
3. VS Code will start the full Docker Compose stack and connect to the `express` container.
4. The terminal inside VS Code is a shell inside the container. The server starts automatically with `npm run dev`.

## Environment Variables

| Variable      | Required | Description                                                    |
| ------------- | -------- | -------------------------------------------------------------- |
| `PORT`        | Yes      | Port used by the Express server                                |
| `NODE_ENV`    | No       | Set to `development` to enable the `/api/testing` router       |
| `MONGODB_URI` | Yes      | Full MongoDB connection URI (includes database and authSource) |
| `REDIS_URI`   | No       | Redis connection URI (default: `redis://localhost:6379`)       |
| `SECRET`      | Yes      | Secret key used to sign and verify JWT tokens                  |

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

### Locations (Redis)

| Method | Route                                                  | Auth | Description                                      |
| ------ | ------------------------------------------------------ | ---- | ------------------------------------------------ |
| `GET`  | `/api/locations/suggest?term=<term>&country_code=<cc>` | No   | Location autocomplete by prefix and country code |

### Testing _(only in development)_

Available only when `NODE_ENV=development`.

| Method | Route                | Auth | Description                        |
| ------ | -------------------- | ---- | ---------------------------------- |
| `POST` | `/api/testing/reset` | No   | Clears the database for test setup |

## Testing

Tests use Node's native test runner (`node:test`) and Supertest. The suite requires an active MongoDB instance.

```bash
npm test
```

The `--test-concurrency=1` flag runs test files in series to avoid race conditions on the shared database.

## Redis — Populate location data

The `/api/locations/suggest` endpoint uses Redis sorted sets for prefix-based autocomplete. Redis must be populated before the endpoint returns results.

**Populate Redis (once per new instance):**

```bash
npm run redis:seed
```

**When running with Docker Compose, from outside the container:**

```bash
docker exec express npm run redis:seed
```

The script loads location data for Cuba (`CU`) and the Dominican Republic (`DO`) from the `data/` directory. It flushes the Redis database before loading, so running it again will replace all existing data.
