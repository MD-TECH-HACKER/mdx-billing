/**
 * WARNING: This file connects this app to Anythings's internal auth system. Do
 * not attempt to edit it. Modifying it will have no effect on your project as it is controlled by our system.
 * Do not import @auth/create or @auth/create anywhere else or it may break. This is an internal package.
 */
import CreateAuth from "@auth/create"
import Credentials from "@auth/core/providers/credentials"
import { CredentialsSignin } from '@auth/core/errors'
import { Pool } from '@neondatabase/serverless'
import { hash, verify } from 'argon2'
import Google from "@auth/core/providers/google"

import crypto from 'crypto';

function Adapter(pool) {
  const query = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    // Mimic the pg result structure expected by the old code
    return { rowCount: rows.length || 0, rows: Array.isArray(rows) ? rows : [rows], insertId: rows.insertId };
  };

  return {
    async createVerificationToken(verificationToken) {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token (identifier, expires, token)
        VALUES (?, ?, ?)
      `;
      await query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }) {
      // First select it
      const selectSql = `SELECT identifier, expires, token FROM auth_verification_token WHERE identifier = ? AND token = ?`;
      const result = await query(selectSql, [identifier, token]);
      if (result.rowCount === 0) return null;
      const tokenData = result.rows[0];

      // Then delete it
      const deleteSql = `DELETE FROM auth_verification_token WHERE identifier = ? AND token = ?`;
      await query(deleteSql, [identifier, token]);
      
      return tokenData;
    },

    async createUser(user) {
      const { name, email, emailVerified, image } = user;
      const id = crypto.randomUUID();
      const sql = `
        INSERT INTO auth_users (id, name, email, \`emailVerified\`, image)
        VALUES (?, ?, ?, ?, ?)
      `;
      await query(sql, [id, name, email, emailVerified, image]);
      
      const fetchSql = `SELECT id, name, email, \`emailVerified\`, image FROM auth_users WHERE id = ?`;
      const fetchResult = await query(fetchSql, [id]);
      return fetchResult.rows[0];
    },
    async getUser(id) {
      const sql = 'SELECT * FROM auth_users WHERE id = ?';
      try {
        const result = await query(sql, [id]);
        return result.rowCount === 0 ? null : result.rows[0];
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const sql = 'SELECT * FROM auth_users WHERE email = ?';
      const result = await query(sql, [email]);
      if (result.rowCount === 0) {
        return null;
      }
      const userData = result.rows[0];
      const accountsData = await query(
        'SELECT * FROM auth_accounts WHERE `userId` = ?',
        [userData.id]
      );
      return {
        ...userData,
        accounts: accountsData.rows,
      };
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const sql = `
          SELECT u.* FROM auth_users u JOIN auth_accounts a ON u.id = a.\`userId\`
          WHERE a.provider = ? AND a.\`providerAccountId\` = ?`;

      const result = await query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async updateUser(user) {
      const fetchSql = 'SELECT * FROM auth_users WHERE id = ?';
      const query1 = await query(fetchSql, [user.id]);
      const oldUser = query1.rows[0];

      const newUser = { ...oldUser, ...user };
      const { id, name, email, emailVerified, image } = newUser;
      
      const updateSql = `
        UPDATE auth_users SET
        name = ?, email = ?, \`emailVerified\` = ?, image = ?
        WHERE id = ?
      `;
      await query(updateSql, [name, email, emailVerified, image, id]);
      
      const query2 = await query(fetchSql, [id]);
      return query2.rows[0];
    },
    async linkAccount(account) {
      const id = crypto.randomUUID();
      const sql = `
      INSERT INTO auth_accounts
      (
        id, \`userId\`, provider, type, \`providerAccountId\`, access_token, expires_at, refresh_token, id_token, scope, session_state, token_type, password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type,
        account.extraData?.password,
      ];

      await query(sql, params);
      
      const fetchSql = `SELECT * FROM auth_accounts WHERE id = ?`;
      const result = await query(fetchSql, [id]);
      return result.rows[0];
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === undefined) {
        throw Error('userId is undef in createSession');
      }
      
      const id = crypto.randomUUID();
      const sql = `INSERT INTO auth_sessions (id, \`userId\`, expires, \`sessionToken\`) VALUES (?, ?, ?, ?)`;
      await query(sql, [id, userId, expires, sessionToken]);
      
      const fetchSql = `SELECT id, \`sessionToken\`, \`userId\`, expires FROM auth_sessions WHERE id = ?`;
      const result = await query(fetchSql, [id]);
      return result.rows[0];
    },

    async getSessionAndUser(sessionToken) {
      if (sessionToken === undefined) {
        return null;
      }
      const result1 = await query(
        `SELECT * FROM auth_sessions WHERE \`sessionToken\` = ?`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const session = result1.rows[0];

      const result2 = await query(
        'SELECT * FROM auth_users WHERE id = ?',
        [session.userId]
      );
      if (result2.rowCount === 0) {
        return null;
      }
      const user = result2.rows[0];
      return { session, user };
    },
    async updateSession(session) {
      const { sessionToken } = session;
      const result1 = await query(
        `SELECT * FROM auth_sessions WHERE \`sessionToken\` = ?`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const originalSession = result1.rows[0];

      const newSession = { ...originalSession, ...session };
      const sql = `
        UPDATE auth_sessions SET expires = ? WHERE \`sessionToken\` = ?
      `;
      await query(sql, [newSession.expires, newSession.sessionToken]);
      
      const fetchSql = `SELECT * FROM auth_sessions WHERE \`sessionToken\` = ?`;
      const result2 = await query(fetchSql, [newSession.sessionToken]);
      return result2.rows[0];
    },
    async deleteSession(sessionToken) {
      const sql = `DELETE FROM auth_sessions WHERE \`sessionToken\` = ?`;
      await query(sql, [sessionToken]);
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount;
      const sql = `DELETE FROM auth_accounts WHERE \`providerAccountId\` = ? AND provider = ?`;
      await query(sql, [providerAccountId, provider]);
    },
    async deleteUser(userId) {
      await query('DELETE FROM auth_users WHERE id = ?', [userId]);
      await query('DELETE FROM auth_sessions WHERE \`userId\` = ?', [userId]);
      await query('DELETE FROM auth_accounts WHERE \`userId\` = ?', [userId]);
    },
  };
}
import { pool } from './app/api/utils/sql';
const adapter = Adapter(pool);

export const { auth } = CreateAuth({
  providers: [Credentials({
  id: 'credentials-signin',
  name: 'Credentials Sign in',
  credentials: {
    email: {
      label: 'Email',
      type: 'email',
    },
    password: {
      label: 'Password',
      type: 'password',
    },
  },
  authorize: async (credentials) => {
    const { email, password } = credentials;
    if (!email || !password) {
      return null;
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return null;
    }

    // logic to verify if user exists
    const user = await adapter.getUserByEmail(email);
    if (!user) {
      const error = new CredentialsSignin();
      error.code = 'no-account';
      throw error;
    }
    const matchingAccount = user.accounts.find(
      (account) => account.provider === 'credentials'
    );
    const accountPassword = matchingAccount?.password;
    if (!accountPassword) {
      throw new CredentialsSignin();
    }

    const isValid = await verify(accountPassword, password);
    if (!isValid) {
      throw new CredentialsSignin();
    }

    // return user object with the their profile data
    return user;
  },
}),
  Credentials({
  id: 'credentials-signup',
  name: 'Credentials Sign up',
  credentials: {
    email: {
      label: 'Email',
      type: 'email',
    },
    password: {
      label: 'Password',
      type: 'password',
    },
    name: { label: 'Name', type: 'text', required: false },
    image: { label: 'Image', type: 'text', required: false },
  },
  authorize: async (credentials) => {
    const { email, password } = credentials;
    if (!email || !password) {
      return null;
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return null;
    }

    // logic to verify if user exists
    const user = await adapter.getUserByEmail(email);
    if (!user) {
      const newUser = await adapter.createUser({
        emailVerified: null,
        email,
        name:
          typeof credentials.name === 'string' &&
          credentials.name.trim().length > 0
            ? credentials.name
            : undefined,
        image:
          typeof credentials.image === 'string'
            ? credentials.image
            : undefined,
      });
      await adapter.linkAccount({
        extraData: {
          password: await hash(password),
        },
        type: 'credentials',
        userId: newUser.id,
        providerAccountId: newUser.id,
        provider: 'credentials',
      });
      return newUser;
    }
    return null;
  },
}),
  Google({
        id: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        
      })],
  pages: {
    signIn: '/account/signin',
    signOut: '/account/logout',
  },
})