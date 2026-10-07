import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * The AI Assistant pane, LOCKED in CS1 (`design/templates/console/studio/SPEC.md`;
 * docs/COURSE-STUDIO-PLAN.md, rulings 4 and 7, and the assistant's round six):
 * the AI runs through each teacher's own app on their own keys, and that app
 * does not exist yet. So the pane says so, plainly, and offers NO control:
 * there is nothing to do yet, and a button that did nothing would be a dead
 * end (DESIGN-MANDATE §1). CS3 replaces the first sentence with "No AI
 * Assistant connected with this device. Download here and install" when the
 * app exists. Neutral, not a warning: nothing is wrong.
 */
export function AiPane() {
  return (
    <section className="st-ai-body" aria-labelledby="st-ai-title" data-ai-pane>
      <div className="st-ai-head">
        <h2 id="st-ai-title" className="st-outline-h2">AI Assistant</h2>
        <Badge tone="neutral"><Lock className="mr-1 h-3 w-3" aria-hidden="true" />Locked</Badge>
      </div>
      <p className="st-ai-lede">The AI Assistant app is not released yet.</p>
      <p className="ct-faint st-ai-text">
        When it is, you will install it on your laptop and connect it here. It checks a chapter, and every change it
        suggests is a proposal you accept or discard. Nothing reaches students without a teacher&apos;s approval.
      </p>
      <h3 className="st-ai-h3">What it will check</h3>
      <ul className="st-ai-list">
        <li>against the book: quotes, facts and figures</li>
        <li>against the syllabus: every objective taught and asked</li>
        <li>against your students&apos; results: where they keep failing</li>
        <li>the writing: clear, no padding, the right level, consistent terms</li>
      </ul>
    </section>
  );
}
