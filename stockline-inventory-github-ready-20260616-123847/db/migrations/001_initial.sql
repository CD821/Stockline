create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table roles (
  name text primary key,
  manage_inventory boolean not null default false,
  dispatch_inventory boolean not null default false,
  view_logs boolean not null default false,
  manage_users boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id bigint generated always as identity primary key,
  name text not null check (length(btrim(name)) > 0),
  username text not null check (length(btrim(username)) > 0),
  password_hash text not null,
  role_name text not null references roles(name),
  active boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_archived_inactive_check check (not archived or not active)
);

create unique index users_username_lower_uidx on users (lower(username));
create index users_current_role_idx on users (role_name) where archived = false;

create table inventory_items (
  id bigint generated always as identity primary key,
  source_key text unique,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  id_number text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  minimum integer not null default 0 check (minimum >= 0),
  division text not null check (division in ('TTS', 'Bespoke')),
  notes text not null default '',
  status text not null default 'Active'
    check (status in ('Active', 'Discontinued', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_check check (reserved <= quantity),
  constraint inventory_archived_empty_check check (
    status <> 'Archived' or (quantity = 0 and reserved = 0)
  )
);

create index inventory_items_status_idx on inventory_items (status);
create index inventory_items_division_idx on inventory_items (division);
create index inventory_items_id_number_idx on inventory_items (id_number);
create index inventory_items_low_stock_idx
  on inventory_items (minimum, quantity, reserved)
  where status = 'Active' and minimum > 0;

create table inventory_movements (
  id bigint generated always as identity primary key,
  item_id bigint not null references inventory_items(id),
  user_id bigint references users(id) on delete set null,
  movement_type text not null
    check (movement_type in ('Dispatch', 'Restock', 'Adjustment', 'Created')),
  quantity_delta integer not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index inventory_movements_item_created_idx
  on inventory_movements (item_id, created_at desc);
create index inventory_movements_user_created_idx
  on inventory_movements (user_id, created_at desc);

create table audit_logs (
  id bigint generated always as identity primary key,
  user_id bigint references users(id) on delete set null,
  user_name_snapshot text not null,
  action text not null,
  item text not null,
  quantity integer,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on audit_logs (created_at desc);
create index audit_logs_user_created_idx
  on audit_logs (user_id, created_at desc);
create index audit_logs_action_created_idx
  on audit_logs (action, created_at desc);

create table sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id);
create index sessions_expiry_idx on sessions (expires_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roles_set_updated_at on roles;
create trigger roles_set_updated_at
before update on roles
for each row execute function set_updated_at();

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists inventory_items_set_updated_at on inventory_items;
create trigger inventory_items_set_updated_at
before update on inventory_items
for each row execute function set_updated_at();
