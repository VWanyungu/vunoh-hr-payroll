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

export class Roles {
  static async assignRole(roleObj: AssignRoleInput & { userId: string }) {
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

  static async revokeRole(userId: string, id: string) {
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
}

export class Employees {
  static async createEmployee(
    employeeObj: CreateEmployeeInput & { updatedBy: string },
  ) {
    try {
      const [employee] = await db("employees")
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

      return { employee };
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

  static async updateEmployee(
    id: string,
    employeeObj: UpdateEmployeeInput & { updatedBy: string },
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

  static async deactivateEmployee(id: string, updatedBy: string) {
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
