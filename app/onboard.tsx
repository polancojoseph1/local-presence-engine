"use client";
import { useState } from "react";
export default function Onboard() {
  const [error, setError] = useState("");
  return (
    <main className="public-card">
      <div className="wordmark">◉ LocalLoop</div>
      <h1>Let’s meet your business.</h1>
      <p>Create your workspace, then connect your Google Business Profile.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get("name");
          const r = await fetch("/api/onboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (r.ok) location.reload();
          else setError((await r.json()).error);
        }}
      >
        <label>
          Business name
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Oak & Ivy Salon"
          />
        </label>
        <button>Create workspace →</button>
        <p role="alert">{error}</p>
      </form>
    </main>
  );
}
