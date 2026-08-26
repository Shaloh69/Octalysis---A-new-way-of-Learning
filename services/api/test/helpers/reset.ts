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

    -- feedback FIRST: feedback.item_id references items(id) with no cascade,
    -- so once any suite files a content report, every later reset fails on
    -- "update or delete on table items violates foreign key constraint
    -- feedback_item_id_fkey". That is correct FK behaviour -- production never
    -- deletes an item, it retires one (hard rule 6) -- but the fixtures do.
    delete from feedback           where true;
    delete from feedback_prompts   where true;

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
    delete from audit_log          where true;
    delete from profiles           where true;
    delete from student_directory  where true;
    delete from sections           where true;
    delete from stages             where id = '99';
    delete from auth.users         where email like '%@octa-test.local';

    alter table responses enable trigger responses_no_update;
    alter table responses enable trigger responses_no_delete;
  `);
}
