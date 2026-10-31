import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("database tenant isolation, consent enforcement, deduplication and queue claims", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text,'-',''),'hex')$$;`,
    );
    const sql = (
      await readFile(
        new URL("../supabase/migrations/001_initial.sql", import.meta.url),
        "utf8",
      )
    ).replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
    await db.exec(
      `grant usage on schema public,auth to authenticated;grant select on all tables in schema public to authenticated;insert into auth.users values ('11111111-1111-4111-8111-111111111111','a@example.com'),('22222222-2222-4222-8222-222222222222','b@example.com');set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set role authenticated;`,
    );
    const a = await db.query<{ id: string }>(
      `select onboard('Business A') as id`,
    );
    await db.exec(
      `reset role;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';set role authenticated;`,
    );
    const b = await db.query<{ id: string }>(
      `select onboard('Business B') as id`,
    );
    const aid = a.rows[0].id,
      bid = b.rows[0].id;
    await db.exec("reset role");
    await db.query(
      `update organizations set google_url='https://g.page/example'`,
    );
    const customers = await db.query<{ id: string }>(
      `insert into customers(org_id,name,email,email_consent) values($1,'Jane','jane@example.com',true),($2,'John','john@example.com',false) returning id`,
      [aid, bid],
    );
    const cid = customers.rows[0].id,
      other = customers.rows[1].id;
    await db.exec(
      `set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set role authenticated`,
    );
    assert.equal(
      (await db.query("select * from organizations")).rows.length,
      1,
    );
    assert.equal((await db.query("select * from customers")).rows.length, 1);
    await assert.rejects(
      db.query(`select enqueue_review($1,$2,'email')`, [aid, other]),
    );
    await assert.rejects(
      db.query(`select enqueue_review($1,$2,'sms')`, [aid, cid]),
    );
    await db.query(`select enqueue_review($1,$2,'email')`, [aid, cid]);
    await assert.rejects(
      db.query(`select enqueue_review($1,$2,'email')`, [aid, cid]),
    );
    await assert.rejects(
      db.query(`insert into customers(org_id,name) values($1,'Intruder')`, [
        bid,
      ]),
    );
    assert.equal(
      (await db.query("select * from google_connections")).rows.length,
      0,
    );
    await db.exec("reset role");
    const first = await db.query("select * from claim_messages()");
    assert.equal(first.rows.length, 1);
    assert.equal(
      (await db.query("select * from claim_messages()")).rows.length,
      0,
    );
    await db.query(
      `insert into suppressions(destination) values('jane@example.com')`,
    );
    await db.query("update customers set opted_out=false where id=$1", [cid]);
    const suppressed = await db.query<{ opted_out: boolean }>(
      "select opted_out from customers where id=$1",
      [cid],
    );
    assert.equal(suppressed.rows[0].opted_out, true);
    await db.exec(
      `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';set role authenticated`,
    );
    await assert.rejects(
      db.query(`select enqueue_review($1,$2,'email')`, [bid, other]),
    );
    assert.equal((await db.query("select * from requests")).rows.length, 0);
  } finally {
    await db.close();
  }
});
