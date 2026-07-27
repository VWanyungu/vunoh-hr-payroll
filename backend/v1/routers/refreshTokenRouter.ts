import express from "express";
import {Tokens} from "../database/utils/database.js";
import generateJwtToken from "../utils/generateJwtToken.js";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const inputRefreshToken = req.body.refreshToken;

    if (!inputRefreshToken) 
        return res.status(400).json({ 
            status: "error", 
            data: null, 
            message: "Refresh Token not provided" 
        });

    const {refreshToken} = await Tokens.getRefreshToken(inputRefreshToken)

    if (refreshToken == '') {
        return res.status(200).json({
            status: "error",
            data: null,
            message: "Unrecognized refresh token"
        });
    }else if (refreshToken == null){
        return res.status(500).json({
            status: "error",
            data: null,
            message: "An error occurred while validating refresh token"
        });
    }

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET ?? '', (err: jwt.VerifyErrors | null, user: string | jwt.JwtPayload | undefined) => {
        if (err) return res.status(401).json({
            status: "error",
            data: null,
            message: "Invalid Refresh Token"
        });

        const payload = {
            userId: (user as AuthUser).userId,
            email: (user as AuthUser).email
        }

        const {token} = generateJwtToken(payload, "token")                

        res.status(200).json({
            status: "success",
            data: {
                token: token,
            },
            message: ""
        });
    })
    
});

export default router;