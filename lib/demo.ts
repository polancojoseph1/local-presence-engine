import type { Organization } from "./types";
export const demoOrg: Organization = {
  id: "demo",
  name: "Brooklyn Corner Barbers",
  slug: "brooklyn-corner-demo",
  brand_color: "#5369e8",
  google_url:
    "https://search.google.com/local/writereview?placeid=DEMO_NOT_A_REAL_BUSINESS",
  plan_tier: "premium",
  address: "123 Demo Avenue, Brooklyn, NY",
  timezone: "America/New_York",
  branding_config: {
    welcome_headline: "How was your visit?",
    counter_cta: "Share your honest experience",
  },
  notification_preferences: {
    review_email: true,
    feedback_email: true,
    monthly_report: true,
  },
  template:
    "Hi {{name}}, thanks for visiting {{business}}! Share your experience: {{link}}",
  reminder_days: 3,
  notifications: true,
};
export const demoCustomers = [
  ["1", "Olivia Martinez", "olivia@example.com", "+12025550101"],
  ["2", "James Wilson", "james@example.com", "+12025550102"],
  ["3", "Sophia Chen", "sophia@example.com", "+12025550103"],
  ["4", "Noah Thompson", "noah@example.com", "+12025550104"],
  ["5", "Emma Davis", "emma@example.com", "+12025550105"],
].map(([id, name, email, phone], i) => ({
  id,
  name,
  email,
  phone,
  email_consent: true,
  sms_consent: true,
  opted_out: i === 4,
  created_at: new Date().toISOString(),
}));
export const demoReviews = [
  {
    id: "1",
    author: "Olivia M.",
    rating: 5,
    body: "Such a lovely experience from start to finish. The team really listens, and I left feeling like a whole new person!",
    published_at: "2026-10-30T12:00:00Z",
  },
  {
    id: "2",
    author: "James W.",
    rating: 5,
    body: "My go-to spot. Always a warm welcome and a great haircut. Can’t recommend them enough.",
    published_at: "2026-10-29T12:00:00Z",
  },
  {
    id: "3",
    author: "Sophia C.",
    rating: 4,
    body: "Beautiful space and a really friendly team. A little wait, but absolutely worth it.",
    published_at: "2026-10-28T12:00:00Z",
  },
];

export type { Organization, DashboardData } from "./types";
