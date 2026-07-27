import redis from "../cacheSetup.js";
import 'dotenv/config';

export class Cache {
   static async set(key: string, value: unknown, options: { ex: number } = { ex: Number(process.env.TOKEN_EXPIRY_SECONDS ?? 900) }) {
        await redis.set(key, value, options ?? {ex: Number(process.env.TOKEN_EXPIRY_SECONDS ?? 900)});        
   }

   static async get(key: string) {
       return await redis.get(key);
   }

   static async del(key: string) {
       return await redis.del(key);
   }
}  