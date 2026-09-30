import { setup } from "./rls.js";

/**
 * Full teardown, shared by every suite.
 *
 * Test files run sequentially against ONE database, so a suite that deletes
 * `sections` while another suite's `assessments` still reference them fails on a
 * foreign key. Deleting in dependency order once, in one place, removes a whole
 * class of order-dependent flake.
 *
 * The append-only triggers on `responses` are suspended by name and restored --
 * that works as the table owner and needs no superuser, so this runs against
 * local Docker and Supabase alike.
 *
 * NOTE the scoping on auth.users: an unscoped delete would wipe every real
 * account on whatever database this points at.
 */
export async function resetAll(): Promise<void> {
  await setup(`
    alter table responses disable trigger responses_no_update;
    alter table responses disable trigger responses_no_delete;
    -- Content history is append-only, and the archive trigger writes it on
    -- every block delete: both are suspended here, like the responses triggers.
    alter table content_blocks disable trigger content_blocks_archive;
    alter table content_block_versions disable trigger cbv_no_update;
    alter table content_block_versions disable trigger cbv_no_delete;
    delete from content_block_versions where true;
    -- Before auth.users (reviewed_by) and stage 99 (stage_id).
    delete from stage_summaries    where true;
    -- Content history is append-only and the archive trigger writes it on every
    -- block delete: both are suspended here, like the responses triggers.
    alter table content_blocks disable trigger content_blocks_archive;
    alter table content_block_versions disable trigger cbv_no_update;
    alter table content_block_versions disable trigger cbv_no_delete;
    delete from content_block_versions where true;
    -- Before auth.users (reviewed_by) and stage 99 (stage_id).
    delete from stage_summaries    where true;

    -- feedback FIRST: feedback.item_id references items(id) with no cascade,
    -- so once any suite files a content report, every later reset fails on
    -- "update or delete on table items violates foreign key constraint
    -- feedback_item_id_fkey". That is correct FK behaviour -- production never
    -- deletes an item, it retires one (hard rule 6) -- but the fixtures do.
    -- Lecture Mode (29 Sep 2026): both tables refuse a delete for every role,
    -- and both point at items and auth.users. Suspended by name, as audit_log is.
    alter table live_responses disable trigger live_responses_no_delete;
    alter table live_sessions  disable trigger live_sessions_no_delete;
    delete from live_responses     where true;
    delete from live_sessions      where true;
    alter table live_responses enable trigger live_responses_no_delete;
    alter table live_sessions  enable trigger live_sessions_no_delete;
    delete from feedback           where true;
    delete from feedback_prompts   where true;
    -- Submissions reference auth.users and stages. Same lesson as V-52: adding
    -- a table that points at an existing one silently breaks teardown for every
    -- suite that ran before it.
    delete from submissions        where true;

    -- Leaving a paper is recorded append-only (ruling 3, 30 Sep 2026): the
    -- table refuses a delete for every role, and attempts cascade into it.
    alter table attempt_events disable trigger attempt_events_no_delete;
    delete from attempt_events     where true;
    alter table attempt_events enable trigger attempt_events_no_delete;
    -- A moon's mastery (WEB-REVAMP 3.7a, 30 Sep 2026) is append-only for every
    -- role and references responses, so it goes first, suspended by name.
    alter table objective_progress disable trigger objective_progress_no_delete;
    delete from objective_progress where true;
    alter table objective_progress enable trigger objective_progress_no_delete;
    delete from responses          where true;
    delete from attempt_items      where true;
    delete from attempts           where true;
    delete from assessment_secrets where true;
    delete from assessments        where true;
    delete from blueprints         where true;
    delete from item_stats         where true;
    delete from items              where true;
    delete from content_blocks     where true;
    delete from stage_locks        where true;
    delete from stage_progress     where true;
    delete from level_progress     where true;
    delete from objectives         where true;
    -- Append-only since 28 Sep 2026; suspended by name like the responses triggers.
    alter table audit_log disable trigger audit_log_no_delete;
    delete from audit_log          where true;
    alter table audit_log enable trigger audit_log_no_delete;
    delete from profiles           where true;
    delete from student_directory  where true;
    delete from sections           where true;
    delete from stages             where id = '99';
    -- BOTH fixture domains, or the suite stops being idempotent.
    --
    -- octa-test.local is what fixtures are created with, but the credentials
    -- test CHANGES an account's email to newadmin@example.com -- that is the
    -- whole point of it. Cleaning only the first domain left that row in
    -- auth.users forever, and the next run died on users_email_key with a 500
    -- that reads as a broken endpoint rather than a dirty database. Two runs of
    -- "pnpm verify" therefore disagreed, which is the worst property a
    -- verification command can have.
    --
    -- example.com is reserved by RFC 2606 and can never be a real account, so
    -- this stays as safe as the scoping note above requires.
    delete from auth.users         where email like '%@octa-test.local'
                                      or email like '%@example.com';

    alter table responses enable trigger responses_no_update;
    alter table responses enable trigger responses_no_delete;
    alter table content_blocks enable trigger content_blocks_archive;
    alter table content_block_versions enable trigger cbv_no_update;
    alter table content_block_versions enable trigger cbv_no_delete;
    alter table content_blocks enable trigger content_blocks_archive;
    alter table content_block_versions enable trigger cbv_no_update;
    alter table content_block_versions enable trigger cbv_no_delete;
  `);
}
