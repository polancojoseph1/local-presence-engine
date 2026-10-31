export type Branding = {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  welcome_headline?: string;
  counter_cta?: string;
};
export type Preferences = {
  review_email?: boolean;
  review_sms?: boolean;
  feedback_email?: boolean;
  feedback_sms?: boolean;
  monthly_report?: boolean;
};
export type Organization = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  google_url: string;
  template: string;
  reminder_days: number;
  notifications: boolean;
  industry_category?: string;
  phone?: string | null;
  email?: string | null;
  owner_email?: string;
  address?: string | null;
  timezone?: string;
  google_place_id?: string | null;
  branding_config?: Branding;
  plan_tier?: "standard" | "premium";
  setup_fee_cents?: number;
  setup_fee_paid_at?: string | null;
  notification_preferences?: Preferences;
};
export type Customer = {
  latest_status?: string;
  response_count?: number;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  email_consent: boolean;
  sms_consent: boolean;
  opted_out: boolean;
  opted_out_sms?: boolean;
  opted_out_email?: boolean;
  consent_at?: string | null;
  consent_source?: string | null;
  created_at: string;
};
export type Review = {
  id: string;
  author: string;
  rating: number;
  body: string;
  published_at: string;
  reviewer_avatar_url?: string | null;
  owner_reply_draft?: string;
  reply_status?: string;
  displayed_on_widget?: boolean;
};
export type Metrics = {
  contacted: number;
  sent: number;
  delivered: number;
  clicked: number;
  requests: number;
  opt_outs: number;
  new_reviews: number;
  feedback: number;
};
export type DashboardData = {
  demo: boolean;
  org: Organization;
  customers: Customer[];
  reviews: Review[];
  requests: {
    id: string;
    customer_id: string;
    channel: string;
    clicked_at: string | null;
    created_at: string;
  }[];
  messages: {
    id: string;
    request_id: string;
    status: string;
    error?: string | null;
  }[];
  feedback: {
    id: string;
    body: string;
    created_at: string;
    resolved?: boolean;
    contact_preference?: string;
  }[];
  stats: { total: number; average: number; synced_at: string } | null;
  googleConnected: boolean;
  metrics?: Metrics;
  organizations?: Organization[];
  role?: string;
  isOperator?: boolean;
  reports?: { id: string; month: string; metrics: Metrics }[];
};
