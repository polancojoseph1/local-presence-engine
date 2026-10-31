import { admin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { publicBusiness } from "@/lib/public";
export default async function Widget({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await publicBusiness(slug);
  if (!data) notFound();
  const { org: o, demo } = data;
  let reviews = data.reviews,
    stats = data.stats;
  if (!demo) {
    const db = admin();
    const [{ data: r, error: re }, { data: s, error: se }] = await Promise.all([
      db
        .from("reviews")
        .select("id,author,rating,body,published_at")
        .eq("org_id", o.id)
        .eq("displayed_on_widget", true)
        .order("published_at", { ascending: false })
        .limit(6),
      db
        .from("review_stats")
        .select("total,average")
        .eq("org_id", o.id)
        .maybeSingle(),
    ]);
    if (re || se) throw re || se;
    reviews = r || [];
    stats = s || undefined;
  }
  return (
    <main
      className="widget"
      style={{ "--brand": o.brand_color } as React.CSSProperties}
    >
      {demo && <p>Demo · sample reviews</p>}
      <h2>Experiences at {o.name}</h2>
      <p>
        <strong>{stats?.average?.toFixed(1) || "—"} ★</strong> ·{" "}
        {stats?.total ?? 0} Google reviews
      </p>
      <a
        className="button"
        href={demo ? "/demo/google-review" : o.google_url}
        target="_blank"
        rel="noreferrer"
      >
        Review us on Google ↗
      </a>
      <div className="widget-grid">
        {reviews?.map((r) => (
          <article className="card" key={r.id}>
            <span className="stars" aria-label={`${r.rating} stars`}>
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </span>
            <p>{r.body || "Reviewed on Google"}</p>
            <b>{r.author}</b>
            <p className="small">{demo ? "Sample review" : "Google review"}</p>
          </article>
        ))}
      </div>
      <p className="small">
        Recent reviews. Every customer can review us on Google.
      </p>
    </main>
  );
}
