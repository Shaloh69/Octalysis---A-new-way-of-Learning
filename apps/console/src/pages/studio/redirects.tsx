import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { chapterPath } from "@/lib/studio-view";

/**
 * `/content` and `/content/:stageId` became Course Studio (CS1, 7 Oct 2026), so
 * a link a teacher saved, or one in an old audit entry or a doc, still lands
 * on the same thing: the chapter list, the summaries (`?view=summaries`), or
 * the chapter. Replaced, not pushed: Back must not return to the redirect.
 */
export function ContentRedirect() {
  const [p] = useSearchParams();
  return <Navigate to={p.get("view") === "summaries" ? "/studio/review" : "/studio"} replace />;
}

export function ChapterRedirect() {
  const { stageId = "" } = useParams();
  return <Navigate to={chapterPath(stageId)} replace />;
}
