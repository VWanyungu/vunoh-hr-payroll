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

export const assignRoleSchema = Joi.object({
  role: Joi.string()
    .valid("super_admin", "hr_admin", "manager", "employee")
    .required(),
  teamId: Joi.string().uuid().optional(),
});

export const revokeRoleParamsSchema = Joi.object({
  roleId: Joi.string().uuid().required(),
});

const uuidSchema = Joi.string().uuid();
const jobTitleSchema = Joi.string().trim().min(1).max(150);
const salarySchema = Joi.number().positive().precision(2);
const employmentTypeSchema = Joi.string().valid("full_time", "contract");
const startDateSchema = Joi.date().iso();
const resumeSchema = Joi.string().trim();
const phoneSchema = Joi.string().trim();
const profilePictureSchema = Joi.string().trim();
const nationalIdSchema = Joi.number().integer();

export const createEmployeeSchema = Joi.object({
  userId: uuidSchema.required(),
  jobTitle: jobTitleSchema.required(),
  teamId: uuidSchema.required(),
  managerId: uuidSchema.optional(),
  startDate: startDateSchema.required(),
  salary: salarySchema.required(),
  employmentType: employmentTypeSchema.required(),
  resume: resumeSchema.optional(),
  phone: phoneSchema.optional(),
  profilePicture: profilePictureSchema.optional(),
  nationalId: nationalIdSchema.optional(),
});

export const updateEmployeeSchema = Joi.object({
  jobTitle: jobTitleSchema.optional(),
  teamId: uuidSchema.optional(),
  managerId: uuidSchema.optional(),
  startDate: startDateSchema.optional(),
  salary: salarySchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  resume: resumeSchema.optional(),
  phone: phoneSchema.optional(),
  profilePicture: profilePictureSchema.optional(),
  nationalId: nationalIdSchema.optional(),
}).min(1);

export const selfUpdateEmployeeSchema = Joi.object({
  resume: resumeSchema.optional(),
  phone: phoneSchema.optional(),
  profilePicture: profilePictureSchema.optional(),
}).min(1);

export const employeeQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  team: uuidSchema.optional(),
  manager: uuidSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().trim().optional(),
});
