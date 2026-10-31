"use client";
import { useState } from "react";
export default function UnsubscribeButton({
  token,
  demo,
}: {
  token: string;
  demo: boolean;
}) {
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="text-button"
        type="button"
        disabled={busy || state.startsWith("You’re unsubscribed")}
        onClick={async () => {
          setBusy(true);
          try {
            if (!demo) {
              const r = await fetch(
                `/api/unsubscribe?t=${encodeURIComponent(token)}`,
                { method: "POST" },
              );
              if (!r.ok)
                throw new Error("Could not unsubscribe. Please try again.");
            }
            setState(
              "You’re unsubscribed from future requests from this business.",
            );
          } catch (e) {
            setState(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Unsubscribe from future requests
      </button>
      <p role="status">{state}</p>
    </div>
  );
}
