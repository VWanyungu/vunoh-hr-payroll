import 'dotenv/config';

export default {
  "development": {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: './v1/migrations',
      tableName: 'knex_migrations'
    },
    seeds: { directory: './v1/seeds' }
  },

  "test": {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: './v1/migrations',
      tableName: 'knex_migrations'
    },
    seeds: { directory: './v1/seeds/test' }
  },

  "staging": {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    seeds: { directory: './seeds' },
    pool: {
      min: 2,
      max: 10
    },
  },

  "production": {
    client: 'pg',
    connection: {
      host: process.env.PRODUCTION_DB_HOST,
      port: process.env.PRODUCTION_DB_PORT,
      user: process.env.PRODUCTION_DB_USER,
      database: process.env.PRODUCTION_DB_NAME,
      password: process.env.PRODUCTION_DB_PASSWORD,
    },
    migrations: {
      directory: './v1/migrations',
      tableName: 'knex_migrations'
    },
    seeds: { directory: './v1/seeds' },
    pool: {
      min: 2, 
      max: 10, 
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000,
    }
  }

};
