import { LandingNav } from "./nav";
import { LandingHero } from "./hero";
import { LandingArchitecture } from "./architecture";
import { LandingFeatures } from "./features";
import { LandingDecisions } from "./decisions";
import { LandingRequestFlow } from "./request-flow";
import { LandingSecurity } from "./security";
import { LandingEventPreview } from "./event-preview";
import { LandingTechStack } from "./tech-stack";
import { LandingFinalCta } from "./final-cta";
import { LandingFooter } from "./footer";

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <LandingHero />
      <LandingArchitecture />
      <LandingFeatures />
      <LandingDecisions />
      <LandingRequestFlow />
      <LandingSecurity />
      <LandingEventPreview />
      <LandingTechStack />
      <LandingFinalCta />
      <LandingFooter />
    </div>
  );
}
