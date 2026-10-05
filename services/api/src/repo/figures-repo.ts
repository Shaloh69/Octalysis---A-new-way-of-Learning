import type { Db } from "../db.js";
import type { StudentFigure } from "../serialize/student.js";

/**
 * The approved figures of a set of items, keyed by item id (6 Oct 2026,
 * docs/FIGURES-AND-AUDIO.md). Only `approved_svg` is read: an item can only be
 * live with an approved figure, and a figure redrawn since keeps serving the
 * drawing that was approved until the new one is.
 */
export async function loadItemFigures(db: Db, itemIds: readonly string[]): Promise<Map<string, StudentFigure>> {
  const out = new Map<string, StudentFigure>();
  if (itemIds.length === 0) return out;
  const { rows } = await db.query(
    `select i.id as item_id, f.title, f.approved_svg
       from items i join figures f on f.id = i.figure_id
      where i.id = any($1::uuid[]) and f.approved_svg is not null`,
    [itemIds],
  );
  for (const r of rows) out.set(r.item_id as string, { title: r.title as string, svg: r.approved_svg as string });
  return out;
}
