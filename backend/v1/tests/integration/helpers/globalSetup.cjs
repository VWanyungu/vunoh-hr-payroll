// Runs once before the whole suite, in a separate process from the test
// files. Migrates the isolated `test` database (see knexfile.js) up to date
// so `npm test` works on a fresh checkout without a manual migration step,
// and never touches the "development" database.
process.env.NODE_ENV = "test";

module.exports = async function globalSetup() {
  const knexfile = (await import("../../../../knexfile.js")).default;
  const knex = (await import("knex")).default;
  const db = knex(knexfile.test);

  try {
    await db.migrate.latest();
  } finally {
    await db.destroy();
  }
};
