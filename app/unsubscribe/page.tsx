"use client";
import { useState } from "react";
export default function Unsubscribe() {
  const [done, setDone] = useState(false);
  return (
    <main className="public-card">
      <h1>{done ? "You’re unsubscribed" : "Stop review requests"}</h1>
      <p>
        {done
          ? "You won’t receive further review requests from this business."
          : "Confirm below to stop future SMS and email review requests."}
      </p>
      {!done && (
        <button
          onClick={async () => {
            const t = new URLSearchParams(location.search).get("t");
            if (t === "demo-visit") {
              setDone(true);
              return;
            }
            const r = await fetch(`/api/unsubscribe?t=${t}`, {
              method: "POST",
            });
            if (r.ok) setDone(true);
            else
              alert("This unsubscribe link is invalid. Contact the business.");
          }}
        >
          Unsubscribe
        </button>
      )}
    </main>
  );
}
