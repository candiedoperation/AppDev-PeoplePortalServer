/**
 * Which teams confer organisation-wide administrative authority.
 *
 * The check used to be `team.name === "ExecutiveBoard"` written out in five
 * places across auth.ts and EventController. Adding TechOps as a second admin
 * team turned that into a set, so these tests pin down the contract and would
 * catch a sixth site being added that forgets one of them.
 */
const assert = require("node:assert/strict");
const test = require("node:test");
const { hasAdminAuthority, ADMIN_AUTHORITY_TEAMS, ENABLED_SERVICE_TEAMS } = require("../../dist/config.js");

const team = (name, flagged = false) => ({ name, flaggedForDeletion: flagged });

test("ExecutiveBoard and TechOps both confer authority", () => {
  assert.equal(hasAdminAuthority([team("ExecutiveBoard")]), true);
  assert.equal(hasAdminAuthority([team("TechOps")]), true);
});

test("an ordinary team confers nothing", () => {
  assert.equal(hasAdminAuthority([team("WebDevFALL2026")]), false);
  assert.equal(hasAdminAuthority([team("MLBootcampFALL2026"), team("InfrastructureSPRING2026")]), false);
});

test("authority is granted by membership of any one admin team", () => {
  assert.equal(hasAdminAuthority([team("WebDevFALL2026"), team("TechOps")]), true);
  assert.equal(hasAdminAuthority([team("TechOps"), team("ExecutiveBoard")]), true);
});

test("a team flagged for deletion confers nothing", () => {
  assert.equal(hasAdminAuthority([team("TechOps", true)]), false);
  assert.equal(hasAdminAuthority([team("ExecutiveBoard", true)]), false);
  /* One live admin team is still enough. */
  assert.equal(hasAdminAuthority([team("TechOps", true), team("ExecutiveBoard")]), true);
});

test("membership subteams do not themselves confer authority", () => {
  /* Authority comes from the ROOT team, which is what getRootTeamsForUsername
     returns. Granting it to the subteam name as well would widen every check. */
  assert.equal(hasAdminAuthority([team("TechOpsMembers")]), false);
  assert.equal(hasAdminAuthority([team("ExecutiveBoardMembers")]), false);
});

test("alumni do not retain authority", () => {
  assert.equal(hasAdminAuthority([team("TechOpsAlumni")]), false);
  assert.equal(hasAdminAuthority([team("ExecutiveBoardAlumni")]), false);
});

test("an empty team list confers nothing", () => {
  assert.equal(hasAdminAuthority([]), false);
});

test("name matching is exact, not a prefix", () => {
  assert.equal(hasAdminAuthority([team("TechOpsSomethingElse")]), false);
  assert.equal(hasAdminAuthority([team("techops")]), false);
  assert.equal(hasAdminAuthority([team("NotTechOps")]), false);
});

test("every admin team is a real provisioned service team", () => {
  /* An admin team that validateServiceExistance never creates would silently
     grant nothing, because nobody could be a member of it. */
  for (const name of ADMIN_AUTHORITY_TEAMS) {
    assert.ok(ENABLED_SERVICE_TEAMS[name], `${name} must exist in ENABLED_SERVICE_TEAMS`);
  }
});

test("TechOps mirrors ExecutiveBoard's shape", () => {
  const exec = ENABLED_SERVICE_TEAMS.ExecutiveBoard;
  const ops = ENABLED_SERVICE_TEAMS.TechOps;
  assert.ok(ops, "TechOps must be a service team");
  assert.equal(ops.subteams.length, exec.subteams.length);
  assert.deepEqual(
    ops.subteams.map((s) => s.uniqueName),
    ["TechOpsMembers", "TechOpsAlumni"]
  );
});
