-- JMRSP-PnCSC portal. Run once in Supabase -> SQL Editor.
create table terms(name text primary key, is_current boolean default false, is_editable boolean default false, created_at timestamptz default now());
create table profiles(id uuid primary key references auth.users on delete cascade, username text unique, name text, nickname text, team text default 'v', bio text default '', links text[] default '{}', avatar_url text, cover_url text, role text default 'member', admin_role text check (admin_role in ('creator','editor','checker')), fav_public boolean default false, consent boolean default false);
create table posts(id bigserial primary key, user_id uuid references profiles on delete cascade, caption text, tags text[] default '{}', image_url text, is_public boolean default true, created_at timestamptz default now());
create table reactions(id bigserial primary key, post_id bigint references posts on delete cascade, user_id uuid references profiles on delete cascade, emoji text, unique(post_id,user_id));
create table comments(id bigserial primary key, post_id bigint references posts on delete cascade, user_id uuid references profiles on delete cascade, body text, created_at timestamptz default now());
create table favorites(post_id bigint references posts on delete cascade, user_id uuid references profiles on delete cascade, primary key(post_id,user_id));
create table reposts(post_id bigint references posts on delete cascade, user_id uuid references profiles on delete cascade, primary key(post_id,user_id));
create table messages(id bigserial primary key, sender uuid references profiles on delete cascade, receiver uuid references profiles on delete cascade, body text, media_url text, media_type text, created_at timestamptz default now());
create table events(id bigserial primary key, title text, event_date date, location text, details text, image_url text);
create table legacy_people(id bigserial primary key, kind text check (kind in ('founder','officer')), term text, name text, position text, bio text, photo_url text, added_term text, sort int default 0);

create function is_officer() returns boolean language sql security definer stable as $$ select exists(select 1 from profiles where id=auth.uid() and role='officer') $$;
create function is_creator() returns boolean language sql security definer stable as $$ select exists(select 1 from profiles where id=auth.uid() and admin_role='creator') $$;
create function can_edit() returns boolean language sql security definer stable as $$ select exists(select 1 from profiles where id=auth.uid() and admin_role in ('creator','editor')) $$;
create function can_moderate() returns boolean language sql security definer stable as $$ select exists(select 1 from profiles where id=auth.uid() and admin_role in ('creator','checker')) $$;
create function cur_term() returns text language sql security definer stable as $$ select name from terms where is_current limit 1 $$;
create function term_editable(t text) returns boolean language sql security definer stable as $$ select coalesce((select is_editable from terms where name=t),false) $$;
create function fav_is_public(u uuid) returns boolean language sql security definer stable as $$ select coalesce((select fav_public from profiles where id=u),false) $$;



-- public-safe views (no birthday / student number)
create view member_directory as select id,username,name,nickname,team,bio,links,avatar_url,cover_url,role,fav_public,admin_role from profiles;
create view post_feed as select p.*, (select count(*) from favorites f where f.post_id=p.id)::int as fav_count from posts p where p.is_public or p.user_id=auth.uid();
grant select on member_directory, post_feed to anon, authenticated;

-- admin / officer actions

create function set_role(target uuid, r text) returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'Only the admin can do this'; end if; update profiles set role=r where id=target; end $$;
create function start_term(nm text) returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'Only the admin can do this'; end if; update terms set is_current=false, is_editable=false; insert into terms(name,is_current,is_editable) values(nm,true,true); end $$;

-- row level security
do $$ declare t text; begin foreach t in array array['terms','profiles','posts','reactions','comments','favorites','reposts','messages','events','legacy_people'] loop execute format('alter table %I enable row level security',t); end loop; end $$;
create policy "own profile read" on profiles for select using (auth.uid()=id);
create policy "own profile update" on profiles for update using (auth.uid()=id);
revoke update on profiles from authenticated;
grant update(username,name,team,bio,links,avatar_url,cover_url,fav_public) on profiles to authenticated;
create policy "read posts" on posts for select using (is_public or user_id=auth.uid());
create policy "own posts" on posts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "read reactions" on reactions for select using (true);
create policy "own reactions" on reactions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "read comments" on comments for select using (true);
create policy "own comments" on comments for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "read favorites" on favorites for select using (user_id=auth.uid() or fav_is_public(user_id));
create policy "own favorites" on favorites for insert with check (user_id=auth.uid());
create policy "del favorites" on favorites for delete using (user_id=auth.uid());
create policy "read reposts" on reposts for select using (true);
create policy "own reposts" on reposts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "my messages" on messages for select using (sender=auth.uid() or receiver=auth.uid());
create policy "send messages" on messages for insert with check (sender=auth.uid());
create policy "read events" on events for select using (true);
create policy "admin events" on events for all using (can_edit()) with check (can_edit());
create policy "read legacy" on legacy_people for select using (true);
create policy "officers edit legacy" on legacy_people for update using (is_officer() and (kind='founder' or term_editable(term)));
create policy "officers add legacy" on legacy_people for insert with check (is_officer() and kind='officer' and added_term=cur_term() and term_editable(term));
create policy "officers delete current legacy" on legacy_people for delete using (is_officer() and added_term=cur_term());
create policy "read terms" on terms for select using (true);

-- file storage (profile/cover photos, post media, chat media, event & legacy photos)
insert into storage.buckets(id,name,public) values('media','media',true) on conflict do nothing;
create policy "upload own folder" on storage.objects for insert to authenticated with check (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated using (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);

-- starting data
insert into terms(name,is_current,is_editable,created_at) values('2025–2026',false,true,now()-interval '1 year'),('2026–2027',true,true,now());
insert into legacy_people(kind,name,position,bio,sort) values('founder','Founder name','Founder','Edit this entry.',1),('founder','Co-Founder name','Co-Founder','Edit this entry.',2),('founder','Co-Founder name','Co-Founder','Edit this entry.',3);

-- editable team community cover photos
create table team_covers(team text primary key, url text);
alter table team_covers enable row level security;
create policy "read team covers" on team_covers for select using (true);
create policy "officers write team covers" on team_covers for all using (can_edit()) with check (can_edit());

-- ===== security hardening =====
-- 1) Encryption of sensitive data (birthday, student number) with pgcrypto. The key lives in Supabase Vault, never in code.
--    Create the key ONCE before the first signup:  select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'pii_key');
create extension if not exists pgcrypto with schema extensions;
create function pii_key() returns text language sql security definer as $$ select decrypted_secret from vault.decrypted_secrets where name='pii_key' limit 1 $$;
revoke all on function pii_key() from public, anon, authenticated;
create table profiles_private(id uuid primary key references profiles on delete cascade, birthday_enc bytea, student_no_enc bytea);
alter table profiles_private enable row level security;   -- no policy = nobody can read it directly
revoke all on profiles_private from anon, authenticated;
create function my_private() returns table(birthday text, student_no text) language sql security definer as $$ select extensions.pgp_sym_decrypt(birthday_enc,pii_key()), extensions.pgp_sym_decrypt(student_no_enc,pii_key()) from profiles_private where id=auth.uid() $$;
-- 2) Admin roles: creator / editor / content checker. Creators can only be removed through an approved request.
create table removal_requests(id bigserial primary key, target uuid references profiles on delete cascade, requested_by uuid references profiles on delete cascade, status text default 'pending', created_at timestamptz default now());
create table audit_log(id bigserial primary key, actor uuid, action text, detail text, at timestamptz default now());
alter table removal_requests enable row level security; alter table audit_log enable row level security;
create policy "creators see requests" on removal_requests for select using (is_creator() or target=auth.uid());
create policy "creators see audit" on audit_log for select using (is_creator());
create function add_admin(target uuid, r text) returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'Only a creator can add admins'; end if;
  if r not in ('creator','editor','checker') then raise exception 'Invalid role'; end if;
  update profiles set admin_role=r, role='officer' where id=target; insert into audit_log(actor,action,detail) values(auth.uid(),'add_admin',target||':'||r); end $$;
create function remove_admin(target uuid) returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'Only a creator can remove admins'; end if;
  if (select admin_role from profiles where id=target)='creator' then raise exception 'A creator cannot be removed directly. File a removal request.'; end if;
  update profiles set admin_role=null where id=target; insert into audit_log(actor,action,detail) values(auth.uid(),'remove_admin',target::text); end $$;
create function request_creator_removal(target uuid) returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'Only a creator can do this'; end if;
  if target=auth.uid() then raise exception 'Use Step down for yourself'; end if;
  if (select admin_role from profiles where id=target) is distinct from 'creator' then raise exception 'Target is not a creator'; end if;
  insert into removal_requests(target,requested_by) values(target,auth.uid()); insert into audit_log(actor,action,detail) values(auth.uid(),'request_removal',target::text); end $$;
create function answer_removal(req bigint, ok boolean) returns void language plpgsql security definer as $$ declare r removal_requests; begin
  select * into r from removal_requests where id=req and status='pending';
  if r.id is null or r.target<>auth.uid() then raise exception 'Only the requested creator can answer'; end if;
  if ok and (select count(*) from profiles where admin_role='creator')<2 then raise exception 'At least one creator must remain'; end if;
  update removal_requests set status=case when ok then 'approved' else 'declined' end where id=req;
  if ok then update profiles set admin_role=null where id=r.target; end if;
  insert into audit_log(actor,action,detail) values(auth.uid(),'answer_removal',req||':'||ok); end $$;
create function step_down() returns void language plpgsql security definer as $$ begin
  if not is_creator() then raise exception 'You are not a creator'; end if;
  if (select count(*) from profiles where admin_role='creator')<2 then raise exception 'Add another creator first'; end if;
  update profiles set admin_role=null where id=auth.uid(); insert into audit_log(actor,action,detail) values(auth.uid(),'step_down',''); end $$;
create policy "moderate posts" on posts for delete using (can_moderate());
create policy "moderate comments" on comments for delete using (can_moderate());
-- 3) Editable site photos (About / Events circles and About cards)
create table site_pics(key text primary key, url text);
alter table site_pics enable row level security;
create policy "read site pics" on site_pics for select using (true);
create policy "editors write site pics" on site_pics for all using (can_edit()) with check (can_edit());
-- 4) Lock record access: anonymous visitors may only read public data
revoke all on all tables in schema public from anon;
grant select on member_directory, post_feed, events, legacy_people, terms, team_covers, site_pics, reactions, comments, reposts, favorites to anon;
-- 5) Restrict file uploads on the server: only these types, max 25 MB (the app also limits images to 5 MB)
update storage.buckets set file_size_limit=26214400, allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'] where id='media';

-- ===== member roster: admin sheet import, QR numbers, membership verification at sign-up =====
create table member_roster(id bigserial primary key, student_no_enc bytea not null, student_hash text unique not null, full_name text not null, nickname text, qr_number text unique not null, claimed_by uuid references profiles on delete set null, created_at timestamptz default now());
alter table member_roster enable row level security;   -- no policies: only the functions below can touch it
revoke all on member_roster from anon, authenticated;
create function gen_qr() returns text language plpgsql as $$ declare a text:='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int; begin
  loop c:='JM26-'; for i in 1..6 loop c:=c||substr(a,1+(get_byte(extensions.gen_random_bytes(1),0)%31),1); end loop;
    exit when not exists(select 1 from member_roster where qr_number=c); end loop; return c; end $$;
create function import_roster(rows jsonb) returns int language plpgsql security definer as $$ declare r jsonb; h text; n int:=0; begin
  if not can_edit() then raise exception 'Admins only'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    continue when coalesce(trim(r->>'student_no'),'')='' or coalesce(trim(r->>'full_name'),'')='';
    h:=encode(extensions.digest(lower(trim(r->>'student_no')),'sha256'),'hex');
    continue when exists(select 1 from member_roster where student_hash=h);
    insert into member_roster(student_no_enc,student_hash,full_name,nickname,qr_number) values(extensions.pgp_sym_encrypt(trim(r->>'student_no'),pii_key()),h,trim(r->>'full_name'),coalesce(nullif(trim(r->>'nickname'),''),split_part(trim(r->>'full_name'),' ',1)),gen_qr());
    n:=n+1; end loop;
  insert into audit_log(actor,action,detail) values(auth.uid(),'import_roster',n::text); return n; end $$;
create function roster_list() returns table(id bigint, student_no text, full_name text, nickname text, qr_number text, claimed boolean) language sql security definer as $$
  select m.id, extensions.pgp_sym_decrypt(m.student_no_enc,pii_key()), m.full_name, m.nickname, m.qr_number, m.claimed_by is not null from member_roster m where can_edit() order by m.id desc $$;
create function regen_qr(rid bigint) returns void language plpgsql security definer as $$ begin
  if not can_edit() then raise exception 'Admins only'; end if; update member_roster set qr_number=gen_qr() where id=rid and claimed_by is null; end $$;
create function delete_roster(rid bigint) returns void language plpgsql security definer as $$ begin
  if not can_edit() then raise exception 'Admins only'; end if; delete from member_roster where id=rid and claimed_by is null; end $$;
create function my_id() returns table(qr_number text, student_no text, full_name text, nickname text) language sql security definer as $$
  select m.qr_number, extensions.pgp_sym_decrypt(m.student_no_enc,pii_key()), m.full_name, m.nickname from member_roster m where m.claimed_by=auth.uid() $$;
-- sign-up is only allowed with a valid, unused QR number AND the matching student number
create function new_user() returns trigger language plpgsql security definer as $$ declare m member_roster; begin
  select * into m from member_roster where qr_number=upper(trim(coalesce(new.raw_user_meta_data->>'qr',''))) and claimed_by is null;
  if m.id is null then raise exception 'Invalid or already used QR number'; end if;
  if m.student_hash <> encode(extensions.digest(lower(trim(coalesce(new.raw_user_meta_data->>'student_no',''))),'sha256'),'hex') then raise exception 'Student number does not match the member record'; end if;
  insert into profiles(id,username,name,nickname,team,consent) values(new.id,new.raw_user_meta_data->>'username',m.full_name,m.nickname,coalesce(new.raw_user_meta_data->>'team','v'),true);
  insert into profiles_private(id,birthday_enc,student_no_enc) values(new.id,extensions.pgp_sym_encrypt(coalesce(new.raw_user_meta_data->>'birthday',''),pii_key()),m.student_no_enc);
  update member_roster set claimed_by=new.id where id=m.id;
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'birthday' - 'student_no' - 'qr' where id=new.id;
  return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function new_user();

-- ===== v3: permanent QR numbers, positions, paging, instant admin =====
alter table member_roster add column position text;
create function lock_qr() returns trigger language plpgsql as $$ begin
  if new.qr_number is distinct from old.qr_number then raise exception 'QR numbers can never be changed'; end if; return new; end $$;
create trigger roster_qr_locked before update on member_roster for each row execute function lock_qr();
drop function regen_qr(bigint); drop function delete_roster(bigint); drop function roster_list(); drop function import_roster(jsonb); drop function my_id();
create function import_roster(rows jsonb) returns int language plpgsql security definer as $$ declare r jsonb; h text; n int:=0; begin
  if not can_edit() then raise exception 'Admins only'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    continue when coalesce(trim(r->>'student_no'),'')='' or coalesce(trim(r->>'full_name'),'')='';
    h:=encode(extensions.digest(lower(trim(r->>'student_no')),'sha256'),'hex');
    continue when exists(select 1 from member_roster where student_hash=h);
    insert into member_roster(student_no_enc,student_hash,full_name,nickname,position,qr_number) values(extensions.pgp_sym_encrypt(trim(r->>'student_no'),pii_key()),h,trim(r->>'full_name'),coalesce(nullif(trim(r->>'nickname'),''),split_part(trim(r->>'full_name'),' ',1)),nullif(trim(r->>'position'),''),gen_qr());
    n:=n+1; end loop;
  insert into audit_log(actor,action,detail) values(auth.uid(),'import_roster',n::text); return n; end $$;
create function roster_list(q text default '', lim int default 200) returns table(id bigint, student_no text, full_name text, nickname text, position text, qr_number text, claimed boolean) language sql security definer as $$
  select m.id, extensions.pgp_sym_decrypt(m.student_no_enc,pii_key()), m.full_name, m.nickname, m.position, m.qr_number, m.claimed_by is not null from member_roster m
  where can_edit() and (coalesce(q,'')='' or m.full_name ilike '%'||q||'%' or m.nickname ilike '%'||q||'%' or m.qr_number ilike '%'||q||'%' or m.student_hash=encode(extensions.digest(lower(trim(q)),'sha256'),'hex'))
  order by m.id desc limit least(coalesce(lim,200),100000) $$;
create function roster_stats() returns table(total bigint, claimed bigint) language sql security definer as $$ select count(*), count(claimed_by) from member_roster where can_edit() $$;
-- names, nicknames and positions of members who have not signed up yet can be corrected; QR and student numbers never change
create function update_roster(rid bigint, fn text, nn text, pos text) returns void language plpgsql security definer as $$ begin
  if not can_edit() then raise exception 'Admins only'; end if;
  update member_roster set full_name=trim(fn), nickname=trim(nn), position=nullif(trim(pos),'') where id=rid and claimed_by is null; end $$;
-- only the signed-in owner can read their own ID data (position follows the Legacies page when the name matches a current officer)
create function my_id() returns table(qr_number text, student_no text, full_name text, nickname text, position text, team text) language sql security definer as $$
  select m.qr_number, extensions.pgp_sym_decrypt(m.student_no_enc,pii_key()), m.full_name, m.nickname,
    coalesce((select lp.position from legacy_people lp where lp.kind='officer' and lp.term=cur_term() and lower(trim(lp.name))=lower(trim(m.full_name)) limit 1), nullif(m.position,''), 'Member'),
    (select p.team from profiles p where p.id=auth.uid())
  from member_roster m where m.claimed_by=auth.uid() $$;
-- the admin is created with `npm run create-admin` (service key sets app_metadata.bootstrap_admin; clients cannot set it), so no QR number or sign-up is needed
create or replace function new_user() returns trigger language plpgsql security definer as $$ declare m member_roster; begin
  if coalesce(new.raw_app_meta_data->>'bootstrap_admin','')='true' then
    insert into profiles(id,username,name,nickname,team,role,admin_role,consent) values(new.id,coalesce(new.raw_user_meta_data->>'username','admin'),coalesce(new.raw_user_meta_data->>'name','Chapter Admin'),'Admin','s','officer','creator',true);
    insert into profiles_private(id,birthday_enc,student_no_enc) values(new.id,extensions.pgp_sym_encrypt('',pii_key()),extensions.pgp_sym_encrypt('',pii_key()));
    return new; end if;
  select * into m from member_roster where qr_number=upper(trim(coalesce(new.raw_user_meta_data->>'qr',''))) and claimed_by is null;
  if m.id is null then raise exception 'Invalid or already used QR number'; end if;
  if m.student_hash <> encode(extensions.digest(lower(trim(coalesce(new.raw_user_meta_data->>'student_no',''))),'sha256'),'hex') then raise exception 'Student number does not match the member record'; end if;
  insert into profiles(id,username,name,nickname,team,consent) values(new.id,new.raw_user_meta_data->>'username',m.full_name,m.nickname,coalesce(new.raw_user_meta_data->>'team','v'),true);
  insert into profiles_private(id,birthday_enc,student_no_enc) values(new.id,extensions.pgp_sym_encrypt(coalesce(new.raw_user_meta_data->>'birthday',''),pii_key()),m.student_no_enc);
  update member_roster set claimed_by=new.id where id=m.id;
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'birthday' - 'student_no' - 'qr' where id=new.id;
  return new; end $$;
