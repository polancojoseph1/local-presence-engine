"use client";
import { useState, useEffect } from "react";
import type { DashboardData, Customer } from "@/lib/types";
import { defaultTemplate, messageBody } from "@/lib/core";
import Papa from "papaparse";
type Submit = (url: string, body: unknown) => Promise<boolean>;
function FormStatus({ value }: { value: string }) {
  return <p role="status">{value}</p>;
}
export function QuickSend({
  data,
  submit,
}: {
  data: DashboardData;
  submit: Submit;
}) {
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("new");
  return (
    <section className="card asset-detail">
      <h2>Send a review request</h2>
      <p>
        Initial requests send immediately when the provider is configured.
        Follow-ups stop after a review-link click or opt-out.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const channel = String(f.get("channel"));
          const body =
            mode === "existing"
              ? { channel, customer_id: f.get("customer_id") }
              : {
                  channel,
                  customer: {
                    name: f.get("name"),
                    phone: f.get("phone"),
                    email: f.get("email"),
                    sms_consent:
                      f.get("consent") === "on" && channel !== "email",
                    email_consent:
                      f.get("consent") === "on" && channel !== "sms",
                    consent_at: new Date(
                      String(f.get("consent_at")),
                    ).toISOString(),
                    consent_source: "manual_entry",
                  },
                };
          if (await submit("/api/requests/send", body))
            setStatus(
              data.demo
                ? "Demo request preview complete. No message sent."
                : "Request processed. Check delivery details for provider status.",
            );
        }}
      >
        <label>
          Customer source
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="new">New customer</option>
            <option value="existing">Existing customer</option>
          </select>
        </label>
        {mode === "new" ? (
          <>
            <label>
              Name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" placeholder="(212) 555-0123" />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Original consent date/time
              <input name="consent_at" type="datetime-local" required />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="consent" required />
              Customer explicitly consented to review requests on the selected
              channels
            </label>
          </>
        ) : (
          <label>
            Customer
            <select name="customer_id" required>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Channel
          <select name="channel">
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="multi_channel">SMS and email</option>
          </select>
        </label>
        <button>Send review request</button>
        <FormStatus value={status} />
      </form>
    </section>
  );
}
export function TemplateStudio({
  data,
  submit,
}: {
  data: DashboardData;
  submit: Submit;
}) {
  const [channel, setChannel] = useState("sms");
  const [step, setStep] = useState(1);
  const [body, setBody] = useState(defaultTemplate);
  const [subject, setSubject] = useState("How was your visit?");
  const [delay, setDelay] = useState(0);
  const [status, setStatus] = useState("");
  const [templates, setTemplates] = useState<
    {
      channel: string;
      sequence_step: number;
      body: string;
      subject: string;
      delay_hours: number;
    }[]
  >([]);
  useEffect(() => {
    if (!data.demo)
      fetch("/api/templates")
        .then((r) => r.json())
        .then((t) => {
          if (Array.isArray(t)) setTemplates(t);
        });
  }, [data.demo]);
  function choose(ch: string, st: number) {
    setChannel(ch);
    setStep(st);
    const t = templates.find((t) => t.channel === ch && t.sequence_step === st);
    setBody(t?.body || defaultTemplate);
    setSubject(t?.subject || "How was your visit?");
    setDelay(t?.delay_hours ?? (st === 1 ? 0 : 72));
  }
  return (
    <div className="settings-grid">
      <form
        className="card asset-detail"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await submit("/api/templates", {
              name: `${channel} step ${step}`,
              channel,
              sequence_step: step,
              delay_hours: delay,
              subject,
              body,
            })
          )
            setStatus(
              "Template saved. Sender identification and opt-out text are enforced at send time.",
            );
        }}
      >
        <h2>Automated sequence templates</h2>
        <label>
          Channel
          <select
            value={channel}
            onChange={(e) => choose(e.target.value, step)}
          >
            <option>sms</option>
            <option>email</option>
          </select>
        </label>
        <label>
          Step
          <select
            value={step}
            onChange={(e) => choose(channel, Number(e.target.value))}
          >
            <option value={1}>Initial request</option>
            <option value={2}>Follow-up</option>
          </select>
        </label>
        {channel === "email" && (
          <label>
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
            />
          </label>
        )}
        <label>
          Delay after enrollment (hours)
          <input
            type="number"
            min={0}
            max={336}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          />
        </label>
        <label>
          Message
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>
        <p>
          {
            "Variables: {{customer_name}}, {{business_name}}, {{review_link}}, {{opt_out_text}}"
          }
        </p>
        <p>Every SMS includes the business name and STOP instructions.</p>
        <button>Save template</button>
        <FormStatus value={status} />
      </form>
      <section className="card asset-detail">
        <h2>Live mobile preview</h2>
        <div className="message-preview">
          <p>
            {messageBody(
              body,
              "Alex",
              data.org.name,
              "https://your-business.example/r/visit",
              channel === "sms"
                ? "Reply STOP to opt out."
                : "Unsubscribe: https://your-business.example/unsubscribe",
            )}
          </p>
        </div>
        <a
          href={data.demo ? "/r/demo-visit" : `/b/${data.org.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Preview branded customer page ↗
        </a>
      </section>
    </div>
  );
}
export function ImportStudio({ submit }: { submit: Submit }) {
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [enroll, setEnroll] = useState(false);
  const [channel, setChannel] = useState("sms");
  return (
    <section className="card asset-detail">
      <h2>Import customers with column mapping</h2>
      <input
        type="file"
        accept=".csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const p = Papa.parse(text, { header: true });
          setCsv(text);
          setHeaders(p.meta.fields || []);
          setMapping(
            Object.fromEntries((p.meta.fields || []).map((h) => [h, h])),
          );
        }}
      />
      {headers.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await submit("/api/customers/import", {
              csv,
              mapping,
              enroll,
              channel,
            });
          }}
        >
          {[
            "name",
            "phone",
            "email",
            "sms_consent",
            "email_consent",
            "consent_timestamp",
          ].map((key) => (
            <label key={key}>
              {key}
              <select
                value={mapping[key] || ""}
                onChange={(e) =>
                  setMapping({ ...mapping, [key]: e.target.value })
                }
              >
                <option value="">Not mapped</option>
                {headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
          ))}
          <p>
            Use the actual opt-in timestamp in ISO 8601 format. US phone numbers
            are normalized to E.164. Existing contacts retain their consent and
            opt-out state.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={enroll}
              onChange={(e) => setEnroll(e.target.checked)}
            />
            Enroll imported customers in the review sequence
          </label>
          <label>
            Enrollment channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="multi_channel">Both</option>
            </select>
          </label>
          <button>Import customers</button>
        </form>
      )}
    </section>
  );
}
export function BusinessSettings({
  data,
  submit,
}: {
  data: DashboardData;
  submit: Submit;
}) {
  const o = data.org;
  const [logo, setLogo] = useState(o.branding_config?.logo_url || "");
  const [headline, setHeadline] = useState(
    o.branding_config?.welcome_headline || "Your experience matters.",
  );
  return (
    <form
      className="card asset-detail"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const str = (key: string) => String(f.get(key) || "");
        await submit("/api/settings", {
          name: o.name,
          google_url: o.google_url,
          brand_color: str("primary_color"),
          template: o.template,
          reminder_days: o.reminder_days,
          notifications: o.notifications,
          industry_category: str("industry_category"),
          phone: str("phone") || null,
          email: str("email") || null,
          address: str("address"),
          timezone: str("timezone"),
          google_place_id: str("google_place_id"),
          branding_config: {
            logo_url: logo,
            primary_color: str("primary_color"),
            accent_color: str("accent_color"),
            welcome_headline: headline,
            counter_cta: str("counter_cta"),
          },
          plan_tier: str("plan_tier"),
          setup_fee_cents: Math.round(Number(f.get("setup_fee")) * 100),
          setup_fee_paid_at:
            f.get("setup_paid") === "on"
              ? o.setup_fee_paid_at || new Date().toISOString()
              : null,
          notification_preferences: Object.fromEntries(
            [
              "review_email",
              "review_sms",
              "feedback_email",
              "feedback_sms",
              "monthly_report",
            ].map((k) => [k, f.get(k) === "on"]),
          ),
        });
      }}
    >
      <h2>Business, branding and alerts</h2>
      <label>
        Industry
        <select
          name="industry_category"
          defaultValue={o.industry_category || "barbershop"}
        >
          {[
            "barbershop",
            "hair salon",
            "nail salon",
            "auto repair",
            "pet groomer",
            "dry cleaner",
            "tattoo studio",
          ].map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <label>
        Owner notification phone (E.164)
        <input name="phone" defaultValue={o.phone || ""} type="tel" />
      </label>
      <label>
        Owner notification email
        <input
          name="email"
          defaultValue={o.email || o.owner_email || ""}
          type="email"
        />
      </label>
      <label>
        Address
        <input name="address" defaultValue={o.address || ""} />
      </label>
      <label>
        Timezone
        <input
          name="timezone"
          defaultValue={o.timezone || "America/New_York"}
        />
      </label>
      <label>
        Google Place ID
        <input name="google_place_id" defaultValue={o.google_place_id || ""} />
      </label>
      <label>
        Logo URL (HTTPS)
        <input
          type="url"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
        />
      </label>
      <label>
        Primary color
        <input type="color" name="primary_color" defaultValue={o.brand_color} />
      </label>
      <label>
        Accent color
        <input
          type="color"
          name="accent_color"
          defaultValue={o.branding_config?.accent_color || "#e9ba59"}
        />
      </label>
      <label>
        Welcome headline
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={120}
        />
      </label>
      <label>
        Counter card call to action
        <input
          name="counter_cta"
          defaultValue={
            o.branding_config?.counter_cta || "Share your honest experience"
          }
        />
      </label>
      <div className="message-preview">
        {logo && <img src={logo} alt="Brand preview" width={60} height={60} />}
        <h3>{headline}</h3>
        <p>{o.name}</p>
        <button type="button">Leave us a Google Review</button>
      </div>
      <label>
        Service plan
        <select name="plan_tier" defaultValue={o.plan_tier || "standard"}>
          <option value="standard">Standard · $79/month</option>
          <option value="premium">Premium · $129/month</option>
        </select>
      </label>
      <label>
        Setup fee ($)
        <input
          name="setup_fee"
          type="number"
          min={0}
          defaultValue={(o.setup_fee_cents ?? 29900) / 100}
        />
      </label>
      <label className="checkbox">
        <input
          name="setup_paid"
          type="checkbox"
          defaultChecked={!!o.setup_fee_paid_at}
        />
        Setup fee paid
      </label>
      {[
        "review_email",
        "review_sms",
        "feedback_email",
        "feedback_sms",
        "monthly_report",
      ].map((k) => (
        <label key={k} className="checkbox">
          <input
            type="checkbox"
            name={k}
            defaultChecked={
              o.notification_preferences?.[
                k as keyof typeof o.notification_preferences
              ] ?? k.endsWith("email")
            }
          />
          {k.replaceAll("_", " ")}
        </label>
      ))}
      <p>
        Enable SMS owner alerts only for a number you control and consent to
        receive notifications on.
      </p>
      <button>Save business settings</button>
    </form>
  );
}
export function ReportView({ data }: { data: DashboardData }) {
  return (
    <section className="card asset-detail">
      <h2>Monthly local-presence reports</h2>
      {data.org.plan_tier !== "premium" ? (
        <p>
          Premium ($129/month) includes monthly reports and manual response
          assistance.
        </p>
      ) : (
        <>
          <p>
            Completed calendar months are summarized automatically. These
            figures describe review activity; they are not ranking or revenue
            guarantees.
          </p>
          {data.reports?.length ? (
            data.reports.map((r) => (
              <article className="card" key={r.id}>
                <h3>
                  {r.month.slice(0, 7)}
                  {data.demo ? " · Sample report" : ""}
                </h3>
                <dl>
                  {Object.entries(r.metrics).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replaceAll("_", " ")}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <button onClick={() => window.print()}>
                  Print report / Save PDF
                </button>
              </article>
            ))
          ) : (
            <p>
              The first report appears after the next monthly reporting run.
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function ReviewManagement({
  data,
  submit,
}: {
  data: DashboardData;
  submit: Submit;
}) {
  return (
    <section className="card asset-detail">
      <h2>Feedback and manual response assistance</h2>
      {data.feedback.map((f) => (
        <article className="card" key={f.id}>
          <p>{f.body}</p>
          <p>
            Contact: {f.contact_preference || "none"} ·{" "}
            {f.resolved ? "Resolved" : "Open"}
          </p>
          <button
            onClick={() =>
              submit("/api/feedback/resolve", {
                id: f.id,
                resolved: !f.resolved,
              })
            }
          >
            {f.resolved ? "Reopen" : "Mark resolved"}
          </button>
        </article>
      ))}
      {data.reviews.map((r) => (
        <form
          className="card asset-detail"
          key={r.id}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await submit("/api/reviews", {
              id: r.id,
              owner_reply_draft: String(f.get("draft") || ""),
              reply_status: String(f.get("status") || "none"),
              displayed_on_widget: f.get("displayed") === "on",
            });
          }}
        >
          <h3>
            {r.author} · {r.rating} stars
          </h3>
          <label className="checkbox">
            <input
              type="checkbox"
              name="displayed"
              defaultChecked={r.displayed_on_widget !== false}
            />
            Show on website widget
          </label>
          {data.org.plan_tier === "premium" && (
            <>
              <label>
                Manual owner reply draft
                <textarea
                  name="draft"
                  defaultValue={r.owner_reply_draft || ""}
                  maxLength={4000}
                />
              </label>
              <label>
                Assistance status
                <select name="status" defaultValue={r.reply_status || "none"}>
                  {["none", "draft", "reviewed", "posted_manually"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p>
                Copy an approved reply to Google manually. This app never
                generates or posts public replies.
              </p>
            </>
          )}
          <button>Save review settings</button>
        </form>
      ))}
    </section>
  );
}
export function OperatorTools({
  data,
  submit,
}: {
  data: DashboardData;
  submit: Submit;
}) {
  return (
    <section className="card asset-detail">
      <h2>Workspace access</h2>
      {data.isOperator && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await submit("/api/onboard", {
              name: new FormData(e.currentTarget).get("name"),
            });
          }}
        >
          <label>
            New tenant name
            <input name="name" required />
          </label>
          <button>Onboard tenant</button>
        </form>
      )}
      {["owner", "operator_admin"].includes(data.role || "") && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await submit("/api/members", {
              user_id: f.get("user_id"),
              role: f.get("role"),
            });
          }}
        >
          <label>
            Existing authenticated user UUID
            <input name="user_id" required />
          </label>
          <label>
            Role
            <select name="role">
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
              {data.isOperator && (
                <option value="operator_admin">Operator admin</option>
              )}
            </select>
          </label>
          <button>Add member</button>
        </form>
      )}
      <p>
        Operators monitor each tenant through its dashboard and delivery
        details. Global operator access is provisioned by the database
        administrator.
      </p>
    </section>
  );
}
export function CustomerDirectory({ demo }: { demo: boolean }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [opted, setOpted] = useState(false);
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(
      `/api/customers?page=${page}&search=${encodeURIComponent(search)}&opted_out=${opted}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setRows(b.customers);
        setTotal(b.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [demo, page, search, opted]);
  if (demo) return null;
  return (
    <section className="card asset-detail">
      <h2>Full customer directory</h2>
      <label>
        Search all customers
        <input
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={opted}
          onChange={(e) => {
            setPage(0);
            setOpted(e.target.checked);
          }}
        />
        Only opted-out contacts
      </label>
      <p>{total} matching customers</p>
      {rows.map((c) => (
        <article key={c.id}>
          <b>{c.name}</b>
          <p>
            {c.phone} · {c.email}
          </p>
          <p>
            Status: {c.latest_status || "Not contacted"} · Private responses:{" "}
            {c.response_count || 0}
          </p>
          <small>
            SMS:{" "}
            {c.opted_out_sms
              ? "Opted out"
              : c.sms_consent
                ? "Consented"
                : "No consent"}{" "}
            · Email:{" "}
            {c.opted_out_email
              ? "Opted out"
              : c.email_consent
                ? "Consented"
                : "No consent"}
          </small>
        </article>
      ))}
      <button disabled={!page} onClick={() => setPage(page - 1)}>
        Previous
      </button>
      <button
        disabled={(page + 1) * 50 >= total}
        onClick={() => setPage(page + 1)}
      >
        Next
      </button>
      <FormStatus value={error} />
    </section>
  );
}
