import { Cache } from '../database/utils/cache.js';
import {Tokens} from "../database/utils/database.js";

export async function isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await Cache.get(`blacklist_${token}`)
    
    if (blacklisted != null){
        return Boolean(blacklisted)
    }
    
    const data = await Tokens.checkBlacklistToken(token)

    console.log(data)

    let isBlacklisted

    if (Array.isArray(data) && data.length > 0){
        data.map((token) => {
            token.blacklisted ? isBlacklisted = true : isBlacklisted = false
        })
    }

    // const isBlacklisted = data.some((token) => token.blacklisted === true);

    if (isBlacklisted) {
        await Cache.set(`blacklist_${token}`, true, {ex: 900})
        return true
    }

    await Cache.set(`blacklist_${token}`, false, {ex: 900})
    return false
}
