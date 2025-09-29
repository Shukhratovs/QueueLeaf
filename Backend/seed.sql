-- seed.sql
with t as (
  insert into tenants(name) values ('Demo Co') returning id
), l as (
  insert into locations(tenant_id, name, time_zone)
  select id, 'Downtown', 'America/Los_Angeles' from t returning id
)
insert into queue_settings(location_id, is_open, custom_message, avg_service_mins)
select id, true, 'Welcome to QueueLeaf demo!', 6 from l;

-- Add a few waiting tickets
insert into tickets(location_id, name, party_size, status, created_at)
select l.id, v.name, v.party, 'waiting', now() - (v.min_ago || ' minutes')::interval
from (select id from locations where name='Downtown') l(id),
     (values ('Alex',2,15),('Sam',3,10),('Jordan',1,5)) as v(name,party,min_ago);

-- Mark one as called and one as served to give analytics some data
update tickets set status='called', called_at=now()-interval '2 minutes'
where name='Alex';
update tickets set status='served', called_at=now()-interval '20 minutes', served_at=now()-interval '5 minutes'
where name='Sam';
