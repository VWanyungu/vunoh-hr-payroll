import express from "express";
import {Users} from "../database/utils/database.js";
import hashPassword from "../utils/hashPassword.js";
import jwt from 'jsonwebtoken'
import type { AuthUser } from "../types.js";

const router = express.Router();

router.post("/:resetToken", async (req, res) => {
    const resetToken = req.params.resetToken    

    jwt.verify(resetToken, process.env.FORGOT_PASSWORD_TOKEN_SECRET ?? '', async (err, user) => {
        if (err) return res.status(401).json({
            status: "error",
            data: null,
            message: "Invalid token provided"
        })

        const hashedPassword = await hashPassword(req.body.password);

        const userObj = {
            passwordHash: hashedPassword,
            userId: (user as AuthUser).userId
        }

        const updateRes = await Users.updateUserPassword(userObj)

        if (updateRes.error) return res.status(500).json({
            status: "fail",
            data: null,
            message: updateRes.error
        })

        res.status(200).json({
            status: "success",
            data: null,
            message: "User password reset successful"
        });

    })

});

export default router;