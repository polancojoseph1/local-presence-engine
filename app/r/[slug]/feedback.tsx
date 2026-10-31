"use client";
import { useState } from "react";
export default function Feedback({
  token,
  slug,
  demo = false,
}: {
  token?: string;
  slug: string;
  demo?: boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <details>
      <summary>Have private feedback for the owner?</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (demo) {
            setMessage(
              "Demo feedback received. In a connected workspace the owner receives an alert.",
            );
            return;
          }
          const r = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token,
              slug,
              body: f.get("body"),
              contact_preference: f.get("contact_preference"),
              website: f.get("website"),
            }),
          });
          setMessage(
            r.ok
              ? "Thank you. Your feedback has been shared with the owner."
              : (await r.json()).error,
          );
        }}
      >
        <label>
          Your feedback
          <textarea name="body" required maxLength={4000} />
        </label>
        <label>
          Contact preference
          <select name="contact_preference">
            <option value="none">No reply needed</option>
            {token && (
              <>
                <option value="email">Email me</option>
                <option value="sms">Text me</option>
              </>
            )}
          </select>
        </label>
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ display: "none" }}
        />
        <button>Send privately</button>
        <p role="status">{message}</p>
      </form>
      <p className="small">
        The Google review button above is always available.
      </p>
    </details>
  );
}
