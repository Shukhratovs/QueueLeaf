-- schema.sql
-- Requires Postgres 13+ (works great on 15/16)
create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- 1) Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type ticket_status as enum ('waiting','called','served','cancelled');
  end if;
end$$;

-- 2) Tenancy & locations (single location also fine)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  time_zone text not null default 'UTC'
);

-- 3) Queue settings
create table if not exists queue_settings (
  location_id uuid primary key references locations(id) on delete cascade,
  is_open boolean not null default true,
  custom_message text not null default '',
  avg_service_mins integer not null default 6 check (avg_service_mins >= 1)
);

-- 4) Tickets
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  party_size integer not null check (party_size >= 1),
  contact text,
  status ticket_status not null default 'waiting',
  created_at timestamptz not null default now(),
  called_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz
);

-- keep timestamps consistent with status
alter table tickets drop constraint if exists status_time_consistency;
alter table tickets add constraint status_time_consistency check (
  (status='waiting'   and called_at is null and served_at is null and cancelled_at is null) or
  (status='called'    and called_at is not null and served_at is null and cancelled_at is null) or
  (status='served'    and served_at is not null and cancelled_at is null) or
  (status='cancelled' and cancelled_at is not null and served_at is null)
);

-- Helpful indexes
create index if not exists idx_tickets_loc_status_created on tickets (location_id, status, created_at);
create index if not exists idx_tickets_loc_served   on tickets (location_id, served_at);
create index if not exists idx_tickets_loc_called   on tickets (location_id, called_at);

-- 5) Event log for analytics (status transitions)
create table if not exists ticket_events (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  old_status ticket_status,
  new_status ticket_status not null,
  at timestamptz not null default now()
);
create index if not exists idx_events_loc_at on ticket_events (location_id, at);
create index if not exists idx_events_ticket on ticket_events (ticket_id, at);

-- Trigger: log status transitions & stamp timestamps
create or replace function log_ticket_status_change() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into ticket_events(ticket_id, location_id, old_status, new_status, at)
    values (new.id, new.location_id, null, new.status, coalesce(new.created_at, now()));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into ticket_events(ticket_id, location_id, old_status, new_status, at)
      values (new.id, new.location_id, old.status, new.status, now());

      if new.status='called'    and new.called_at    is null then new.called_at    := now(); end if;
      if new.status='served'    and new.served_at    is null then new.served_at    := now(); end if;
      if new.status='cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
    end if;
    return new;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_insert on tickets;
create trigger trg_ticket_insert after insert on tickets
for each row execute procedure log_ticket_status_change();

drop trigger if exists trg_ticket_update on tickets;
create trigger trg_ticket_update before update on tickets
for each row execute procedure log_ticket_status_change();

-- 6) Convenience views for analytics
create or replace view v_ticket_times as
select
  t.id,
  t.location_id,
  t.status,
  t.created_at,
  t.called_at,
  t.served_at,
  t.cancelled_at,
  extract(epoch from (coalesce(t.called_at, t.served_at, now()) - t.created_at))/60.0 as wait_mins,
  case when t.served_at is not null and t.called_at is not null
       then extract(epoch from (t.served_at - t.called_at))/60.0 end as service_mins
from tickets t;

create or replace view v_served_per_hour as
select
  location_id,
  date_trunc('hour', served_at) as hour,
  count(*) as served_count
from tickets
where served_at is not null
group by 1,2;

create or replace view v_today_summary as
select
  l.id as location_id,
  current_date as day,
  count(*) filter (where t.served_at::date = current_date) as served,
  round(avg(extract(epoch from (t.called_at - t.created_at))/60)::numeric,2)
    filter (where t.called_at::date = current_date) as avg_wait_to_call,
  round(avg(extract(epoch from (t.served_at - coalesce(t.called_at,t.created_at)))/60)::numeric,2)
    filter (where t.served_at::date = current_date) as avg_service_mins,
  count(*) filter (where t.cancelled_at::date = current_date) as cancelled,
  count(*) filter (where t.status in ('waiting','called')) as in_queue_now
from locations l
left join tickets t on t.location_id = l.id
group by 1,2;
