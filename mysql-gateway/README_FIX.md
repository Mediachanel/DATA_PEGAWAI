# MySQL Gateway Fix

## 1) Create MySQL user and grants

```sql
CREATE USER IF NOT EXISTS 'gateway'@'%' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON pegawai.* TO 'gateway'@'%';
FLUSH PRIVILEGES;
```

## 2) Restart container

```sh
docker compose restart mysql-gateway
```

## 3) Test gateway endpoint (SELECT 1)

```sh
curl -s -X POST http://localhost:3000/db/query \
  -H "content-type: application/json" \
  -H "authorization: Bearer DB_HTTP_TOKEN_VALUE" \
  --data '{"sql":"SELECT 1 AS ok","params":[]}'
```

## 4) Troubleshooting checklist

- Pastikan `DB_HOST` menunjuk ke service MySQL di Docker Compose (default `mysql`).
- Pastikan user `gateway` ada dan punya akses ke database `pegawai`.
- Pastikan port gateway `3000` terbuka dan container `mysql-gateway` berjalan.
- Pastikan `DB_HTTP_TOKEN` di `.env` sama dengan token yang dipakai client.
