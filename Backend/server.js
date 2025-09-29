// server.js
import express from "express";
import pg from "pg";
import cors from "cors";

const { Pool } = pg;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://localhost:5432/queueleaf",
});

const app = express();
app.use(cors());
app.use(express.json());

// simple health check
app.get("/health", (req, res) => res.json({ ok: true }));

// tiny query helper
const q = async (text, params = []) => (await pool.query(text, params)).rows;

// ---- Settings
// GET /api/tickets?locationId=UUID  (same result as the :locationId route)
app.get("/api/tickets", async (req, res) => {
  const locationId = req.query.locationId;
  if (!locationId) return res.status(400).json({ error: "locationId is required" });
  const rows = await q(
    `select * from tickets
      where location_id=$1 and status in ('waiting','called')
      order by created_at`,
    [locationId]
  );
  res.json(rows);
});

// PATCH /api/settings?locationId=UUID  (mirror of :locationId route)
app.patch("/api/settings", async (req, res) => {
  const locationId = req.query.locationId;
  if (!locationId) return res.status(400).json({ error: "locationId is required" });

  const { is_open, custom_message, avg_service_mins } = req.body;

  try {
    const [s] = await q(
      `
      update queue_settings
         set is_open          = coalesce($2::boolean,  is_open),
             custom_message   = coalesce($3::text,     custom_message),
             avg_service_mins = coalesce($4::integer,  avg_service_mins)
       where location_id = $1
       returning *;
      `,
      [locationId, is_open, custom_message, avg_service_mins]
    );
    res.json(s || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});


// ---- Tickets
app.get("/api/analytics/summary/:locationId", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [row] = await q(
    `with base as (
       select *
       from tickets
       where location_id = $1
         and created_at::date = $2::date
     )
     select
       count(*) filter (where served_at is not null) as served,
       round(avg(extract(epoch from (coalesce(called_at, served_at) - created_at))/60.0)::numeric, 2) as avg_wait_mins,
       round(
         (
           percentile_disc(0.9) within group (
             order by extract(epoch from (coalesce(called_at, served_at) - created_at))/60.0
           )
         )::numeric, 2
       ) as p90_wait_mins,
       round(avg(extract(epoch from (served_at - coalesce(called_at, created_at)))/60.0)::numeric, 2) as avg_service_mins,
       count(*) filter (where status = 'cancelled') as cancelled,
       count(*) filter (where status in ('waiting','called')) as in_queue_now
     from base;`,
    [req.params.locationId, date]
  );
  res.json(row || {});
});

app.post("/api/tickets/:locationId", async (req, res) => {
  const { name, party_size = 1, contact = null } = req.body;
  const [row] = await q(
    `insert into tickets (location_id, name, party_size, contact)
     values ($1,$2,$3,$4) returning *`,
    [req.params.locationId, name, party_size, contact]
  );
  res.status(201).json(row);
});

app.patch("/api/ticket/:id", async (req, res) => {
  const { status } = req.body; // 'called' | 'served' | 'cancelled'
  const [row] = await q(
    `update tickets
       set status = $1::ticket_status,
           called_at    = case when $1::ticket_status = 'called'::ticket_status    and called_at is null then now() else called_at end,
           served_at    = case when $1::ticket_status = 'served'::ticket_status    and served_at is null then now() else served_at end,
           cancelled_at = case when $1::ticket_status = 'cancelled'::ticket_status and cancelled_at is null then now() else cancelled_at end
     where id = $2
     returning *`,
    [status, req.params.id]
  );
  res.json(row || {});
});


// ---- Analytics
app.get("/api/analytics/served-per-hour/:locationId", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = await q(
    `select to_char(date_trunc('hour', served_at), 'HH24:00') as hour, count(*)::int as served
       from tickets where location_id=$1 and served_at::date = $2::date
       group by 1 order by 1`,
    [req.params.locationId, date]
  );
  const map = Object.fromEntries(rows.map((r) => [r.hour, r.served]));
  const out = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, "0") + ":00";
    return { hour: hh, served: map[hh] || 0 };
  });
  res.json(out);
});

app.get("/api/analytics/summary/:locationId", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [row] = await q(
    `with base as (
       select * from tickets where location_id=$1 and created_at::date=$2::date
     )
     select
       count(*) filter (where served_at is not null) as served,
       round(avg(extract(epoch from (coalesce(called_at, served_at) - created_at))/60)::numeric,2) as avg_wait_mins,
       round(percentile_disc(0.9) within group (order by extract(epoch from (coalesce(called_at, served_at) - created_at))/60)),2) as p90_wait_mins,
       round(avg(extract(epoch from (served_at - coalesce(called_at, created_at)))/60)::numeric,2) as avg_service_mins,
       count(*) filter (where status='cancelled') as cancelled,
       count(*) filter (where status in ('waiting','called')) as in_queue_now`,
    [req.params.locationId, date]
  );
  res.json(row || {});
});

// ---- Boot
const port = process.env.PORT || 3001;
app.listen(port, () => console.log("API listening on " + port));
