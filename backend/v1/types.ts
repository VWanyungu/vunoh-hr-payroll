import type { Request } from "express";

// `UserId` identifies a login/auth identity (the `users` table); `EmployeeId`
// identifies an HR profile (the `employees` table). They are related by a 1:1
// FK (`employees.user_id` -> `users.id`) but are not interchangeable: leave
// requests/balances are owned by an EmployeeId, while approvers, roles, and
// audit (`updated_by`) fields are a UserId. Branding them as distinct string
// types makes mixing them up a compile error instead of a runtime bug.
export type UserId = string & { readonly __brand: "UserId" };
export type EmployeeId = string & { readonly __brand: "EmployeeId" };

export type UserRoles = {
  id: string;
  role: "super_admin" | "hr_admin" | "manager" | "employee";
  team_id: string | null;
};

export type AuthUser = {
  userId: UserId;
  email: string;
  role?: UserRoles[] | [];
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

export type UpdateUserPasswordInput = {
  userId: string;
  passwordHash: string;
};

export type UserStatus = "pending" | "approved" | "rejected";

export type UpdateUserInput = {
  name?: string;
  email?: string;
  status?: UserStatus;
};

export type UserLookupResult = {
  userId?: string;
  email?: string;
  passwordHash?: string;
  role?: UserRoles[];
};

export type JwtTokenType = "all" | "forgotPassword" | "refreshToken" | "token";

export type PasswordResetMail = {
  to: string;
  subject: string;
  html?: string;
  resetToken?: string;
};

export type PublicRoute = {
  method: string;
  pattern: any;
};

export type PaginationInput = {
  page?: number | undefined;
  limit?: number | undefined;
};

export type CreateTeamInput = {
  name: string;
};

export type UpdateTeamInput = {
  name: string;
};

export type TeamFilters = {
  id?: string | undefined;
  name?: string | undefined;
};

export type LeaveTypeCode = "annual" | "sick" | "unpaid";

export type LeaveTypeFilters = {
  id?: string | undefined;
  code?: LeaveTypeCode | undefined;
};

export type UserFilters = {
  status?: UserStatus | undefined;
};

export type AssignRoleInput = {
  role: string;
  teamId?: string;
};

export type EmploymentType = "full_time" | "contract";

export type CreateEmployeeInput = {
  userId: UserId;
  jobTitle: string;
  teamId: string;
  managerId?: string;
  startDate: string;
  salary: number;
  employmentType: EmploymentType;
  resume?: string;
  phone?: string;
  profilePicture?: string;
  nationalId?: number;
};

export type UpdateEmployeeInput = {
  jobTitle?: string;
  teamId?: string;
  managerId?: string;
  startDate?: string;
  salary?: number;
  employmentType?: EmploymentType;
  resume?: string;
  phone?: string;
  profilePicture?: string;
  nationalId?: number;
};

export type EmployeeFilters = {
  team?: string | undefined;
  manager?: string | undefined;
  employmentType?: EmploymentType | undefined;
  isActive?: boolean | undefined;
  search?: string | undefined;
};

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type CreateLeaveRequestInput = {
  employeeId?: EmployeeId;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  coverEmployeeId?: EmployeeId;
};

export type UpdateLeaveRequestInput = {
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
  coverEmployeeId?: EmployeeId;
};

export type LeaveRequestFilters = {
  employeeId?: EmployeeId | undefined;
  status?: LeaveRequestStatus | undefined;
};

export type LeaveRequestScope =
  | { type: "all" }
  | { type: "own"; employeeId: EmployeeId }
  | { type: "managed"; managerEmployeeId: EmployeeId };

export type DecideLeaveRequestInput = {
  status: "approved" | "rejected";
  approverId: UserId;
};

export type CreateLeaveBalanceInput = {
  employeeId: EmployeeId;
  leaveTypeId: string;
  year: number;
  allocated: number;
};

export type UpdateLeaveBalanceInput = {
  allocated?: number;
  used?: number;
};

export type LeaveBalanceFilters = {
  employeeId?: EmployeeId | undefined;
  leaveTypeId?: string | undefined;
  year?: number | undefined;
};
