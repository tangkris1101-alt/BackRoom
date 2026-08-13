export class MemoryAccountStore {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.sessions = new Map();
    this.passwordResets = new Map();
    this.saves = new Map();
  }

  async close() {}

  async createUser(user) {
    if (this.usersByEmail.has(user.email)) return null;
    const stored = { ...user };
    this.users.set(user.id, stored);
    this.usersByEmail.set(user.email, user.id);
    return { ...stored };
  }

  async findUserByEmail(email) {
    const id = this.usersByEmail.get(email);
    const user = id ? this.users.get(id) : null;
    return user ? { ...user } : null;
  }

  async findUserById(id) {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async setVerificationToken(userId, tokenHash, expiresAt) {
    const user = this.users.get(userId);
    if (!user) return false;
    Object.assign(user, { verificationTokenHash: tokenHash, verificationExpiresAt: expiresAt });
    return true;
  }

  async verifyEmail(tokenHash, now) {
    for (const user of this.users.values()) {
      if (user.verificationTokenHash !== tokenHash || user.verificationExpiresAt <= now) continue;
      user.emailVerifiedAt = now;
      user.verificationTokenHash = null;
      user.verificationExpiresAt = null;
      return { ...user };
    }
    return null;
  }

  async updatePassword(userId, passwordHash, now) {
    const user = this.users.get(userId);
    if (!user) return false;
    user.passwordHash = passwordHash;
    user.passwordChangedAt = now;
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(tokenHash);
    }
    return true;
  }

  async createSession(session) {
    this.sessions.set(session.tokenHash, { ...session });
  }

  async findSession(tokenHash, now) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) {
      if (session) this.sessions.delete(tokenHash);
      return null;
    }
    const user = this.users.get(session.userId);
    return user ? { session: { ...session }, user: { ...user } } : null;
  }

  async deleteSession(tokenHash) {
    this.sessions.delete(tokenHash);
  }

  async createPasswordReset(reset) {
    for (const [tokenHash, current] of this.passwordResets) {
      if (current.userId === reset.userId) this.passwordResets.delete(tokenHash);
    }
    this.passwordResets.set(reset.tokenHash, { ...reset });
  }

  async consumePasswordReset(tokenHash, now) {
    const reset = this.passwordResets.get(tokenHash);
    if (!reset || reset.expiresAt <= now || reset.usedAt) return null;
    reset.usedAt = now;
    return { ...reset };
  }

  async getSave(userId) {
    const current = this.saves.get(userId);
    return current ? structuredClone(current) : { revision: 0, envelope: null, updatedAt: null };
  }

  async putSave(userId, expectedRevision, envelope, now) {
    const current = await this.getSave(userId);
    if (current.revision !== expectedRevision) return { conflict: true, current };
    const next = { revision: current.revision + 1, envelope: structuredClone(envelope), updatedAt: now };
    this.saves.set(userId, next);
    return { conflict: false, current: structuredClone(next) };
  }

  async deleteSave(userId, expectedRevision, now) {
    const current = await this.getSave(userId);
    if (current.revision !== expectedRevision) return { conflict: true, current };
    const next = { revision: current.revision + 1, envelope: null, updatedAt: now };
    this.saves.set(userId, next);
    return { conflict: false, current: structuredClone(next) };
  }
}
