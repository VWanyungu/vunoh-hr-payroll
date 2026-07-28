// Fixed fixture IDs for the leave-workflow integration suite.
// Must stay in sync with the literals duplicated in
// v1/tests/integration/leaveWorkflow.test.ts.
export const TEAM_ENGINEERING = "12cd99cb-5286-40bc-bba4-cc66235ba8e0";
export const TEAM_OPS = "cfdb9cbb-e230-46b4-b0de-359e6d781763";
export const TEAM_NO_MANAGER = "91586c04-50fd-4fee-a101-717ccef1f566";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex("teams").insert([
    { id: TEAM_ENGINEERING, name: "Engineering" },
    { id: TEAM_OPS, name: "Ops" },
    { id: TEAM_NO_MANAGER, name: "NoManagerTeam" },
  ]);
}
