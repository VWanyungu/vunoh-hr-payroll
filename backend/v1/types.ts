import type { Request } from "express";

export type UserRoles = {
  id: string;
  role: "super_admin" | "hr_admin" | "manager" | "employee";
  team_id: string | null;
};

export type AuthUser = {
  userId: string;
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
  userId: string;
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
  employeeId?: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  coverEmployeeId?: string;
};

export type UpdateLeaveRequestInput = {
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
  coverEmployeeId?: string;
};

export type LeaveRequestFilters = {
  employeeId?: string | undefined;
  status?: LeaveRequestStatus | undefined;
};

export type LeaveRequestScope =
  | { type: "all" }
  | { type: "own"; employeeId: string }
  | { type: "managed"; managerEmployeeId: string };

export type DecideLeaveRequestInput = {
  status: "approved" | "rejected";
  approverId: string;
};

export type CreateLeaveBalanceInput = {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocated: number;
};

export type UpdateLeaveBalanceInput = {
  allocated?: number;
  used?: number;
};

export type LeaveBalanceFilters = {
  employeeId?: string | undefined;
  leaveTypeId?: string | undefined;
  year?: number | undefined;
};
