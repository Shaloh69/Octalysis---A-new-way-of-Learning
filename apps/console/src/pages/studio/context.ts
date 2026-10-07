import { useOutletContext } from "react-router-dom";
import type { StudioSubjectsResponse } from "@octa/contracts";
import type { ContentStatus } from "@/lib/api";

/** What the Studio's layout loads once and hands to whichever view is in the editor pane. */
export interface StudioCtx {
  subjects: StudioSubjectsResponse | undefined;
  subjectsError: string | null;
  content: ContentStatus | undefined;
  contentError: string | null;
  reloadSubjects: () => void;
  reloadContent: () => void;
  /** After a write that changes more than one view: subjects and chapters both. */
  reloadAll: () => void;
  /** Opens the dialog that adds a subject (the outline's + and the subject view's). */
  addSubject: () => void;
}

export const useStudio = () => useOutletContext<StudioCtx>();
