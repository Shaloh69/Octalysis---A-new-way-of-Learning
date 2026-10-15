import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useIdentity } from "@/pages/teachers/parts";

/**
 * T2: does the signed-in teacher hold a class? A page about students that comes back empty asks this, so it
 * can say "you don't hold a class yet" rather than "nothing here yet". True only once the answer is in,
 * and never for the admin, whose pages show other teachers' classes read-only whether or not they hold one.
 */
export function useHoldsNoClass(): boolean {
  const admin = useIdentity().role === "admin";
  const mine = useAsync(() => api.myClasses(), []);
  return !admin && mine.data !== null && mine.data.classes.length === 0;
}
