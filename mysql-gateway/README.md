# SI DATA PEGAWAI MySQL Gateway

Production-ready REST API that exposes read-only endpoints to clients and a
protected write/sync endpoint for internal use. This service is the ONLY public
gateway to the private MySQL database.

## Why MySQL Is Never Exposed
- MySQL (port 3306) must remain private to prevent direct access and attacks.
- phpMyAdmin must never be exposed publicly.
- Only this Node.js API is reachable from the internet.

## Security Model
- Write/sync endpoints require an API key (`X-API-KEY`).
- Secrets are loaded from environment variables only.
- Cloudflare should reverse-proxy HTTPS traffic to this API.

## Project Structure
- `server.js` - Express API entry point
- `.env.example` - Environment variables template
- `README.md` - Setup and deployment instructions

## Requirements
- Node.js >= 18
- MySQL (private, local or internal)

## Setup
1) Install dependencies:
   ```
   npm install
   ```
2) Create `.env` from `.env.example`:
   ```
   cp .env.example .env
   ```
3) Update credentials in `.env`.

## Run Locally
```
node server.js
```

## Endpoints

### Health Check
`GET /health`
- Verifies MySQL connectivity.
- Returns `{ ok: true }` on success.

### Read Pegawai (Public)
`GET /pegawai?q=...&limit=200`
- Search by `nama`, `nip`, or `ukpd`.
- Results limited to 200.
- Ordered by newest (`created_at DESC`).

### Read Pegawai Detail (Public)
`GET /pegawai/:id`
- Returns a single row.
- `404` if not found.

### Sync Pegawai (Protected)
`POST /sync/pegawai`
- Requires `X-API-KEY`.
- Body:
  ```
  {
    "nip": "string | null",
    "nama": "string (required)",
    "ukpd": "string | null"
  }
  ```
- Empty `nip` is treated as `NULL`.
- Uses `INSERT ... ON DUPLICATE KEY UPDATE`.

## Deployment Notes
- Run behind Cloudflare Tunnel or reverse proxy.
- Example:
  - Public: `https://api.kepegawaian.media`
  - Private upstream: `http://127.0.0.1:3000`
- MySQL remains private on `127.0.0.1:3306`.

## Restricting CORS
By default CORS is open. For production, replace `cors()` in `server.js` with:
```
app.use(cors({ origin: ['https://your-domain.example'] }));
```
