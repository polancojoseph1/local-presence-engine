import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  messageBody,
  customerSchema,
  normalizePhone,
  googleLink,
  eligible,
} from "../lib/core";
test("sender identification, normalization, direct links and consent evidence", () => {
  assert.equal(normalizePhone("(212) 555-0123"), "+12125550123");
  assert.equal(googleLink("https://g.page/"), false);
  assert.equal(googleLink("https://g.page/r/example/review"), true);
  assert.equal(
    customerSchema.safeParse({
      name: "A",
      email: "a@example.com",
      email_consent: true,
    }).success,
    false,
  );
  const body = messageBody(
    "Please review: {{review_link}}",
    "Alex",
    "My Shop",
    "https://example.com",
    "Reply STOP to opt out.",
  );
  assert.match(body, /^My Shop:/);
  assert.match(body, /Reply STOP/);
  assert.equal(
    eligible(
      {
        opted_out: false,
        opted_out_sms: true,
        sms_consent: true,
        email_consent: true,
        phone: "+12125550123",
        email: "a@example.com",
      },
      "sms",
    ),
    false,
  );
});
test("upgraded schema: roles, multi-tenant metrics, immediate cancellation, seed, templates and reports", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text,'-',''),'hex')$$;`,
    );
    for (const file of (
      await readdir(new URL("../supabase/migrations/", import.meta.url))
    ).sort()) {
      await db.exec(
        (
          await readFile(
            new URL("../supabase/migrations/" + file, import.meta.url),
            "utf8",
          )
        ).replace("create extension if not exists pgcrypto;", ""),
      );
    }
    await db.exec(
      `grant usage on schema public,auth to authenticated;grant select on all tables in schema public to authenticated;insert into auth.users values('11111111-1111-4111-8111-111111111111','a@example.com'),('22222222-2222-4222-8222-222222222222','b@example.com');set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set role authenticated;`,
    );
    const a = (await db.query<{ id: string }>(`select onboard('A') id`)).rows[0]
      .id;
    await db.exec(
      `reset role;set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';set role authenticated`,
    );
    const b = (await db.query<{ id: string }>(`select onboard('B') id`)).rows[0]
      .id;
    await db.exec("reset role");
    await db.query(
      `update organizations set google_url='https://g.page/r/example/review'`,
    );
    await assert.rejects(
      db.query(
        `insert into customers(org_id,name,email,email_consent) values($1,'No proof','none@example.com',true)`,
        [a],
      ),
    );
    const c = (
      await db.query<{ id: string }>(
        `insert into customers(org_id,name,email,phone,email_consent,sms_consent,consent_at,consent_source) values($1,'Alex','alex@example.com','+12125550123',true,true,now(),'manual_entry') returning id`,
        [a],
      )
    ).rows[0].id;
    await db.exec(
      `set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set role authenticated`,
    );
    assert.equal(
      (await db.query("select * from organizations")).rows.length,
      1,
    );
    assert.equal(
      (await db.query<{ m: unknown }>(`select dashboard_metrics($1) m`, [b]))
        .rows[0].m,
      null,
    );
    await assert.rejects(
      db.query(`select enqueue_review($1,$2,'email')`, [b, c]),
    );
    const rid = (
      await db.query<{ id: string }>(
        `select enqueue_review($1,$2,'multi_channel') id`,
        [a, c],
      )
    ).rows[0].id;
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from messages where request_id=$1", [rid])).rows
        .length,
      4,
    );
    await db.exec("set role authenticated");
    assert.equal(
      (
        await db.query<{ m: { contacted: number } }>(
          `select dashboard_metrics($1) m`,
          [a],
        )
      ).rows[0].m.contacted,
      0,
    );
    await db.exec("reset role");
    await db.query(
      `update messages set status='sent',sent_at=now() where request_id=$1 and channel='email' and step=0`,
      [rid],
    );
    await db.exec("set role authenticated");
    assert.equal(
      (
        await db.query<{ m: { contacted: number } }>(
          `select dashboard_metrics($1) m`,
          [a],
        )
      ).rows[0].m.contacted,
      1,
    );
    await db.exec("reset role");
    await db.query(`select suppress_contact('+12125550123','sms','test')`);
    assert.equal(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from messages where request_id=$1 and channel='sms' and status='cancelled'`,
          [rid],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from messages where request_id=$1 and channel='email' and status='queued'`,
          [rid],
        )
      ).rows[0].n,
      1,
    );
    await db.query(`update requests set clicked_at=now() where id=$1`, [rid]);
    assert.equal(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from messages where request_id=$1 and step=1 and status='queued'`,
          [rid],
        )
      ).rows[0].n,
      0,
    );
    // Import failures roll back the entire batch, and reimports preserve opt-outs.
    const before = (
      await db.query<{ n: number }>(
        `select count(*)::int n from customers where org_id=$1`,
        [a],
      )
    ).rows[0].n;
    await assert.rejects(
      db.query(`select import_customers($1,$2::jsonb)`, [
        a,
        JSON.stringify([
          { name: "Valid", email: "valid@example.com" },
          {
            name: "Missing evidence",
            email: "proof@example.com",
            email_consent: true,
          },
        ]),
      ]),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from customers where org_id=$1`,
          [a],
        )
      ).rows[0].n,
      before,
    );
    await db.query(`select import_customers($1,$2::jsonb)`, [
      a,
      JSON.stringify([
        {
          name: "Alex Updated",
          email: "alex@example.com",
          sms_consent: false,
          email_consent: false,
        },
      ]),
    ]);
    const preserved = (
      await db.query<{ opted_out_sms: boolean; sms_consent: boolean }>(
        `select opted_out_sms,sms_consent from customers where id=$1`,
        [c],
      )
    ).rows[0];
    assert.equal(preserved.opted_out_sms, true);
    assert.equal(preserved.sms_consent, true);
    await db.exec(`set role authenticated`);
    await assert.rejects(
      db.query(`select import_customers($1,'[]'::jsonb)`, [a]),
    );
    await db.exec("reset role");
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    assert.equal(
      (await db.query(`select * from requests where short_token='demo-visit'`))
        .rows.length,
      1,
    );
    await db.exec(
      `set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set role authenticated`,
    );
    assert.equal(
      (await db.query("select * from monthly_reports")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from google_reviews")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        `insert into operators values('11111111-1111-4111-8111-111111111111')`,
      ),
    );
    await db.exec("reset role");
    await db.query(
      `insert into operators values('11111111-1111-4111-8111-111111111111')`,
    );
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from organizations")).rows.length,
      3,
    );
    assert.equal(
      (await db.query("select * from monthly_reports")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
