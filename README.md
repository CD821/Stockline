# Stockline Inventory

Inventory management backed by PostgreSQL, with:

- Inventory fields for Name, ID Number, optional Description, Notes, On hand, Available, and Minimum quantity
- Division choices limited to TTS and Bespoke
- Active, Discontinued, and Archived item states that retain inventory history
- 258 inventory lines imported from the SharePoint `Inventory` tab
- Dispatch and restock transactions with row-level stock locking
- Dispatch tickets capture Division and Destination separately and can be edited with an audit trail
- Dispatch Log filters by division and date range, with movement balance shown per row
- Overview highlights items with the most dispatch and receive movement
- Low-stock notifications and downloadable purchase lists
- Editable users, roles, and permissions
- Filterable and sortable audit and dispatch logs
- Server-side sessions, hashed passwords, and API permission checks

Passwords are stored as one-way hashes. Administrators can edit a username or reset a
password, but cannot retrieve anyone's current password.

## Prerequisites

- Node.js 22 or newer with `npm`
- Docker Desktop for local PostgreSQL, or a PostgreSQL connection string from IT

## GitHub handoff

This project is ready to upload to a private GitHub repository. Include the full
project folder, including:

- `.env.example`
- `.env.supabase.example`
- `.gitignore`
- `README.md`
- `package.json` and `package-lock.json`
- `serve.mjs`, `api/`, `app.js`, `styles.css`, and `index.html`
- `db/`, `lib/`, and `scripts/`
- `vercel.json` if deploying with Vercel
- `render.yaml` if deploying with Render
- `render-supabase.yaml` if deploying the web app on Render with Supabase as the database

Do not upload `.env` or `node_modules`. The `.gitignore` file is already configured
to keep local passwords and installed packages out of GitHub.

## Local setup

1. Copy `.env.example` to `.env` and change the database password.
2. Start PostgreSQL:

```powershell
docker compose up -d
```

3. Install dependencies and initialize the database:

```powershell
npm install
npm run db:setup
```

4. Start the application:

```powershell
npm start
```

Open `http://127.0.0.1:4387`.

The initial administrator is created only by the seed script:

- Username: `carlos`
- Password: `admin123`

Change that password immediately after the first login.

## Publish on Render

The included `render.yaml` creates both parts of the online application in Render's
Ohio region:

- A Starter Node web service
- A Basic-256MB PostgreSQL database with public database access disabled
- HTTPS session cookies, health checks, migrations, and initial inventory import

1. Put this project in a private GitHub repository. Do not upload `.env` or
   `node_modules`.
2. In Render, choose **New > Blueprint**, connect the repository, and select it.
3. When prompted for `INITIAL_ADMIN_PASSWORD`, enter a unique password containing
   at least 12 characters. This value is stored as a secret and is not committed.
4. Approve the two resources and wait for the deployment to finish.
5. Open the generated `https://stockline-inventory-....onrender.com` address and
   sign in with username `carlos` and the private password entered in step 3.

Render runs `npm run db:setup` before each deployment. Migrations are tracked, seed
data is idempotent, and later deployments preserve edited role permissions and user
accounts.

The online PostgreSQL database is separate from the local database on this computer.
After publishing, use the online site as the authoritative inventory system.

## Use Supabase PostgreSQL

Supabase can host the PostgreSQL database for this app. The app can run on Vercel,
Render, Railway, Fly.io, or another Node host.

1. Create a Supabase project.
2. Open the Supabase project dashboard and click **Connect**.
3. For a normal hosted Node app, copy the **Session pooler** URI. Supabase's shared
   pooler works on IPv4 and is the safest default for common app hosts.
4. Copy `.env.supabase.example` to `.env`.
5. Replace `DATABASE_URL` with the Supabase URI and replace the password placeholder.
6. Keep these settings:

```powershell
DATABASE_SSL=require
DATABASE_SSL_REJECT_UNAUTHORIZED=false
DATABASE_POOL_SIZE=3
```

7. Verify the connection:

```powershell
npm run db:check
```

8. Create the tables and import the starting inventory:

```powershell
npm run db:setup
```

9. Start the app:

```powershell
npm start
```

For production hosting, add these environment variables in the host dashboard instead
of committing `.env`:

- `DATABASE_URL`: Supabase Session pooler URI
- `DATABASE_SSL=require`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
- `DATABASE_POOL_SIZE=3`
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `COOKIE_SECURE=true`
- `INITIAL_ADMIN_PASSWORD`: a private 12+ character password

If you deploy on Render while using Supabase for the database, use
`render-supabase.yaml` as the blueprint reference. The original `render.yaml` creates
a Render PostgreSQL database instead.

## Publish on Vercel with Supabase

This project includes `api/index.js` and `vercel.json` so Vercel can serve the
static website files normally while rewriting `/api/*` requests to the same Node
request handler used by the local app. Supabase remains the database.

1. Make sure the Supabase database is initialized:

```powershell
npm run db:check
npm run db:setup
```

2. Push this project to a private GitHub repository. Do not commit `.env` or
   `node_modules`.
3. In Vercel, choose **Add New > Project** and import the GitHub repository.
4. If the repository contains the parent Codex folder, set **Root Directory** to
   `outputs/stockline-inventory`. If the repository starts at this folder, leave the
   root directory unchanged.
5. Use the **Other** framework preset. Leave build and output settings at their
   defaults.
6. Add these Vercel environment variables:

```text
DATABASE_URL=postgres://postgres.PROJECT_REF:YOUR_DATABASE_PASSWORD@.../postgres
DATABASE_SSL=require
DATABASE_SSL_REJECT_UNAUTHORIZED=false
DATABASE_POOL_SIZE=3
SESSION_HOURS=12
COOKIE_SECURE=true
NODE_ENV=production
INITIAL_ADMIN_NAME=Carlos Lopez
INITIAL_ADMIN_USERNAME=carlos
INITIAL_ADMIN_PASSWORD=<private 12+ character password for fresh databases>
```

7. Deploy. After deployment, test:

```text
https://your-project.vercel.app/api/health
```

Then open the main Vercel URL and sign in. Existing Supabase databases keep their
current users and passwords; `INITIAL_ADMIN_PASSWORD` is only used when the seed
script creates the first administrator on an empty database.

## Refresh imported inventory

The latest SharePoint inventory snapshot is embedded in `db/seed/inventory-data.mjs`.
Fresh databases receive that data during `npm run db:setup`.

To intentionally update an existing database from the embedded snapshot, run:

```powershell
npm run db:sync-inventory
```

This updates imported inventory names, ID numbers, on-hand quantities, divisions, and
notes, then writes one audit-log entry summarizing how many rows changed. It does not
delete manually created inventory lines.

## Existing PostgreSQL server

When IT provides a managed PostgreSQL database, set `DATABASE_URL` to its connection
string instead of using Docker. Set `DATABASE_SSL=require` when the server requires
TLS, then run:

```powershell
npm run db:setup
npm start
```

The migration runner records applied migrations in `schema_migrations`, so it is safe
to run during future deployments.

## Backup

Back up the PostgreSQL database, not the application directory. A typical command is:

```powershell
pg_dump --format=custom --file=stockline.backup $env:DATABASE_URL
```

Use restricted database credentials in production, keep `.env` out of source control,
enable TLS, and schedule automated backups with restore testing.
