import { notFound } from "next/navigation";
import Feedback from "./feedback";
import { googleLink } from "@/lib/core";
import { publicBusiness } from "@/lib/public";
export default async function Review({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const data = await publicBusiness(slug, t);
  if (!data) notFound();
  const { org: o, token, demo } = data;
  return (
    <main
      className="public-card"
      style={{ "--brand": o.brand_color } as React.CSSProperties}
    >
      {demo && (
        <p className="demo-bar">
          Interactive sample · no messages or real reviews are submitted
        </p>
      )}
      {o.branding_config?.logo_url ? (
        <img
          src={o.branding_config.logo_url}
          alt={`${o.name} logo`}
          width={80}
          height={80}
        />
      ) : (
        <div className="business-logo">{o.name[0]}</div>
      )}
      <span className="eyebrow">{o.name}</span>
      <h1>
        {o.branding_config?.welcome_headline || "Your experience matters."}
      </h1>
      <p>
        Thank you for choosing {o.name}. Your honest review helps neighbors
        discover us.
      </p>
      {demo ? (
        <a className="button" href="/demo/google-review">
          Leave us a Google Review ↗
        </a>
      ) : googleLink(o.google_url) ? (
        <a
          className="button"
          href={token ? `/api/click?t=${token}` : o.google_url}
        >
          Leave us a Google Review ↗
        </a>
      ) : (
        <p>The business has not configured its Google review destination.</p>
      )}
      <p className="small">
        All experiences are welcome. A Google account is required.
      </p>
      <Feedback token={token} slug={o.slug} demo={demo} />
      <footer>
        {token && (
          <p>
            <a href={`/unsubscribe?t=${token}`}>
              Unsubscribe from future requests
            </a>
          </p>
        )}
        Powered by LocalLoop · No incentives. Just honest feedback.
      </footer>
    </main>
  );
}
