/** Database contract for migrations 001–003. Public specification views use invoker RLS. */
import type { Branding, Preferences, Metrics } from "./types";
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json | undefined };
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};
type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  google_url: string;
  google_review_url: string;
  owner_email: string;
  template: string;
  reminder_days: number;
  notifications: boolean;
  created_at: string;
  industry_category: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  google_place_id: string | null;
  branding_config: Branding;
  plan_tier: "standard" | "premium";
  setup_fee_cents: number;
  setup_fee_paid_at: string | null;
  notification_preferences: Preferences;
};
type CustomerRow = {
  id: string;
  org_id: string;
  organization_id: string;
  name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  email_consent: boolean;
  sms_consent: boolean;
  consent_given: boolean;
  consent_at: string | null;
  consent_timestamp: string | null;
  consent_source: "csv_import" | "manual_entry" | "counter_qr" | null;
  opted_out: boolean;
  opted_out_sms: boolean;
  opted_out_email: boolean;
  opted_out_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
};
type RequestRow = {
  id: string;
  org_id: string;
  customer_id: string;
  token: string;
  short_token: string | null;
  channel: "sms" | "email" | "multi_channel";
  status:
    | "queued"
    | "sent"
    | "delivered"
    | "failed"
    | "clicked"
    | "completed"
    | "opted_out";
  clicked_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  next_followup_at: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
};
type MessageRow = {
  id: string;
  org_id: string;
  request_id: string;
  step: number;
  channel: "sms" | "email";
  status:
    | "queued"
    | "processing"
    | "sent"
    | "delivered"
    | "failed"
    | "cancelled"
    | "unknown";
  due_at: string;
  provider_id: string | null;
  error: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};
type ReviewRow = {
  id: string;
  org_id: string;
  author: string;
  rating: number;
  body: string;
  published_at: string;
  created_at: string;
  external_review_id: string | null;
  reviewer_avatar_url: string | null;
  owner_reply_draft: string;
  reply_status: "none" | "draft" | "reviewed" | "posted_manually";
  displayed_on_widget: boolean;
};
type FeedbackRow = {
  id: string;
  org_id: string;
  request_id: string | null;
  customer_id: string | null;
  body: string;
  contact_preference: "none" | "email" | "sms";
  resolved: boolean;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      organizations: Table<OrganizationRow, "name" | "owner_email">;
      memberships: Table<
        {
          user_id: string;
          org_id: string;
          role: "owner" | "staff" | "operator_admin";
        },
        "user_id" | "org_id"
      >;
      operators: Table<{ user_id: string }, "user_id">;
      customers: Table<CustomerRow, "org_id" | "name">;
      requests: Table<RequestRow, "org_id" | "customer_id" | "channel">;
      messages: Table<
        MessageRow,
        "org_id" | "request_id" | "channel" | "step" | "due_at"
      >;
      reviews: Table<
        ReviewRow,
        "id" | "org_id" | "author" | "rating" | "published_at"
      >;
      feedback: Table<FeedbackRow, "org_id" | "body">;
      review_stats: Table<
        {
          org_id: string;
          total: number;
          average: number | null;
          synced_at: string;
        },
        "org_id" | "total"
      >;
      google_connections: Table<
        {
          org_id: string;
          refresh_token: string;
          location: string;
          last_sync: string | null;
        },
        "org_id" | "refresh_token"
      >;
      notifications: Table<
        { id: string; org_id: string; review_id: string; emailed: boolean },
        "org_id" | "review_id"
      >;
      message_templates: Table<
        {
          id: string;
          organization_id: string;
          name: string;
          channel: "sms" | "email";
          sequence_step: 1 | 2;
          delay_hours: number;
          subject: string | null;
          body: string;
        },
        "organization_id" | "name" | "channel" | "sequence_step" | "body"
      >;
      compliance_events: Table<
        {
          id: string;
          organization_id: string;
          customer_id: string | null;
          event: string;
          channel: string | null;
          source: string;
          evidence: Json;
          created_at: string;
        },
        "organization_id" | "event" | "source"
      >;
      suppressions: Table<
        { destination: string; created_at: string },
        "destination"
      >;
      channel_suppressions: Table<
        { destination: string; channel: "sms" | "email"; created_at: string },
        "destination" | "channel"
      >;
      notification_jobs: Table<
        {
          id: string;
          organization_id: string;
          event_key: string;
          kind: string;
          subject: string;
          body: string;
          channel: "sms" | "email";
          status: "queued" | "sending" | "sent" | "failed" | "unknown";
          error: string | null;
          created_at: string;
        },
        | "organization_id"
        | "event_key"
        | "kind"
        | "subject"
        | "body"
        | "channel"
      >;
      monthly_reports: Table<
        {
          id: string;
          organization_id: string;
          month: string;
          metrics: Metrics;
          created_at: string;
        },
        "organization_id" | "month" | "metrics"
      >;
    };
    Views: {
      organization_members: {
        Row: { user_id: string; organization_id: string; role: string };
        Relationships: [];
      };
      review_requests: {
        Row: Omit<RequestRow, "org_id" | "token"> & { organization_id: string };
        Relationships: [];
      };
      google_reviews: {
        Row: {
          id: string;
          organization_id: string;
          external_review_id: string | null;
          reviewer_name: string;
          reviewer_avatar_url: string | null;
          star_rating: number;
          comment: string;
          published_at: string;
          owner_reply_draft: string;
          reply_status: string;
          displayed_on_widget: boolean;
        };
        Relationships: [];
      };
      private_feedback: {
        Row: Omit<FeedbackRow, "org_id" | "request_id" | "body"> & {
          organization_id: string;
          review_request_id: string | null;
          message: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      onboard: { Args: { business: string }; Returns: string };
      my_org: { Args: Record<string, never>; Returns: string | null };
      is_operator: { Args: Record<string, never>; Returns: boolean };
      has_org: { Args: { oid: string }; Returns: boolean };
      manages_org: { Args: { oid: string }; Returns: boolean };
      enqueue_review: {
        Args: { oid: string; cid: string; ch: string };
        Returns: string;
      };
      claim_messages: {
        Args: { request_filter?: string | null };
        Returns: MessageRow[];
      };
      suppress_contact: {
        Args: {
          destination_value: string;
          channel_value: string;
          source_value: string;
        };
        Returns: undefined;
      };
      unsubscribe_request: {
        Args: { request_token: string };
        Returns: undefined;
      };
      dashboard_metrics: {
        Args: { oid: string; start_at?: string; end_at?: string };
        Returns: Metrics | null;
      };
      import_customers: {
        Args: { oid: string; rows_json: Json };
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
