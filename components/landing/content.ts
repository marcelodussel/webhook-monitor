import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  Database,
  FileCode2,
  GitBranch,
  Globe,
  HardDrive,
  KeyRound,
  Lock,
  Network,
  Shield,
  Terminal,
} from "lucide-react";
import { APP_NAME, INGEST_BASE_URL } from "@/lib/config";

export type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

export const landingFeatures: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: KeyRound,
    title: "Public Webhook Endpoints",
    desc: "Generate token-protected ingest URLs for external webhook providers.",
  },
  {
    icon: Database,
    title: "Payload Persistence",
    desc: "Store queryable metadata in DynamoDB while archiving raw payloads in S3.",
  },
  {
    icon: GitBranch,
    title: "Replay Pipeline",
    desc: "Replay captured requests with sensitive and hop-by-hop header stripping.",
  },
  {
    icon: Activity,
    title: "Structured Observability",
    desc: "Emit structured JSON logs from Lambdas to CloudWatch for ingest, replay, and optional AI paths.",
  },
  {
    icon: Terminal,
    title: "AI-Assisted Inspection",
    desc: "Optionally explain webhook payloads and failures using Gemini with enforced usage caps.",
  },
  {
    icon: FileCode2,
    title: "Infrastructure as Code",
    desc: "AWS infrastructure fully defined using AWS SAM templates.",
  },
];

export function getLandingDecisions(): { title: string; body: string; code: string }[] {
  return [
    {
      title: "Why DynamoDB + S3?",
      body: `Webhook payloads can be large, provider-specific, or binary. ${APP_NAME} stores searchable metadata in DynamoDB while preserving exact raw payload fidelity in S3.`,
      code: "PutItem → events  ·  PutObject → s3://{bucket}/payloads/{event_id}",
    },
    {
      title: "Why Serverless?",
      body: "Webhook traffic is bursty and event-driven. Lambda enables automatic scaling without persistent infrastructure costs.",
      code: "burst-shaped traffic · pay-per-invoke · no always-on servers costs",
    },
    {
      title: "Why Structured Logs?",
      body: "Operational visibility matters. Both Lambdas emit structured JSON logs so you can debug ingest failures, replay attempts, and optional AI explain flows from CloudWatch.",
      code: '{ "lvl":"info", "evt":"ingest.ok", "id":"evt_…", "ms":31 }',
    },
    {
      title: "Replay Safety",
      body: "Replay requests intentionally strip sensitive and hop-by-hop headers to avoid unsafe forwarding behavior.",
      code: "strip: authorization, cookie, host, connection, x-forwarded-*",
    },
  ];
}

export function getRequestFlowLines(): { t: string; d: string }[] {
  const ingestExample = `${INGEST_BASE_URL}/{endpointId}?token=…`;
  return [
    {
      t: "Endpoint created",
      d: "Dashboard → POST /api/endpoints (x-api-key) — id, ingest token, URL returned",
    },
    { t: "Public ingest URL ready", d: ingestExample },
    { t: "Incoming webhook accepted", d: "API Gateway → ingest Lambda (token + endpoint id validated)" },
    { t: "Payload stored in S3", d: "Raw body written to your configured payloads bucket" },
    { t: "Metadata indexed in DynamoDB", d: "table: events  ·  keys: endpoint + time-sorted access" },
    { t: "Event inspected in dashboard", d: "App API → headers · body preview · timing · replay history" },
    { t: "Replay executed safely", d: "App Lambda outbound POST · sanitized headers · host allowlist" },
  ];
}

export const secItems: { icon: LucideIcon; t: string }[] = [
  { icon: KeyRound, t: "x-api-key protected app API" },
  { icon: Lock, t: "Tokenized ingest URLs" },
  { icon: Shield, t: "Replay header sanitization" },
  { icon: HardDrive, t: "S3 private access" },
  { icon: Globe, t: "Configurable CORS" },
  { icon: Activity, t: "CloudWatch observability" },
  { icon: Network, t: "Replay host allowlists" },
  { icon: Lock, t: "Encrypted payload storage" },
];

export const stackGroups: { group: string; items: string[]; emphasis?: boolean }[] = [
  {
    group: "AWS Serverless",
    items: ["AWS Lambda", "API Gateway", "DynamoDB", "S3", "CloudWatch", "AWS SAM"],
    emphasis: true,
  },
  { group: "Application", items: ["Next.js 16", "React 19", "TypeScript"] },
];

export const samplePayload = {
  id: "evt_1NxYZ2eZvKYlo2C0",
  type: "checkout.session.completed",
  api_version: "2024-04-10",
  created: 1715692800,
  data: {
    object: {
      id: "cs_test_a1b2c3d4",
      amount_total: 4200,
      currency: "usd",
      customer_email: "ada@lovelace.dev",
      payment_status: "paid",
      metadata: { plan: "pro", seats: 5 },
    },
  },
};
