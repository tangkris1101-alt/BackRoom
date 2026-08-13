const ACCOUNT_SCOPE_PREFIX = "backrooms-account";

let activeAccountId = null;

function normalizeAccountId(accountId) {
  return typeof accountId === "string" && /^[a-f0-9-]{16,64}$/i.test(accountId)
    ? accountId.toLowerCase()
    : null;
}

export function setActiveSaveAccount(accountId) {
  activeAccountId = normalizeAccountId(accountId);
  return getActiveSaveScope();
}

export function getActiveSaveAccountId() {
  return activeAccountId;
}

export function getActiveSaveScope() {
  return activeAccountId ? { type: "account", accountId: activeAccountId } : { type: "guest" };
}

export function getScopedStorageKey(baseKey, accountId = activeAccountId) {
  const normalized = normalizeAccountId(accountId);
  return normalized ? `${ACCOUNT_SCOPE_PREFIX}:${normalized}:${baseKey}` : baseKey;
}

export function getAccountMetadataKey(accountId, name) {
  const normalized = normalizeAccountId(accountId);
  if (!normalized || typeof name !== "string" || !name) return null;
  return `${ACCOUNT_SCOPE_PREFIX}:${normalized}:meta:${name}`;
}
