import jwt from "jsonwebtoken";
import 'dotenv/config';
import type { AuthUser, JwtTokenType } from "../types.js";

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET ?? '';
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET ?? '';
const forgotPasswordTokenSecret = process.env.FORGOT_PASSWORD_TOKEN_SECRET ?? '';

export default function generateJWTToken(user: AuthUser & { id?: string }, type: JwtTokenType) {
    let token, refreshToken, forgotPasswordToken
    switch (type) {
        case "all":
            token = jwt.sign({ userId: user.userId, email: user.email }, accessTokenSecret, {expiresIn: '15m'});
            refreshToken = jwt.sign({ userId: user.userId, email: user.email }, refreshTokenSecret, {expiresIn: '7d'});
            forgotPasswordToken = jwt.sign({ userId: user.userId, email: user.email }, forgotPasswordTokenSecret, {expiresIn: '15m'});
            return {token, refreshToken, forgotPasswordToken}

        case "forgotPassword":
            forgotPasswordToken = jwt.sign({ userId: user.id ?? user.userId, email: user.email }, forgotPasswordTokenSecret, {expiresIn: '15m'});
            return {forgotPasswordToken}

        case "refreshToken": 
            refreshToken = jwt.sign({ userId: user.userId, email: user.email }, refreshTokenSecret, {expiresIn: '7d'});
            return {refreshToken}

        case "token": 
            token = jwt.sign({ userId: user.userId, email: user.email }, accessTokenSecret, {expiresIn: '15m'});
            return {token}
            
        default:
            token = jwt.sign({ userId: user.userId, email: user.email }, accessTokenSecret, {expiresIn: '15m'});
            refreshToken = jwt.sign({ userId: user.userId, email: user.email }, refreshTokenSecret, {expiresIn: '7d'});
            forgotPasswordToken = jwt.sign({ userId: user.userId, email: user.email }, forgotPasswordTokenSecret, {expiresIn: '15m'});
            return {token, refreshToken, forgotPasswordToken}
    }
}