import { SortEncounter } from "./SortEncounter";
import { TWO_COLUMNS } from "./two-columns";

/** Moon 01.2's encounter (WEB-REVAMP 3.6, approved 30 Sep 2026). Lazy: see registry.ts. */
export default function TwoColumns(): JSX.Element {
  return (
    <SortEncounter
      title="Two Columns"
      intro="Put each design decision where it belongs: in the architecture a program can see, or in the organization underneath. Then compare your sort with the book."
      cards={TWO_COLUMNS}
    />
  );
}
