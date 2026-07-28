import db from "../dbSetup.js";
import { randomUUID } from "crypto";
import type {
  CreateUserInput,
  UpdateUserPasswordInput,
  UpdateUserInput,
  UserLookupResult,
  CreateTeamInput,
  UpdateTeamInput,
  TeamFilters,
  UserFilters,
  PaginationInput,
  AssignRoleInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeFilters,
  AuthUser,
  LeaveTypeFilters,
  CreateLeaveRequestInput,
  LeaveRequestFilters,
  LeaveRequestScope,
  CreateLeaveBalanceInput,
  UpdateLeaveBalanceInput,
  LeaveBalanceFilters,
  UserId,
  EmployeeId,
} from "../../types.js";

const EMPLOYEE_COLUMNS = [
  "id",
  "user_id",
  "job_title",
  "team_id",
  "manager_id",
  "updated_by",
  "start_date",
  "salary",
  "employment_type",
  "resume",
  "phone",
  "profile_picture",
  "national_id",
  "is_active",
  "deleted",
  "created_at",
  "updated_at",
];

const SENSITIVE_EMPLOYEE_FIELDS = ["salary", "resume", "national_id"];

export function sanitizeEmployee<T extends Record<string, unknown>>(
  employee: T,
  requester: AuthUser,
): T {
  const privileged = requester.role?.some(
    (r) => r.role === "super_admin" || r.role === "hr_admin",
  );
  const isSelf = employee["user_id"] === requester.userId;

  if (privileged || isSelf) return employee;

  const sanitized = { ...employee };
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

export class Users {
  static async getAllUsers({
    page = 1,
    limit = 10,
    status,
  }: PaginationInput & UserFilters) {
    try {
      const offset = (page - 1) * limit;

      const usersQuery = db("users")
        .leftJoin("user_roles", "users.id", "user_roles.user_id")
        .select(
          "users.id",
          "users.name",
          "users.email",
          "users.status",
          "users.created_at",
          "users.updated_at",
        )
        .select(
          db.raw(`
          COALESCE(
            json_agg(
              json_build_object(
                'id', user_roles.id,
                'role', user_roles.role,
                'team_id', user_roles.team_id
              )
            ) FILTER (WHERE user_roles.id IS NOT NULL),
            '[]'
          ) AS roles
        `),
        )
        .groupBy(
          "users.id",
          "users.name",
          "users.email",
          "users.status",
          "users.created_at",
          "users.updated_at",
        );

      if (status) usersQuery.where("users.status", status);

      const users = await usersQuery
        .limit(limit)
        .offset(offset)
        .orderBy("users.id");

      const totalQuery = db("users");
      if (status) totalQuery.where("status", status);
      const total = await totalQuery.count("* as total");

      return {
        users,
        pagination: {
          page,
          limit,
          total: total && total[0] && Number(total[0].total),
          pages: total && total[0] && Math.ceil(Number(total[0].total) / limit),
        },
      };
    } catch (error) {
      return {
        users: [],
        pagination: {
          page: 0,
          limit: 0,
          total: 0,
          pages: 0,
        },
        error,
      };
    }
  }

  static async getUserById(id: string) {
    try {
      const user = await db("users")
        .select("id", "name", "email", "status")
        .where("id", id)
        .first();

      return { user: user ?? null };
    } catch (error) {
      return { user: null, error };
    }
  }

  static async getSingleUserByEmail(email: string): Promise<UserLookupResult> {
    try {
      const user = await db("users")
        .leftJoin("user_roles", "users.id", "user_roles.user_id")
        .select("users.email", "users.password_hash", "users.id")
        .select(
          db.raw(`
            COALESCE(
                json_agg(
                json_build_object(
                    'id', user_roles.id,
                    'role', user_roles.role,
                    'team_id', user_roles.team_id
                )
                ) FILTER (WHERE user_roles.id IS NOT NULL),
                '[]'
            ) AS roles
            `),
        )
        .where("users.email", email)
        .groupBy("users.id", "users.email", "users.password_hash")
        .first();

      if (!user) {
        return {};
      }

      return {
        userId: user.id,
        email: user.email,
        passwordHash: user.password_hash,
        role: user.roles,
      };
    } catch (error) {
      return { error } as UserLookupResult & { error: unknown };
    }
  }

  static async createUser(userObj: CreateUserInput) {
    try {
      const [user] = await db("users")
        .insert({
          id: randomUUID(),
          name: userObj.name,
          email: userObj.email,
          password_hash: userObj.passwordHash,
        })
        .returning(["id", "email", "name", "status"]);

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
      };
    } catch (error) {
      return { error };
    }
  }

  static async updateUser(id: string, userObj: UpdateUserInput) {
    try {
      const [user] = await db("users")
        .where("id", id)
        .update(userObj)
        .returning([
          "id",
          "name",
          "email",
          "status",
          "created_at",
          "updated_at",
        ]);

      if (!user) {
        return { user: null, error: "User not found" };
      }

      return { user };
    } catch (error) {
      return { user: null, error };
    }
  }

  static async updateUserPassword(userObj: UpdateUserPasswordInput) {
    try {
      const affected = await db("users")
        .where("id", userObj.userId)
        .update({ password_hash: userObj.passwordHash });

      if (affected === 0) {
        return {
          status: "fail",
          error: "User not found",
        };
      }

      return {
        status: "success",
        error: null,
      };
    } catch (err) {
      return {
        status: "fail",
        error: err,
      };
    }
  }
}

export class Teams {
  static async getAllTeams({
    id,
    name,
    page,
    limit,
  }: TeamFilters & PaginationInput) {
    try {
      const teamsQuery = db("teams").select(
        "id",
        "name",
        "created_at",
        "updated_at",
      );

      if (id) teamsQuery.where("id", id);
      if (name) teamsQuery.where("name", "ilike", `%${name}%`);

      if (page !== undefined || limit !== undefined) {
        const resolvedPage = page ?? 1;
        const resolvedLimit = limit ?? 10;
        const offset = (resolvedPage - 1) * resolvedLimit;

        const teams = await teamsQuery
          .limit(resolvedLimit)
          .offset(offset)
          .orderBy("id");

        const totalQuery = db("teams");
        if (id) totalQuery.where("id", id);
        if (name) totalQuery.where("name", "ilike", `%${name}%`);
        const total = await totalQuery.count("* as total");

        return {
          teams,
          pagination: {
            page: resolvedPage,
            limit: resolvedLimit,
            total: total && total[0] && Number(total[0].total),
            pages:
              total &&
              total[0] &&
              Math.ceil(Number(total[0].total) / resolvedLimit),
          },
        };
      }

      const teams = await teamsQuery.orderBy("id");

      return { teams, pagination: null };
    } catch (error) {
      return { teams: [], pagination: null, error };
    }
  }

  static async getTeamById(id: string) {
    try {
      const team = await db("teams")
        .select("id", "name", "created_at", "updated_at")
        .where("id", id)
        .first();

      return { team: team ?? null };
    } catch (error) {
      return { team: null, error };
    }
  }

  static async createTeam(teamObj: CreateTeamInput) {
    try {
      const [team] = await db("teams")
        .insert({ name: teamObj.name })
        .returning(["id", "name", "created_at", "updated_at"]);

      return { team };
    } catch (error) {
      return { team: null, error };
    }
  }

  static async updateTeam(id: string, teamObj: UpdateTeamInput) {
    try {
      const [team] = await db("teams")
        .where("id", id)
        .update({ name: teamObj.name })
        .returning(["id", "name", "created_at", "updated_at"]);

      if (!team) {
        return { team: null, error: "Team not found" };
      }

      return { team };
    } catch (error) {
      return { team: null, error };
    }
  }

  static async deleteTeam(id: string) {
    try {
      const [team] = await db("teams")
        .where("id", id)
        .del()
        .returning(["id", "name"]);

      if (!team) {
        return { team: null, error: "Team not found" };
      }

      return { team };
    } catch (error) {
      return { team: null, error };
    }
  }
}

const LEAVE_TYPE_COLUMNS = [
  "id",
  "code",
  "name",
  "default_allowance_days",
  "prorate_on_join",
  "notice_days_required",
  "requires_cover",
  "created_at",
  "updated_at",
];

export class LeaveTypes {
  static async getAllLeaveTypes({ id, code }: LeaveTypeFilters) {
    try {
      const query = db("leave_types").select(LEAVE_TYPE_COLUMNS);

      if (id) query.where("id", id);
      if (code) query.where("code", code);

      const leaveTypes = await query.orderBy("id");

      return { leaveTypes };
    } catch (error) {
      return { leaveTypes: [], error };
    }
  }
}

export class PublicHolidays {
  static async getHolidayDatesInRange(startDate: string, endDate: string) {
    try {
      const rows = await db("public_holidays")
        .select("holiday_date")
        .where("holiday_date", ">=", startDate)
        .where("holiday_date", "<=", endDate);

      return { holidayDates: rows.map((r) => r.holiday_date as string) };
    } catch (error) {
      return { holidayDates: [], error };
    }
  }
}

export class Roles {
  static async assignRole(roleObj: AssignRoleInput & { userId: UserId }) {
    try {
      const [assignment] = await db("user_roles")
        .insert({
          user_id: roleObj.userId,
          role: roleObj.role,
          team_id: roleObj.teamId ?? null,
        })
        .returning(["id", "user_id", "role", "team_id", "created_at"]);

      return { assignment };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return { assignment: null, duplicate: true };
      }
      return { assignment: null, error };
    }
  }

  static async revokeRole(userId: UserId, id: string) {
    try {
      const record = await db("user_roles").where("id", id).first();

      if (!record) {
        return { assignment: null, error: "Role does not exist" };
      }

      if (record.user_id !== userId) {
        return {
          assignment: null,
          error: "User does not have the specified role",
        };
      }

      const [assignment] = await db("user_roles")
        .where("id", id)
        .del()
        .returning(["id", "user_id", "role", "team_id"]);

      return { assignment };
    } catch (error) {
      return { assignment: null, error };
    }
  }

  static async getTeamManagerUserId(teamId: string) {
    try {
      const row = await db("user_roles")
        .where({ role: "manager", team_id: teamId })
        .orderBy("created_at", "asc")
        .first();

      return { userId: (row?.user_id as UserId) ?? null };
    } catch (error) {
      return { userId: null, error };
    }
  }

  static async getHrAdminUserId() {
    try {
      const row = await db("user_roles")
        .where({ role: "hr_admin" })
        .orderBy("created_at", "asc")
        .first();

      return { userId: (row?.user_id as UserId) ?? null };
    } catch (error) {
      return { userId: null, error };
    }
  }
}

export class Employees {
  static async createEmployee(
    employeeObj: CreateEmployeeInput & { updatedBy: UserId },
  ) {
    try {
      return await db.transaction(async (trx) => {
        const [employee] = await trx("employees")
          .insert({
            user_id: employeeObj.userId,
            job_title: employeeObj.jobTitle,
            team_id: employeeObj.teamId,
            manager_id: employeeObj.managerId ?? null,
            updated_by: employeeObj.updatedBy,
            start_date: employeeObj.startDate,
            salary: employeeObj.salary,
            employment_type: employeeObj.employmentType,
            resume: employeeObj.resume ?? null,
            phone: employeeObj.phone ?? null,
            profile_picture: employeeObj.profilePicture ?? null,
            national_id: employeeObj.nationalId ?? null,
          })
          .returning(EMPLOYEE_COLUMNS);

        const leaveTypes = await trx("leave_types").where(
          "code",
          "<>",
          "unpaid",
        );
        const year = new Date(employeeObj.startDate).getFullYear();

        for (const leaveType of leaveTypes) {
          await LeaveBalances.createLeaveBalance(
            {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year,
              allocated: leaveType.default_allowance_days ?? 0,
            },
            trx,
          );
        }

        return { employee, error: null as unknown };
      });
    } catch (error) {
      return { employee: null, error };
    }
  }

  static async getAllEmployees({
    page,
    limit,
    team,
    manager,
    employmentType,
    isActive,
    search,
  }: PaginationInput & EmployeeFilters) {
    try {
      const employeesQuery = db("employees").select(EMPLOYEE_COLUMNS);
      employeesQuery.where("deleted", false);
      if (team) employeesQuery.where("team_id", team);
      if (manager) employeesQuery.where("manager_id", manager);
      if (employmentType)
        employeesQuery.where("employment_type", employmentType);
      if (isActive !== undefined) employeesQuery.where("is_active", isActive);
      if (search) employeesQuery.where("job_title", "ilike", `%${search}%`);

      if (page !== undefined || limit !== undefined) {
        const resolvedPage = page ?? 1;
        const resolvedLimit = limit ?? 10;
        const offset = (resolvedPage - 1) * resolvedLimit;

        const employees = await employeesQuery
          .limit(resolvedLimit)
          .offset(offset)
          .orderBy("id");

        const totalQuery = db("employees");
        totalQuery.where("deleted", false);
        if (team) totalQuery.where("team_id", team);
        if (manager) totalQuery.where("manager_id", manager);
        if (employmentType) totalQuery.where("employment_type", employmentType);
        if (isActive !== undefined) totalQuery.where("is_active", isActive);
        if (search) totalQuery.where("job_title", "ilike", `%${search}%`);
        const total = await totalQuery.count("* as total");

        return {
          employees,
          pagination: {
            page: resolvedPage,
            limit: resolvedLimit,
            total: total && total[0] && Number(total[0].total),
            pages:
              total &&
              total[0] &&
              Math.ceil(Number(total[0].total) / resolvedLimit),
          },
        };
      }

      const employees = await employeesQuery.orderBy("id");

      return { employees, pagination: null };
    } catch (error) {
      return { employees: [], pagination: null, error };
    }
  }

  static async getEmployeeById(id: string) {
    try {
      const employee = await db("employees")
        .select(EMPLOYEE_COLUMNS)
        .where("id", id)
        .where("deleted", false)
        .first();

      return { employee: employee ?? null };
    } catch (error) {
      return { employee: null, error };
    }
  }

  static async getEmployeeByUserId(userId: UserId) {
    try {
      const employee = await db("employees")
        .select(EMPLOYEE_COLUMNS)
        .where("user_id", userId)
        .where("deleted", false)
        .first();

      return { employee: employee ?? null };
    } catch (error) {
      return { employee: null, error };
    }
  }

  static async updateEmployee(
    id: string,
    employeeObj: UpdateEmployeeInput & { updatedBy: UserId },
  ) {
    try {
      const updatePayload: Record<string, unknown> = {
        updated_by: employeeObj.updatedBy,
      };

      if (employeeObj.jobTitle !== undefined)
        updatePayload["job_title"] = employeeObj.jobTitle;
      if (employeeObj.teamId !== undefined)
        updatePayload["team_id"] = employeeObj.teamId;
      if (employeeObj.managerId !== undefined)
        updatePayload["manager_id"] = employeeObj.managerId;
      if (employeeObj.startDate !== undefined)
        updatePayload["start_date"] = employeeObj.startDate;
      if (employeeObj.salary !== undefined)
        updatePayload["salary"] = employeeObj.salary;
      if (employeeObj.employmentType !== undefined)
        updatePayload["employment_type"] = employeeObj.employmentType;
      if (employeeObj.resume !== undefined)
        updatePayload["resume"] = employeeObj.resume;
      if (employeeObj.phone !== undefined)
        updatePayload["phone"] = employeeObj.phone;
      if (employeeObj.profilePicture !== undefined)
        updatePayload["profile_picture"] = employeeObj.profilePicture;
      if (employeeObj.nationalId !== undefined)
        updatePayload["national_id"] = employeeObj.nationalId;

      const [employee] = await db("employees")
        .where("id", id)
        .where("deleted", false)
        .update(updatePayload)
        .returning(EMPLOYEE_COLUMNS);

      if (!employee) {
        return { employee: null, error: "Employee not found" };
      }

      return { employee };
    } catch (error) {
      return { employee: null, error };
    }
  }

  static async deactivateEmployee(id: string, updatedBy: UserId) {
    try {
      const [employee] = await db("employees")
        .where("id", id)
        .where("deleted", false)
        .update({ is_active: false, updated_by: updatedBy })
        .returning(EMPLOYEE_COLUMNS);

      if (!employee) {
        return { employee: null, error: "Employee not found" };
      }

      return { employee };
    } catch (error) {
      return { employee: null, error };
    }
  }
}

// Auth carries a UserId (req.user.userId); most leave-domain queries need the
// caller's EmployeeId instead. Centralizes that UserId -> employee row hop so
// routers don't each re-run Employees.getEmployeeByUserId themselves.
export async function resolveEmployeeForUser(user: AuthUser) {
  const { employee } = await Employees.getEmployeeByUserId(user.userId);
  return employee ?? null;
}

const LEAVE_REQUEST_COLUMNS = [
  "id",
  "employee_id",
  "leave_type_id",
  "start_date",
  "end_date",
  "working_days_count",
  "status",
  "cover_employee_id",
  "approver_id",
  "requested_at",
  "decided_at",
  "created_at",
  "updated_at",
];

export class LeaveRequests {
  static async getAllLeaveRequests({
    page,
    limit,
    employeeId,
    status,
    scope,
  }: PaginationInput & LeaveRequestFilters & { scope: LeaveRequestScope }) {
    try {
      const applyScope = (query: ReturnType<typeof db>) => {
        if (scope.type === "own") {
          query.where("employee_id", scope.employeeId);
        } else if (scope.type === "managed") {
          query.whereIn(
            "employee_id",
            db("employees")
              .select("id")
              .where((builder) => {
                builder
                  .where("manager_id", scope.managerEmployeeId)
                  .orWhere("id", scope.managerEmployeeId);
              }),
          );
        }
      };

      const leaveRequestsQuery = db("leave_requests").select(
        LEAVE_REQUEST_COLUMNS,
      );
      applyScope(leaveRequestsQuery);
      if (employeeId) leaveRequestsQuery.where("employee_id", employeeId);
      if (status) leaveRequestsQuery.where("status", status);

      if (page !== undefined || limit !== undefined) {
        const resolvedPage = page ?? 1;
        const resolvedLimit = limit ?? 10;
        const offset = (resolvedPage - 1) * resolvedLimit;

        const leaveRequests = await leaveRequestsQuery
          .limit(resolvedLimit)
          .offset(offset)
          .orderBy("requested_at", "desc");

        const totalQuery = db("leave_requests");
        applyScope(totalQuery);
        if (employeeId) totalQuery.where("employee_id", employeeId);
        if (status) totalQuery.where("status", status);
        const total = await totalQuery.count("* as total");

        return {
          leaveRequests,
          pagination: {
            page: resolvedPage,
            limit: resolvedLimit,
            total: total && total[0] && Number(total[0].total),
            pages:
              total &&
              total[0] &&
              Math.ceil(Number(total[0].total) / resolvedLimit),
          },
        };
      }

      const leaveRequests = await leaveRequestsQuery.orderBy(
        "requested_at",
        "desc",
      );

      return { leaveRequests, pagination: null };
    } catch (error) {
      return { leaveRequests: [], pagination: null, error };
    }
  }

  static async getLeaveRequestById(id: string) {
    try {
      const leaveRequest = await db("leave_requests")
        .select(LEAVE_REQUEST_COLUMNS)
        .where("id", id)
        .first();

      return { leaveRequest: leaveRequest ?? null };
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }

  static async createLeaveRequest(
    input: CreateLeaveRequestInput & {
      employeeId: EmployeeId;
      workingDaysCount: number;
      approverId?: UserId | null;
    },
  ) {
    try {
      const [leaveRequest] = await db("leave_requests")
        .insert({
          employee_id: input.employeeId,
          leave_type_id: input.leaveTypeId,
          start_date: input.startDate,
          end_date: input.endDate,
          working_days_count: input.workingDaysCount,
          status: "pending",
          cover_employee_id: input.coverEmployeeId ?? null,
          approver_id: input.approverId ?? null,
          requested_at: db.fn.now(),
        })
        .returning(LEAVE_REQUEST_COLUMNS);

      return { leaveRequest };
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }

  static async updateLeaveRequest(
    id: string,
    updatePayload: Partial<{
      leave_type_id: string;
      start_date: string;
      end_date: string;
      working_days_count: number;
      cover_employee_id: string | null;
    }>,
  ) {
    try {
      const [leaveRequest] = await db("leave_requests")
        .where("id", id)
        .where("status", "pending")
        .update(updatePayload)
        .returning(LEAVE_REQUEST_COLUMNS);

      if (!leaveRequest) {
        return {
          leaveRequest: null,
          error: "Leave request not found or not pending",
        };
      }

      return { leaveRequest };
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }

  static async decideLeaveRequest(
    id: string,
    decision: { status: "approved" | "rejected"; approverId: UserId },
  ) {
    try {
      const [leaveRequest] = await db("leave_requests")
        .where("id", id)
        .where("status", "pending")
        .update({
          status: decision.status,
          approver_id: decision.approverId,
          decided_at: db.fn.now(),
        })
        .returning(LEAVE_REQUEST_COLUMNS);

      if (!leaveRequest) {
        return {
          leaveRequest: null,
          error: "Leave request not found or not pending",
        };
      }

      return { leaveRequest };
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }

  // Approving deducts the request's working_days_count from the matching
  // leave_balances row (employee_id, leave_type_id, year of start_date) in the
  // same transaction as the status change, so a request is never marked
  // approved without its balance being reflected. "unpaid" leave types are not
  // tracked in leave_balances and skip the deduction step entirely.
  static async approveLeaveRequest(id: string, approverId: UserId) {
    try {
      return await db.transaction(async (trx) => {
        const leaveRequest = await trx("leave_requests")
          .where("id", id)
          .forUpdate()
          .first();

        if (!leaveRequest) {
          return { leaveRequest: null, error: "not_found" as const };
        }

        if (leaveRequest.status !== "pending") {
          return { leaveRequest: null, error: "not_pending" as const };
        }

        const leaveType = await trx("leave_types")
          .where("id", leaveRequest.leave_type_id)
          .first();

        if (leaveType && leaveType.code !== "unpaid") {
          const year = new Date(leaveRequest.start_date).getFullYear();

          const balance = await trx("leave_balances")
            .where({
              employee_id: leaveRequest.employee_id,
              leave_type_id: leaveRequest.leave_type_id,
              year,
            })
            .forUpdate()
            .first();

          if (!balance) {
            return { leaveRequest: null, error: "no_balance" as const };
          }

          if (balance.remaining < leaveRequest.working_days_count) {
            return {
              leaveRequest: null,
              error: "insufficient_balance" as const,
            };
          }

          await LeaveBalances.updateLeaveBalance(
            balance.id,
            { used: balance.used + leaveRequest.working_days_count },
            trx,
          );
        }

        const [updated] = await trx("leave_requests")
          .where("id", id)
          .update({
            status: "approved",
            approver_id: approverId,
            decided_at: trx.fn.now(),
          })
          .returning(LEAVE_REQUEST_COLUMNS);

        return { leaveRequest: updated };
      });
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }

  static async cancelLeaveRequest(id: string) {
    try {
      const [leaveRequest] = await db("leave_requests")
        .where("id", id)
        .where("status", "pending")
        .update({ status: "cancelled", decided_at: db.fn.now() })
        .returning(LEAVE_REQUEST_COLUMNS);

      if (!leaveRequest) {
        return {
          leaveRequest: null,
          error: "Leave request not found or not pending",
        };
      }

      return { leaveRequest };
    } catch (error) {
      return { leaveRequest: null, error };
    }
  }
}

const LEAVE_BALANCE_COLUMNS = [
  "id",
  "employee_id",
  "leave_type_id",
  "year",
  "allocated",
  "used",
  "remaining",
  "created_at",
  "updated_at",
];

export class LeaveBalances {
  static async getAllLeaveBalances({
    page,
    limit,
    employeeId,
    leaveTypeId,
    year,
  }: PaginationInput & LeaveBalanceFilters) {
    try {
      const leaveBalancesQuery = db("leave_balances").select(
        LEAVE_BALANCE_COLUMNS,
      );
      if (employeeId) leaveBalancesQuery.where("employee_id", employeeId);
      if (leaveTypeId) leaveBalancesQuery.where("leave_type_id", leaveTypeId);
      if (year) leaveBalancesQuery.where("year", year);

      if (page !== undefined || limit !== undefined) {
        const resolvedPage = page ?? 1;
        const resolvedLimit = limit ?? 10;
        const offset = (resolvedPage - 1) * resolvedLimit;

        const leaveBalances = await leaveBalancesQuery
          .limit(resolvedLimit)
          .offset(offset)
          .orderBy("year", "desc");

        const totalQuery = db("leave_balances");
        if (employeeId) totalQuery.where("employee_id", employeeId);
        if (leaveTypeId) totalQuery.where("leave_type_id", leaveTypeId);
        if (year) totalQuery.where("year", year);
        const total = await totalQuery.count("* as total");

        return {
          leaveBalances,
          pagination: {
            page: resolvedPage,
            limit: resolvedLimit,
            total: total && total[0] && Number(total[0].total),
            pages:
              total &&
              total[0] &&
              Math.ceil(Number(total[0].total) / resolvedLimit),
          },
        };
      }

      const leaveBalances = await leaveBalancesQuery.orderBy("year", "desc");

      return { leaveBalances, pagination: null };
    } catch (error) {
      return { leaveBalances: [], pagination: null, error };
    }
  }

  static async getLeaveBalanceById(id: string) {
    try {
      const leaveBalance = await db("leave_balances")
        .select(LEAVE_BALANCE_COLUMNS)
        .where("id", id)
        .first();

      return { leaveBalance: leaveBalance ?? null };
    } catch (error) {
      return { leaveBalance: null, error };
    }
  }

  static async getLeaveBalance({
    employeeId,
    leaveTypeId,
    year,
  }: {
    employeeId: EmployeeId;
    leaveTypeId: string;
    year: number;
  }) {
    try {
      const leaveBalance = await db("leave_balances")
        .select(LEAVE_BALANCE_COLUMNS)
        .where({
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          year,
        })
        .first();

      return { leaveBalance: leaveBalance ?? null };
    } catch (error) {
      return { leaveBalance: null, error };
    }
  }

  static async createLeaveBalance(
    input: CreateLeaveBalanceInput,
    trx: typeof db = db,
  ) {
    try {
      const [leaveBalance] = await trx("leave_balances")
        .insert({
          employee_id: input.employeeId,
          leave_type_id: input.leaveTypeId,
          year: input.year,
          allocated: input.allocated,
          used: 0,
          remaining: input.allocated,
        })
        .returning(LEAVE_BALANCE_COLUMNS);

      return { leaveBalance };
    } catch (error) {
      return { leaveBalance: null, error };
    }
  }

  static async updateLeaveBalance(
    id: string,
    input: UpdateLeaveBalanceInput,
    trx: typeof db = db,
  ) {
    try {
      const existing = await trx("leave_balances").where("id", id).first();

      if (!existing) {
        return { leaveBalance: null, error: "Leave balance not found" };
      }

      const allocated = input.allocated ?? existing.allocated;
      const used = input.used ?? existing.used;

      const [leaveBalance] = await trx("leave_balances")
        .where("id", id)
        .update({
          allocated,
          used,
          remaining: allocated - used,
        })
        .returning(LEAVE_BALANCE_COLUMNS);

      return { leaveBalance };
    } catch (error) {
      return { leaveBalance: null, error };
    }
  }
}

export class Tokens {
  // Use try catch blocks for graceful error handling
  static async addRefreshToken(token: string, userId: string) {
    try {
      const [refreshToken] = await db("refreshTokens")
        .insert({
          user_id: userId,
          refresh_token: token,
        })
        .returning(["refresh_token"]);

      return {
        refreshToken: refreshToken,
        error: null,
      };
    } catch (error) {
      return {
        refreshToken: null,
        error: error,
      };
    }
  }

  static async getRefreshToken(token: string) {
    try {
      const [refreshToken] = await db("refreshTokens")
        .select("refresh_token")
        .where("refresh_token", token);

      return {
        refreshToken: refreshToken ? refreshToken.refresh_token : "",
      };
    } catch (error) {
      return {
        refreshToken: null,
        error: error,
      };
    }
  }

  static async deleteRefreshToken(token: string) {
    try {
      const [deletedToken] = await db("refreshTokens")
        .where("refresh_token", token)
        .del()
        .returning("refresh_token");

      return {
        deletedToken: deletedToken ? deletedToken.refresh_token : null,
      };
    } catch (error) {
      return {
        deletedToken: null,
        error,
      };
    }
  }

  static async blacklistToken(token: string) {
    try {
      const [blacklistedToken] = await db("tokens")
        .insert({
          token: token,
        })
        .returning(["token", "blacklisted"]);

      return {
        token: blacklistedToken.token,
        blacklisted: blacklistedToken.blacklisted,
      };
    } catch (error) {
      return {
        token: null,
        blacklisted: false,
        error,
      };
    }
  }

  static async checkBlacklistToken(token: string) {
    try {
      const tokenBlacklisted = await db("tokens")
        .select("blacklisted")
        .where("token", token);

      return tokenBlacklisted;
    } catch (error) {
      return {
        error,
      };
    }
  }
}
