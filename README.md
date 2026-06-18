# Stockline Inventory

Inventory management backed by PostgreSQL, with:

- Inventory fields for Name, ID Number, Division, Notes, On hand, Available, and Minimum quantity
- Division choices limited to TTS and Bespoke
- Active, Discontinued, and Archived item states that retain inventory history
- 236 inventory lines imported from the SharePoint `Inventory` tab
- Dispatch and restock transactions with row-level stock locking
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
- `.gitignore`
- `README.md`
- `package.json` and `package-lock.json`
- `serve.mjs`, `app.js`, `styles.css`, and `index.html`
- `db/`, `lib/`, and `scripts/`
- `render.yaml` if deploying with Render

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
