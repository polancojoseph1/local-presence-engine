import Link from "next/link";
export default function DemoGoogle() {
  return (
    <main className="public-card">
      <span className="eyebrow">DEMONSTRATION ONLY</span>
      <h1>One tap to Google.</h1>
      <p>
        For a connected business, the button opens its real Google review form
        immediately. This fictional shop does not collect public reviews.
      </p>
      <p>
        Every customer receives the same review option, regardless of their
        experience.
      </p>
      <Link className="button" href="/r/demo-visit">
        Back to customer view
      </Link>
      <p>
        <Link href="/dashboard">Open owner dashboard</Link>
      </p>
    </main>
  );
}
