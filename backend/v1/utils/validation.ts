import Joi from 'joi';

const firstNameSchema = Joi.string().trim().min(1).max(50).required();
const lastNameSchema = Joi.string().trim().min(1).max(50).required();
const emailSchema = Joi.string().email().lowercase().required();
const usernameSchema = Joi.string().alphanum().min(3).max(30).required();
const passwordHashSchema = Joi.string().required(); // Typically just ensure it exists/is a string if it's already hashed
const roleSchema = Joi.string().valid('user', 'admin', 'rider').default('user');
const phoneSchema = Joi.string().optional();

export const createUserSchema = Joi.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  passwordHash: passwordHashSchema,
  username: usernameSchema,
  role: roleSchema,
  phone: phoneSchema
});

