import { Redis } from '@upstash/redis'
import 'dotenv/config';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
})

export default redis