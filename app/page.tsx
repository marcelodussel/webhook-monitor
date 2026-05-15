import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: {
    absolute: "Hookline — Serverless webhook infrastructure on AWS",
  },
  description:
    "A webhook observability platform built on AWS Lambda, API Gateway, DynamoDB and S3. Capture, inspect, and replay webhook traffic at scale.",
  openGraph: {
    title: "Hookline — Serverless webhook infrastructure on AWS",
    description:
      "Event-driven webhook ingestion, archival, and replay. Built with Next.js, TypeScript and AWS SAM.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hookline — Serverless webhook infrastructure on AWS",
    description:
      "Event-driven webhook ingestion, archival, and replay. Built with Next.js, TypeScript and AWS SAM.",
  },
};

export default function Home() {
  return <LandingPage />;
}
