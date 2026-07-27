import Joi from "joi";

const firstNameSchema = Joi.string().trim().min(1).max(50).required();
const emailSchema = Joi.string().email().lowercase().required();
const passwordHashSchema = Joi.string().required(); // Typically just ensure it exists/is a string if it's already hashed
const roleSchema = Joi.string()
  .valid("super_admin", "hr_admin", "manager", "employee")
  .default("employee");
export const statusSchema = Joi.string().valid(
  "pending",
  "approved",
  "rejected",
);

export const createUserSchema = Joi.object({
  name: firstNameSchema,
  email: emailSchema,
  passwordHash: passwordHashSchema,
});

export const updateUserSchema = Joi.object({
  name: firstNameSchema.optional(),
  email: emailSchema.optional(),
  status: statusSchema,
}).min(1);

const teamNameSchema = Joi.string().trim().min(1).max(100).required();

export const createTeamSchema = Joi.object({
  name: teamNameSchema,
});

export const updateTeamSchema = Joi.object({
  name: teamNameSchema,
});
