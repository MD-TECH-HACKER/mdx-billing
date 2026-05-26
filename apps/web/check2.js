import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
sql`SELECT * FROM auth_users`.then(console.log).catch(console.error);
