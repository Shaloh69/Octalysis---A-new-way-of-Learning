/**
 * The four grading periods, NAMED.
 *
 * D-3 is resolved (instructor's ruling, 2 Sep 2026): Prelim covers chapters
 * 1-4, Midterm 5-8, Semi-finals 9-12, Finals 13-17. `db/schema.sql` was carrying
 * a one-stage drift and has been corrected to match, which matters beyond
 * labelling because the examination blueprints scope by `by_act`.
 *
 * Until that ruling this printed a bare Roman numeral, because three sources
 * gave three groupings and a wrong name is worse than no name -- a student
 * would have planned a review week around it. There is one answer now, so the
 * name is printed.
 *
 * THE FINALS IS CUMULATIVE and says so. It is the one period whose name does
 * not describe its scope: it covers the whole course, not only chapters 13-17,
 * and a student who reads "Finals 13-17" and revises only those chapters has
 * been misled by the label. The seed's Final Examination blueprint already
 * weights all four acts.
 */
export const ACT_NAMES: Record<number, string> = {
  1: "Prelim",
  2: "Midterm",
  3: "Semi-finals",
  4: "Finals",
};

/** Shown beside the Finals only. The other three are scoped to themselves. */
export const ACT_NOTE: Record<number, string> = {
  4: "cumulative — covers the whole course",
};
