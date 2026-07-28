import knex from 'knex';
import pg from 'pg';
import config from '../../knexfile.js';

// pg's default DATE parser builds a JS Date at local midnight, which silently
// shifts the calendar day when the server timezone is ahead of UTC. Keep
// dates as raw 'YYYY-MM-DD' strings instead.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

export default db