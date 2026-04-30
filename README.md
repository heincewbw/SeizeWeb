# SeizeWeb — MT4 Investor Platform

Platform dashboard untuk investor yang terkoneksi dengan akun MetaTrader 4 secara real-time.

## Stack Teknologi

| Layer      | Teknologi                          |
|------------|-----------------------------------|
| Frontend   | React 18 + Vite + TailwindCSS     |
| Backend    | Node.js + Express + Socket.io     |
| Database   | Supabase (PostgreSQL)             |
| Realtime   | Socket.io WebSockets              |
| MT4 Bridge | Custom TCP Bridge + MQL4 EA       |

---

## Fitur Utama

- **Dashboard** — Portfolio overview dengan equity chart real-time
- **MT4 Accounts** — Connect/disconnect beberapa akun MT4 sekaligus
- **Open Positions** — Pantau posisi terbuka secara live
- **Trade History** — Filter riwayat trading dengan pagination
- **Analytics** — Equity curve, P&L per symbol, win rate, profit factor
- **Settings** — Ganti password, info profil
- **Real-time Sync** — Update data otomatis setiap 30 detik via WebSocket
- **Demo Mode** — Bisa jalan tanpa MT4 bridge untuk testing

---

## Struktur Project

```
SeizeWeb/
├── frontend/           # React application
├── backend/            # Node.js API server
├── database/
│   └── schema.sql      # Supabase database schema
└── mt4-ea/
    └── SeizeBridge.mq4 # MetaTrader 4 Expert Advisor
```

---

## Cara Setup

### 1. Supabase Database

1. Buat project baru di [supabase.com](https://supabase.com)
2. Masuk ke **SQL Editor**
3. Jalankan isi file `database/schema.sql`
4. Catat **Project URL**, **anon key**, dan **service_role key**

### 2. Backend (Node.js)

```bash
cd backend
npm install

# Salin .env.example ke .env
copy .env.example .env
```

Edit file `backend/.env`:
```env
NODE_ENV=development
PORT=5000

SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...  # service_role key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...      # anon key

JWT_SECRET=ganti_dengan_random_string_panjang_dan_aman

FRONTEND_URL=http://localhost:3000

MT4_BRIDGE_PORT=9090
MT4_BRIDGE_HOST=0.0.0.0

# Aktifkan untuk testing tanpa MT4 (data dummy)
MT4_DEMO_MODE=true
```

Jalankan backend:
```bash
npm run dev
```

Backend akan berjalan di: `http://localhost:5000`

### 3. Frontend (React)

```bash
cd frontend
npm install

# Salin .env.example ke .env
copy .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=
# Kosongkan jika menggunakan proxy Vite (default untuk development)
# Isi dengan URL backend jika deploy terpisah: https://api.yourdomain.com
```

Jalankan frontend:
```bash
npm run dev
```

Frontend akan berjalan di: `http://localhost:3000`

---

## Setup MT4 Bridge (Expert Advisor)

Integrasi dengan MetaTrader 4 menggunakan **SeizeBridge EA** yang berkomunikasi via TCP socket.

### Langkah Instalasi EA

1. Copy file `mt4-ea/SeizeBridge.mq4` ke folder:
   ```
   C:\Users\[Username]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL4\Experts\
   ```
   Atau buka MT4 → File → Open Data Folder → MQL4 → Experts

2. Buka **MetaEditor** (F4 di MT4) → Compile file `SeizeBridge.mq4` (F7)

3. Di MT4, buka chart manapun (contoh: EURUSD M1)

4. Drag `SeizeBridge` dari Navigator ke chart

5. Di dialog EA:
   - **BridgeHost**: IP server backend kamu (gunakan `127.0.0.1` jika lokal)
   - **BridgePort**: `9090` (sesuai `MT4_BRIDGE_PORT` di .env)
   - Centang **Allow DLL imports**

6. Aktifkan **AutoTrading** di toolbar MT4

7. EA akan terkoneksi ke backend. Cek tab **Experts** di MT4 untuk log.

### Mode Demo (Tanpa MT4)

Untuk development/testing tanpa MT4:
```env
MT4_DEMO_MODE=true
```
Data dummy akan digunakan secara otomatis jika bridge tidak tersedia.

---

## API Endpoints

### Auth
| Method | Endpoint              | Deskripsi          |
|--------|-----------------------|--------------------|
| POST   | `/auth/register`      | Daftar akun baru   |
| POST   | `/auth/login`         | Login              |
| GET    | `/auth/me`            | Info user          |
| PUT    | `/auth/change-password` | Ganti password   |

### Accounts (Protected)
| Method | Endpoint                  | Deskripsi             |
|--------|---------------------------|-----------------------|
| GET    | `/api/accounts`           | List semua akun MT4   |
| POST   | `/api/accounts/connect`   | Connect akun MT4 baru |
| DELETE | `/api/accounts/:id`       | Disconnect akun       |
| POST   | `/api/accounts/:id/sync`  | Sync data akun        |

### Positions (Protected)
| Method | Endpoint                            | Deskripsi             |
|--------|-------------------------------------|-----------------------|
| GET    | `/api/positions`                    | Open positions        |
| GET    | `/api/positions/history`            | Trade history         |
| POST   | `/api/positions/sync-history/:id`   | Sync trade history    |

### Stats (Protected)
| Method | Endpoint                    | Deskripsi             |
|--------|-----------------------------|-----------------------|
| GET    | `/api/stats/summary`        | Portfolio summary     |
| GET    | `/api/stats/equity-chart`   | Equity chart data     |
| GET    | `/api/stats/symbol-breakdown` | Breakdown per symbol |

---

## WebSocket Events

Setelah login, frontend terkoneksi via Socket.io:

| Event               | Direction       | Deskripsi                     |
|---------------------|-----------------|-------------------------------|
| `account_update`    | Server → Client | Update balance/equity real-time |
| `positions_update`  | Server → Client | Update posisi terbuka         |
| `subscribe_account` | Client → Server | Subscribe ke akun tertentu    |

---

## Deployment Production

### Backend
```bash
# Gunakan PM2 untuk production
npm install -g pm2
cd backend
pm2 start src/app.js --name seizeweb-api
pm2 save
pm2 startup
```

### Frontend (Build)
```bash
cd frontend
npm run build
# Output di /frontend/dist - deploy ke Vercel, Netlify, atau Nginx
```

### MT4 Bridge di VPS
- Deploy backend di VPS dengan IP publik
- Set `BridgeHost` di EA ke IP VPS
- Buka port `9090` di firewall
- Pastikan EA berjalan 24/7 di MT4 (gunakan VPS MT4)

---

## Keamanan

- Password di-hash dengan **bcrypt** (12 rounds)
- JWT token untuk auth (expire 7 hari)
- **Rate limiting** pada semua endpoint
- **Helmet.js** untuk HTTP security headers
- **CORS** dikonfigurasi hanya untuk frontend URL
- MT4 password **tidak disimpan** di database — hanya digunakan untuk autentikasi bridge
- Row Level Security (RLS) aktif di Supabase

---

## Environment Variables Lengkap

### Backend `.env`
| Variable               | Deskripsi                          | Default      |
|------------------------|------------------------------------|--------------|
| `NODE_ENV`             | Environment                        | development  |
| `PORT`                 | Port backend                       | 5000         |
| `SUPABASE_URL`         | URL Supabase project               | required     |
| `SUPABASE_SERVICE_KEY` | Supabase service role key          | required     |
| `JWT_SECRET`           | Secret untuk JWT                   | required     |
| `JWT_EXPIRES_IN`       | Durasi token                       | 7d           |
| `FRONTEND_URL`         | URL frontend (CORS)                | localhost:3000 |
| `MT4_BRIDGE_PORT`      | Port untuk bridge TCP              | 9090         |
| `MT4_BRIDGE_HOST`      | Host untuk bridge TCP              | 0.0.0.0      |
| `MT4_DEMO_MODE`        | Aktifkan data dummy                | false        |
| `RATE_LIMIT_MAX`       | Max request per window             | 100          |
