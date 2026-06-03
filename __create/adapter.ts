import type {
  Adapter,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from '@auth/core/adapters';
import type { ProviderType } from '@auth/core/providers';
import type { Pool } from 'mysql2/promise';
import crypto from 'crypto';

interface MySQLUser extends AdapterUser {
  accounts: {
    provider: string;
    provider_account_id: string;
    password?: string;
  }[];
}

interface MySQLAdapter extends Adapter {
  createUser(data: AdapterUser): Promise<AdapterUser>;
  getUser(userId: string): Promise<AdapterUser | null>;
  getUserByEmail(email: string): Promise<MySQLUser | null>;
  getUserByAccount(data: {
    provider: string;
    providerAccountId: string;
  }): Promise<AdapterUser | null>;
  linkAccount(data: {
    userId: string;
    provider: string;
    providerAccountId: string;
    type: ProviderType;
    access_token?: string | null;
    expires_at?: number | null;
    refresh_token?: string | null;
    id_token?: string | null;
    scope?: string | null;
    session_state?: string | null;
    token_type?: string | null;
    extraData?: Record<string, unknown>;
  }): Promise<void>;
}

export default function MySQLAdapter(client: Pool): MySQLAdapter {
  const query = async (sql: string, params: any[] = []) => {
    try {
      const [rows] = await client.execute(sql, params);
      return {
        rowCount: (rows as any[]).length || 0,
        rows: (Array.isArray(rows) ? rows : [rows]) as any[],
        insertId: (rows as any).insertId,
      };
    } catch (e) {
      console.error('ADAPTER SQL ERROR:', e, sql, params);
      throw e;
    }
  };

  return {
    async createVerificationToken(verificationToken: VerificationToken): Promise<VerificationToken> {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token (identifier, expires, token)
        VALUES (?, ?, ?)
      `;
      await query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
      const selectSql = `SELECT identifier, expires, token FROM auth_verification_token WHERE identifier = ? AND token = ?`;
      const result = await query(selectSql, [identifier, token]);
      if (result.rowCount === 0) return null;
      const tokenData = result.rows[0];

      const deleteSql = `DELETE FROM auth_verification_token WHERE identifier = ? AND token = ?`;
      await query(deleteSql, [identifier, token]);
      
      return tokenData as VerificationToken;
    },

    async createUser(user: Omit<AdapterUser, 'id'>) {
      const { name, email, emailVerified, image } = user;
      const id = crypto.randomUUID();
      const sql = `
        INSERT INTO auth_users (id, name, email, \`emailVerified\`, image)
        VALUES (?, ?, ?, ?, ?)
      `;
      await query(sql, [id, name ?? null, email ?? null, emailVerified ?? null, image ?? null]);
      
      const fetchSql = `SELECT id, name, email, \`emailVerified\`, image FROM auth_users WHERE id = ?`;
      const fetchResult = await query(fetchSql, [id]);
      return fetchResult.rows[0] as AdapterUser;
    },
    async getUser(id: string) {
      const sql = 'SELECT * FROM auth_users WHERE id = ?';
      const result = await query(sql, [id]);
      return result.rowCount === 0 ? null : (result.rows[0] as AdapterUser);
    },
    async getUserByEmail(email: string) {
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
      } as MySQLUser;
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const sql = `
          SELECT u.* FROM auth_users u JOIN auth_accounts a ON u.id = a.\`userId\`
          WHERE a.provider = ? AND a.\`providerAccountId\` = ?`;

      const result = await query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? (result.rows[0] as AdapterUser) : null;
    },
    async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
      const fetchSql = 'SELECT * FROM auth_users WHERE id = ?';
      const query1 = await query(fetchSql, [user.id]);
      const oldUser = query1.rows[0] || {};

      const newUser = { ...oldUser, ...user };
      const { id, name, email, emailVerified, image } = newUser;
      
      const updateSql = `
        UPDATE auth_users SET
        name = ?, email = ?, \`emailVerified\` = ?, image = ?
        WHERE id = ?
      `;
      await query(updateSql, [name ?? null, email ?? null, emailVerified ?? null, image ?? null, id]);
      
      const query2 = await query(fetchSql, [id]);
      return query2.rows[0] as AdapterUser;
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
        account.userId ?? null,
        account.provider ?? null,
        account.type ?? null,
        account.providerAccountId ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.refresh_token ?? null,
        account.id_token ?? null,
        account.scope ?? null,
        account.session_state ?? null,
        account.token_type ?? null,
        account.extraData?.password ?? null,
      ];

      await query(sql, params);
      
      const fetchSql = `SELECT * FROM auth_accounts WHERE id = ?`;
      const result = await query(fetchSql, [id]);
      return result.rows[0] as any;
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
      return result.rows[0] as AdapterSession;
    },

    async getSessionAndUser(sessionToken: string | undefined): Promise<{ session: AdapterSession; user: AdapterUser; } | null> {
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
      const session = result1.rows[0] as AdapterSession;

      const result2 = await query(
        'SELECT * FROM auth_users WHERE id = ?',
        [session.userId]
      );
      if (result2.rowCount === 0) {
        return null;
      }
      const user = result2.rows[0] as AdapterUser;
      return { session, user };
    },
    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>): Promise<AdapterSession | null | undefined> {
      const { sessionToken } = session;
      const result1 = await query(
        `SELECT * FROM auth_sessions WHERE \`sessionToken\` = ?`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const originalSession = result1.rows[0] as AdapterSession;

      const newSession = { ...originalSession, ...session };
      const sql = `
        UPDATE auth_sessions SET expires = ? WHERE \`sessionToken\` = ?
      `;
      await query(sql, [newSession.expires, newSession.sessionToken]);
      
      const fetchSql = `SELECT * FROM auth_sessions WHERE \`sessionToken\` = ?`;
      const result2 = await query(fetchSql, [newSession.sessionToken]);
      return result2.rows[0] as AdapterSession;
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
    async deleteUser(userId: string) {
      await query('DELETE FROM auth_users WHERE id = ?', [userId]);
      await query('DELETE FROM auth_sessions WHERE \`userId\` = ?', [userId]);
      await query('DELETE FROM auth_accounts WHERE \`userId\` = ?', [userId]);
    },
  };
}
