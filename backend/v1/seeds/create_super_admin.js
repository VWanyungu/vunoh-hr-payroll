import bcrypt from "bcrypt";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  const email = "super@gmail.com";
  const password = "password";

  const passwordHash = await bcrypt.hash(password, 10);

  // Prevent duplicate super admin
  const existingUser = await knex("users").where({ email }).first();

  let userId;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const [user] = await knex("users")
      .insert({
        name: "Super Admin",
        email,
        password_hash: passwordHash,
        status: "approved",
      })
      .returning(["id"]);

    userId = user.id;
  }

  // Prevent duplicate role assignment
  const existingRole = await knex("user_roles")
    .where({
      user_id: userId,
      role: "super_admin",
    })
    .first();

  if (!existingRole) {
    await knex("user_roles").insert({
      user_id: userId,
      role: "super_admin",
      team_id: null,
    });
  }
}
