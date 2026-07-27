import db from "../dbSetup.js";
import { randomUUID } from "crypto";
import type { CreateUserInput, UpdateUserPasswordInput, UserLookupResult } from "../../types.js";

export class Users {
    static async getAllUsers({ page = 1, limit = 10 }: { page?: number; limit?: number }) {
        try {
            const offset = (page - 1) * limit;
            const users = await db('users')
                .select('id', 'first_name', 'last_name', 'email', 'username', 'phone', 'role', 'is_verified', 'is_active', 'created_at', 'updated_at')
                .limit(limit)
                .offset(offset)
                .orderBy('id');

            const total = await db('users').count('* as total');

            return {
                users: users,
                pagination: {
                    page: page,
                    limit: limit,
                    total: (total && total[0]) ?  total[0].total : 0,
                    pages: (total && total[0]) ? Math.ceil(Number(total[0].total) / limit) : 0
                }
            };
        } catch (error) {
            return {
                users: [],
                pagination: {
                    page: 0,
                    limit: 0,
                    total: 0,
                    pages: 0
                },
                error
            };
        }
    }

    static async getSingleUserByEmail(email: string): Promise<UserLookupResult> {
        try {
            const [user] = await db('users')
                .select('email', 'password_hash', 'id', 'role')
                .where("email", email)

            if (!user) {
                return {};
            }

            return {
                userId: user.id,
                email: user.email,
                passwordHash: user.password_hash,
                role: user.role
            };
        } catch (error) {
            return { error } as UserLookupResult & { error: unknown };
        }
    }

    static async createUser(userObj: CreateUserInput) {
        try {
            const [user] = await db('users')
                .insert({
                    id: randomUUID(),
                    first_name: userObj.firstName,
                    last_name: userObj.lastName,
                    email: userObj.email,
                    password_hash: userObj.passwordHash,
                    username: userObj.username,
                    is_verified: userObj.isVerified || 'false',
                    role: userObj.role || 'user',
                    phone: userObj.phone || null,
                    is_active: userObj.isActive || true
                })
                .returning(['id', 'email', 'first_name', 'last_name', 'username', 'phone', 'role', 'is_verified', 'is_active']);

            return {
                userId: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                phone: user.phone,
                role: user.role,
                isVerified: user.is_verified,
                isActive: user.is_active
            };
        } catch (error) {
            return { error };
        }
    }

    static async updateUserPassword(userObj: UpdateUserPasswordInput) {
        try {
            const affected = await db('users')
                .where('id', userObj.userId)
                .update({ password_hash: userObj.passwordHash });

            if (affected === 0) {
                return {
                    status: "fail",
                    error: "User not found"
                };
            }

            return {
                status: "success",
                error: null
            };

        } catch (err) {
            return {
                status: "fail",
                error: err
            };
        }
    }
}

export class Tokens {
    // Use try catch blocks for graceful error handling
    static async addRefreshToken(token: string, userId: string) {
        try {
            const [refreshToken] = await db('refreshTokens')
                .insert({
                    user_id: userId,
                    refresh_token: token,
                })
                .returning(['refresh_token']);

            return {
                refreshToken: refreshToken,
                error: null
            };
        } catch (error) {
            return {
                refreshToken: null,
                error: error
            };
        }

    }

    static async getRefreshToken(token: string) {
        try {
            const [refreshToken] = await db('refreshTokens')
                .select('refresh_token')
                .where("refresh_token", token)

            return {
                refreshToken: refreshToken ? refreshToken.refresh_token : ''
            };
        } catch (error) {
            return {
                refreshToken: null,
                error: error
            };
        }

    }

    static async deleteRefreshToken(token: string) {
        try {
            const [deletedToken] = await db('refreshTokens')
                .where("refresh_token", token)
                .del()
                .returning('refresh_token')

            return {
                deletedToken: deletedToken ? deletedToken.refresh_token : null
            };
        } catch (error) {
            return {
                deletedToken: null,
                error
            };
        }

    }

    static async blacklistToken(token: string) {
        try {
            const [blacklistedToken] = await db('tokens')
                .insert({
                    token: token,
                })
                .returning(['token', 'blacklisted']);

            return {
                token: blacklistedToken.token,
                blacklisted: blacklistedToken.blacklisted
            };
        } catch (error) {
            return {
                token: null,
                blacklisted: false,
                error
            };
        }
    }

    static async checkBlacklistToken(token: string) {
        try {
            const tokenBlacklisted = await db('tokens')
                .select('blacklisted')
                .where('token', token)

            return tokenBlacklisted;
        } catch (error) {
            return {
                error
            };
        }
    }
}