import mysql from "mysql2/promise";

function fromMysqlDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    emailVerifiedAt: fromMysqlDate(row.email_verified_at),
    verificationTokenHash: row.verification_token_hash,
    verificationExpiresAt: fromMysqlDate(row.verification_expires_at),
    createdAt: fromMysqlDate(row.created_at),
    passwordChangedAt: fromMysqlDate(row.password_changed_at),
  };
}

export class MysqlAccountStore {
  constructor(pool) {
    this.pool = pool;
  }

  static create(config) {
    return new MysqlAccountStore(mysql.createPool({
      ...config,
      waitForConnections: true,
      queueLimit: 0,
      charset: "utf8mb4",
      timezone: "Z",
      decimalNumbers: true,
    }));
  }

  async close() {
    await this.pool.end();
  }

  async createUser(user) {
    try {
      await this.pool.execute(
        `INSERT INTO users
          (id, email, display_name, password_hash, verification_token_hash, verification_expires_at, created_at)
         VALUES (?, ?, ?, ?, UNHEX(?), FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))`,
        [user.id, user.email, user.displayName, user.passwordHash, user.verificationTokenHash, user.verificationExpiresAt, user.createdAt],
      );
      return this.findUserById(user.id);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") return null;
      throw error;
    }
  }

  async findUserByEmail(email) {
    const [rows] = await this.pool.execute(
      "SELECT *, HEX(verification_token_hash) AS verification_token_hash FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    return mapUser(rows[0]);
  }

  async findUserById(id) {
    const [rows] = await this.pool.execute(
      "SELECT *, HEX(verification_token_hash) AS verification_token_hash FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    return mapUser(rows[0]);
  }

  async setVerificationToken(userId, tokenHash, expiresAt) {
    const [result] = await this.pool.execute(
      "UPDATE users SET verification_token_hash = UNHEX(?), verification_expires_at = FROM_UNIXTIME(? / 1000) WHERE id = ?",
      [tokenHash, expiresAt, userId],
    );
    return result.affectedRows === 1;
  }

  async verifyEmail(tokenHash, now) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT id FROM users WHERE verification_token_hash = UNHEX(?) AND verification_expires_at > FROM_UNIXTIME(? / 1000) FOR UPDATE",
        [tokenHash, now],
      );
      if (!rows[0]) {
        await connection.rollback();
        return null;
      }
      await connection.execute(
        "UPDATE users SET email_verified_at = FROM_UNIXTIME(? / 1000), verification_token_hash = NULL, verification_expires_at = NULL WHERE id = ?",
        [now, rows[0].id],
      );
      await connection.commit();
      return this.findUserById(rows[0].id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updatePassword(userId, passwordHash, now) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        "UPDATE users SET password_hash = ?, password_changed_at = FROM_UNIXTIME(? / 1000) WHERE id = ?",
        [passwordHash, now, userId],
      );
      await connection.execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
      await connection.commit();
      return result.affectedRows === 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createSession(session) {
    await this.pool.execute(
      "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (UNHEX(?), ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))",
      [session.tokenHash, session.userId, session.expiresAt, session.createdAt],
    );
  }

  async findSession(tokenHash, now) {
    const [rows] = await this.pool.execute(
      `SELECT u.*, HEX(u.verification_token_hash) AS verification_token_hash,
              s.user_id AS session_user_id,
              s.expires_at AS session_expires_at,
              s.created_at AS session_created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = UNHEX(?) AND s.expires_at > FROM_UNIXTIME(? / 1000) LIMIT 1`,
      [tokenHash, now],
    );
    if (!rows[0]) return null;
    return {
      session: {
        userId: rows[0].session_user_id,
        expiresAt: fromMysqlDate(rows[0].session_expires_at),
        createdAt: fromMysqlDate(rows[0].session_created_at),
      },
      user: mapUser(rows[0]),
    };
  }

  async deleteSession(tokenHash) {
    await this.pool.execute("DELETE FROM sessions WHERE token_hash = UNHEX(?)", [tokenHash]);
  }

  async createPasswordReset(reset) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM password_resets WHERE user_id = ?", [reset.userId]);
      await connection.execute(
        "INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (UNHEX(?), ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))",
        [reset.tokenHash, reset.userId, reset.expiresAt, reset.createdAt],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async consumePasswordReset(tokenHash, now) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = UNHEX(?) FOR UPDATE",
        [tokenHash],
      );
      const row = rows[0];
      if (!row || row.used_at || fromMysqlDate(row.expires_at) <= now) {
        await connection.rollback();
        return null;
      }
      await connection.execute(
        "UPDATE password_resets SET used_at = FROM_UNIXTIME(? / 1000) WHERE token_hash = UNHEX(?)",
        [now, tokenHash],
      );
      await connection.commit();
      return { userId: row.user_id, expiresAt: fromMysqlDate(row.expires_at), usedAt: now };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getSave(userId, connection = this.pool) {
    const [rows] = await connection.execute(
      "SELECT revision, envelope_json, updated_at FROM game_saves WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (!rows[0]) return { revision: 0, envelope: null, updatedAt: null };
    const envelope = typeof rows[0].envelope_json === "string"
      ? JSON.parse(rows[0].envelope_json)
      : rows[0].envelope_json;
    return { revision: Number(rows[0].revision), envelope: envelope ?? null, updatedAt: fromMysqlDate(rows[0].updated_at) };
  }

  async mutateSave(userId, expectedRevision, envelope, now) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT revision, envelope_json, updated_at FROM game_saves WHERE user_id = ? FOR UPDATE",
        [userId],
      );
      const current = rows[0]
        ? {
            revision: Number(rows[0].revision),
            envelope: typeof rows[0].envelope_json === "string" ? JSON.parse(rows[0].envelope_json) : rows[0].envelope_json,
            updatedAt: fromMysqlDate(rows[0].updated_at),
          }
        : { revision: 0, envelope: null, updatedAt: null };
      if (current.revision !== expectedRevision) {
        await connection.rollback();
        return { conflict: true, current };
      }
      if (rows[0] && current.envelope) {
        await connection.execute(
          "INSERT INTO game_save_revisions (user_id, revision, envelope_json, saved_at) VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000))",
          [userId, current.revision, JSON.stringify(current.envelope), now],
        );
      }
      const revision = current.revision + 1;
      const json = envelope ? JSON.stringify(envelope) : null;
      await connection.execute(
        `INSERT INTO game_saves (user_id, revision, envelope_json, updated_at)
         VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000))
         ON DUPLICATE KEY UPDATE revision = VALUES(revision), envelope_json = VALUES(envelope_json), updated_at = VALUES(updated_at)`,
        [userId, revision, json, now],
      );
      await connection.commit();
      return { conflict: false, current: { revision, envelope, updatedAt: now } };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  putSave(userId, expectedRevision, envelope, now) {
    return this.mutateSave(userId, expectedRevision, envelope, now);
  }

  deleteSave(userId, expectedRevision, now) {
    return this.mutateSave(userId, expectedRevision, null, now);
  }
}
