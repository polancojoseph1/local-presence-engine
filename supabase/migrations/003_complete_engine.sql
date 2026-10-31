
-- Additive upgrade: keep existing tenant data and expose specification names as
-- security-invoker views. No client can bypass the base-table RLS policies.
alter table organizations add column industry_category text not null default 'barbershop', add column phone text, add column email text, add column address text, add column timezone text not null default 'America/New_York', add column google_place_id text, add column branding_config jsonb not null default '{}', add column plan_tier text not null default 'standard' check(plan_tier in ('standard','premium')), add column setup_fee_cents integer not null default 29900 check(setup_fee_cents>=0), add column setup_fee_paid_at timestamptz, add column notification_preferences jsonb not null default '{"review_email":true,"review_sms":false,"feedback_email":true,"feedback_sms":false,"monthly_report":true}';
alter table memberships drop constraint memberships_user_id_key;
alter table memberships add column role text not null default 'owner' check(role in ('owner','staff','operator_admin'));
create table operators(user_id uuid primary key references auth.users on delete cascade);
alter table operators enable row level security;
create policy self_read on operators for select to authenticated using(user_id=auth.uid());
create function is_operator() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from operators where user_id=auth.uid())$$;
create function has_org(oid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships where user_id=auth.uid() and org_id=oid) or is_operator()$$;
create function manages_org(oid uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from memberships where user_id=auth.uid() and org_id=oid and role in ('owner','operator_admin')) or is_operator()$$;
revoke all on function is_operator(),has_org(uuid),manages_org(uuid) from public;
grant execute on function is_operator(),has_org(uuid),manages_org(uuid) to authenticated;
create or replace function my_org() returns uuid language sql stable security definer set search_path=public as $$select org_id from memberships where user_id=auth.uid() order by org_id limit 1$$;
do $$declare t text;begin
foreach t in array array['customers','requests','messages','feedback','reviews','review_stats','notifications'] loop
execute format('drop policy tenant_read on %I',t);
execute format('create policy tenant_read on %I for select to authenticated using(has_org(org_id))',t);
end loop;end$$;
drop policy org_read on organizations;
create policy org_read on organizations for select to authenticated using(has_org(id));
drop policy membership_read on memberships;
create policy membership_read on memberships for select to authenticated using(user_id=auth.uid() or manages_org(org_id));
alter table customers add column consent_source text check(consent_source in ('csv_import','manual_entry','counter_qr')), add column opted_out_sms boolean not null default false, add column opted_out_email boolean not null default false, add column opted_out_at timestamptz, add column last_contacted_at timestamptz;
update customers set opted_out_sms=opted_out,opted_out_email=opted_out;
alter table customers add constraint customer_contact check(email is not null or phone is not null), add constraint consent_evidence check(not(email_consent or sms_consent) or (consent_at is not null));
alter table requests drop constraint requests_channel_check;
alter table requests add constraint requests_channel_check check(channel in ('sms','email','multi_channel'));
alter table requests add column short_token text unique;
alter table requests add column status text not null default 'queued' check(status in ('queued','sent','delivered','failed','clicked','completed','opted_out')), add column sent_at timestamptz, add column delivered_at timestamptz, add column next_followup_at timestamptz, add column provider_message_id text, add column error_message text;
alter table messages drop constraint messages_request_id_step_key;
alter table messages add column channel text check(channel in ('sms','email')), add column sent_at timestamptz, add column delivered_at timestamptz;
update messages m set channel=r.channel from requests r where r.id=m.request_id;
alter table messages alter column channel set not null;
alter table messages add unique(request_id,step,channel);
alter table requests add constraint request_org_unique unique(id,org_id);
alter table messages add constraint message_tenant_fk foreign key(request_id,org_id) references requests(id,org_id);
alter table feedback add column customer_id uuid, add column contact_preference text not null default 'none' check(contact_preference in ('none','email','sms')), add column resolved boolean not null default false;
alter table feedback add constraint feedback_tenant_fk foreign key(request_id,org_id) references requests(id,org_id), add constraint feedback_customer_fk foreign key(customer_id,org_id) references customers(id,org_id);
alter table reviews add column external_review_id text, add column reviewer_avatar_url text, add column owner_reply_draft text not null default '', add column reply_status text not null default 'none' check(reply_status in ('none','draft','reviewed','posted_manually')), add column displayed_on_widget boolean not null default true;
create table message_templates(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,name text not null,channel text not null check(channel in ('sms','email')),sequence_step integer not null check(sequence_step in (1,2)),delay_hours integer not null default 0 check(delay_hours between 0 and 336),check((sequence_step=1 and delay_hours=0) or (sequence_step=2 and delay_hours>=1)),subject text,body text not null check(length(body) between 10 and 2000),unique(organization_id,channel,sequence_step));
alter table message_templates enable row level security;
create policy tenant_read on message_templates for select to authenticated using(has_org(organization_id));
create table compliance_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,customer_id uuid references customers on delete set null,event text not null,channel text,source text not null,evidence jsonb not null default '{}',created_at timestamptz not null default now());
alter table compliance_events enable row level security;
create policy tenant_read on compliance_events for select to authenticated using(has_org(organization_id));
create table channel_suppressions(destination text not null,channel text not null check(channel in ('sms','email')),created_at timestamptz not null default now(),primary key(destination,channel));
alter table channel_suppressions enable row level security;
insert into channel_suppressions select destination,case when destination like '+%' then 'sms' else 'email' end,created_at from suppressions;
create table notification_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,event_key text not null,kind text not null,subject text not null,body text not null,channel text not null check(channel in ('sms','email')),status text not null default 'queued' check(status in ('queued','sending','sent','failed','unknown')),error text,created_at timestamptz not null default now(),unique(organization_id,event_key,channel));
alter table notification_jobs enable row level security;
create policy tenant_read on notification_jobs for select to authenticated using(has_org(organization_id));
create table monthly_reports(id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,month date not null,metrics jsonb not null,created_at timestamptz not null default now(),unique(organization_id,month));
alter table monthly_reports enable row level security;
create policy tenant_read on monthly_reports for select to authenticated using(has_org(organization_id));
create index customer_org_created on customers(org_id,created_at desc);
create index request_org_created on requests(org_id,created_at desc);
create index message_due on messages(due_at) where status='queued';
create index message_provider on messages(provider_id);
create index message_org_created on messages(org_id,created_at desc);
create index review_org_published on reviews(org_id,published_at desc);
create index feedback_org_created on feedback(org_id,created_at desc);
create index compliance_org_created on compliance_events(organization_id,created_at desc);
create index notification_pending on notification_jobs(created_at) where status='queued';
create or replace function apply_suppression() returns trigger language plpgsql security definer set search_path=public as $$begin
if exists(select 1 from channel_suppressions where destination=new.phone and channel='sms') then new.opted_out_sms=true;end if;
if exists(select 1 from channel_suppressions where destination=new.email and channel='email') then new.opted_out_email=true;end if;
new.opted_out=new.opted_out_sms and new.opted_out_email;
return new;end$$;
create function cancel_opted_out() returns trigger language plpgsql security definer set search_path=public as $$begin
update messages set status='cancelled' where request_id in(select id from requests where customer_id=new.id) and status in ('queued','processing') and ((channel='sms' and new.opted_out_sms) or (channel='email' and new.opted_out_email));
update requests set status='opted_out',next_followup_at=null where customer_id=new.id and (new.opted_out_sms and new.opted_out_email or channel='sms' and new.opted_out_sms or channel='email' and new.opted_out_email);
return new;end$$;
create trigger cancel_customer_sequences after update of opted_out_sms,opted_out_email on customers for each row execute function cancel_opted_out();
create function prove_consent() returns trigger language plpgsql set search_path=public as $$begin
if (new.sms_consent or new.email_consent) and (new.consent_at is null or new.consent_source is null or new.consent_at>now()+interval '5 minutes') then raise exception 'Provide original consent timestamp and source';end if;return new;end$$;
create trigger require_consent_evidence before insert or update of sms_consent,email_consent,consent_at,consent_source on customers for each row execute function prove_consent();
create or replace function onboard(business text) returns uuid language plpgsql security definer set search_path=public as $$declare oid uuid;begin
if auth.uid() is null then raise exception 'Unauthorized';end if;
if not is_operator() and exists(select 1 from memberships where user_id=auth.uid()) then raise exception 'Already onboarded';end if;
if length(trim(business)) not between 1 and 100 then raise exception 'Invalid business';end if;
insert into organizations(name,owner_email) values(trim(business),(select email from auth.users where id=auth.uid())) returning id into oid;
insert into memberships(user_id,org_id,role) values(auth.uid(),oid,case when is_operator() then 'operator_admin' else 'owner' end);return oid;end$$;
create or replace function enqueue_review(oid uuid,cid uuid,ch text) returns uuid language plpgsql security definer set search_path=public as $$declare rid uuid;c customers;days integer;begin
if auth.uid() is null or not has_org(oid) then raise exception 'Unauthorized';end if;
select * into c from customers where id=cid and org_id=oid for update;
if c.id is null or c.consent_at is null or c.consent_source is null or ch not in ('sms','email','multi_channel') or (ch in ('sms','multi_channel') and (not c.sms_consent or c.phone is null or c.opted_out_sms)) or (ch in ('email','multi_channel') and (not c.email_consent or c.email is null or c.opted_out_email)) then raise exception 'Customer lacks consent or is opted out';end if;
if (select google_url='' from organizations where id=oid) then raise exception 'Configure Google review link first';end if;
insert into requests(org_id,customer_id,channel) values(oid,cid,ch) returning id into rid;
select reminder_days into days from organizations where id=oid;
insert into messages(org_id,request_id,step,channel,due_at) select oid,rid,s.step,x.channel,now()+make_interval(hours=>coalesce(t.delay_hours,case when s.step=0 then 0 else days*24 end)) from (values(0),(1))s(step) cross join (values('sms'),('email'))x(channel) left join message_templates t on t.organization_id=oid and t.channel=x.channel and t.sequence_step=s.step+1 where ch='multi_channel' or ch=x.channel;
update requests set next_followup_at=(select max(due_at) from messages where request_id=rid) where id=rid;
return rid;end$$;
-- Atomic claims are restricted to the server's service identity.
drop function claim_messages();
create function claim_messages(request_filter uuid default null) returns setof messages language plpgsql security definer set search_path=public as $$begin
update messages set status='queued' where status='processing' and claimed_at<now()-interval '10 minutes';
return query update messages set status='processing',claimed_at=now() where id in(select id from messages where status='queued' and due_at<=now() and (request_filter is null or request_id=request_filter) order by due_at for update skip locked limit 50) returning *;end$$;
revoke all on function claim_messages(uuid) from public,anon,authenticated;grant execute on function claim_messages(uuid) to service_role;
create function suppress_contact(destination_value text,channel_value text,source_value text) returns void language plpgsql security definer set search_path=public as $$declare c customers;begin
insert into channel_suppressions(destination,channel) values(destination_value,channel_value) on conflict do nothing;
for c in select * from customers where (channel_value='sms' and phone=destination_value) or (channel_value='email' and email=lower(destination_value)) loop
update customers set opted_out_sms=opted_out_sms or channel_value='sms',opted_out_email=opted_out_email or channel_value='email',opted_out_at=now() where id=c.id;
insert into compliance_events(organization_id,customer_id,event,channel,source) values(c.org_id,c.id,'opt_out',channel_value,source_value);
end loop;end$$;
revoke all on function suppress_contact(text,text,text) from public,anon,authenticated;grant execute on function suppress_contact(text,text,text) to service_role;
create function unsubscribe_request(request_token uuid) returns void language plpgsql security definer set search_path=public as $$declare c customers;begin
select customers.* into c from customers join requests on requests.customer_id=customers.id where token=request_token;
if c.id is null then raise exception 'Invalid link';end if;
update customers set opted_out_sms=true,opted_out_email=true,opted_out_at=now() where id=c.id;
insert into compliance_events(organization_id,customer_id,event,source) values(c.org_id,c.id,'opt_out','unsubscribe_link');end$$;
revoke all on function unsubscribe_request(uuid) from public,anon,authenticated;grant execute on function unsubscribe_request(uuid) to service_role;
create function dashboard_metrics(oid uuid,start_at timestamptz default '-infinity',end_at timestamptz default 'infinity') returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('contacted',(select count(distinct customer_id) from requests where org_id=oid and created_at>=start_at and created_at<end_at),'sent',(select count(*) from messages where org_id=oid and sent_at>=start_at and sent_at<end_at),'delivered',(select count(*) from messages where org_id=oid and status='delivered' and created_at>=start_at and created_at<end_at),'clicked',(select count(*) from requests where org_id=oid and clicked_at is not null and created_at>=start_at and created_at<end_at),'requests',(select count(*) from requests where org_id=oid and created_at>=start_at and created_at<end_at),'opt_outs',(select count(*) from customers where org_id=oid and (opted_out_sms or opted_out_email) and coalesce(opted_out_at,created_at)>=start_at and coalesce(opted_out_at,created_at)<end_at),'new_reviews',(select count(*) from reviews where org_id=oid and published_at>=start_at and published_at<end_at),'feedback',(select count(*) from feedback where org_id=oid and created_at>=start_at and created_at<end_at)) where has_org(oid) or current_setting('role',true)='service_role'$$;
revoke all on function dashboard_metrics(uuid,timestamptz,timestamptz) from public,anon;grant execute on function dashboard_metrics(uuid,timestamptz,timestamptz) to authenticated,service_role;
create view organization_members with(security_invoker=true) as select user_id,org_id as organization_id,role from memberships;
create view review_requests with(security_invoker=true) as select id,org_id as organization_id,customer_id,channel,status,coalesce(short_token,token::text) as short_token,provider_message_id,error_message,sent_at,delivered_at,clicked_at,next_followup_at,created_at from requests;
create view google_reviews with(security_invoker=true) as select id,org_id as organization_id,external_review_id,author as reviewer_name,reviewer_avatar_url,rating as star_rating,body as comment,published_at,owner_reply_draft,reply_status,displayed_on_widget from reviews;
create view private_feedback with(security_invoker=true) as select id,org_id as organization_id,customer_id,request_id as review_request_id,body as message,contact_preference,resolved,created_at from feedback;
grant select on organization_members,review_requests,google_reviews,private_feedback,message_templates,compliance_events,monthly_reports,notification_jobs,operators to authenticated;

-- Owner-controlled memberships; no user can self-promote to a global operator.
create index memberships_org on memberships(org_id);
create index templates_org on message_templates(organization_id);
create function log_consent() returns trigger language plpgsql security definer set search_path=public as $$begin
if new.email_consent or new.sms_consent then insert into compliance_events(organization_id,customer_id,event,source,evidence) values(new.org_id,new.id,'consent_recorded',new.consent_source,jsonb_build_object('timestamp',new.consent_at,'sms',new.sms_consent,'email',new.email_consent));end if;return new;end$$;
create trigger log_customer_consent after insert on customers for each row execute function log_consent();
create function cancel_clicked() returns trigger language plpgsql security definer set search_path=public as $$begin
if new.clicked_at is not null then update messages set status='cancelled' where request_id=new.id and step>0 and status in ('queued','processing');end if;return new;end$$;
create trigger stop_followups_on_click after update of clicked_at on requests for each row execute function cancel_clicked();

-- Atomic batch import. Existing opt-in evidence and opt-outs cannot be overwritten.
create function import_customers(oid uuid,rows_json jsonb) returns uuid[] language plpgsql security definer set search_path=public as $$declare row jsonb;existing_ids uuid[];cid uuid;ids uuid[]='{}';begin
if jsonb_typeof(rows_json)<>'array' or jsonb_array_length(rows_json) not between 1 and 500 then raise exception 'Invalid import batch';end if;
-- Serialize import/enqueue against this organization to resolve duplicate races.
perform 1 from organizations where id=oid for update;if not found then raise exception 'Unknown organization';end if;
for row in select * from jsonb_array_elements(rows_json) loop
select array_agg(distinct id) into existing_ids from customers where org_id=oid and ((email is not null and email=nullif(lower(row->>'email'),'')) or (phone is not null and phone=nullif(row->>'phone','')));
if cardinality(existing_ids)>1 then raise exception 'Email and phone belong to different customers';end if;
cid=existing_ids[1];
if cid is null then
insert into customers(org_id,name,email,phone,email_consent,sms_consent,consent_at,consent_source) values(oid,row->>'name',nullif(lower(row->>'email'),''),nullif(row->>'phone',''),coalesce((row->>'email_consent')::boolean,false),coalesce((row->>'sms_consent')::boolean,false),(row->>'consent_at')::timestamptz,row->>'consent_source') returning id into cid;
else update customers set name=row->>'name' where id=cid;
end if;ids=array_append(ids,cid);end loop;return ids;end$$;
revoke all on function import_customers(uuid,jsonb) from public,anon,authenticated;grant execute on function import_customers(uuid,jsonb) to service_role;
-- Generated specification aliases keep upgrades compatible with the original MVP.
alter table organizations add column google_review_url text generated always as (google_url) stored;
alter table customers add column organization_id uuid generated always as (org_id) stored, add column full_name text generated always as (name) stored, add column phone_e164 text generated always as (phone) stored, add column consent_given boolean generated always as (sms_consent or email_consent) stored, add column consent_timestamp timestamptz generated always as (consent_at) stored;
