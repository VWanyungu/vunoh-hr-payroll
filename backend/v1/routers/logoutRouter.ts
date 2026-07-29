import express from "express";
import {Tokens} from "../database/utils/database.js";
import {Cache} from "../database/utils/cache.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const {token, refreshToken} = req.body
    
    try{
        await Tokens.deleteRefreshToken(refreshToken)
        await Cache.set(`blacklist_${token}`, true, {ex: 900})
        await Tokens.blacklistToken(token)

        res.status(200).json({
            status: "success",
            data: null,
            message: "Logout successful"
        });
    }catch(err){
        return res.status(500).json({ 
            status: "fail",
            data: null,
            error: err,
            message: "Logout failed"
        });
    }
});

export default router;