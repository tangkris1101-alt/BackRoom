import { CLOUD_SAVE_SCHEMA_VERSION } from "./save-schema.js";
import { getAccountMetadataKey } from "./save-scope.js";

const DEVICE_ID_KEY = "backrooms-device-id";
const SYNC_DEBOUNCE_MS = 1400;

const COPY = {
  "zh-CN": {
    guestLabel: "游客模式",
    guestHint: "存档仅保存在此设备",
    offlineLabel: "本地存档",
    offlineHint: "云存档需使用在线版本",
    accountTitle: "账户与云存档",
    signedOut: "登录后可跨设备保留进度；不登录仍可使用本地存档。",
    signedIn: "已登录",
    login: "登录",
    register: "注册",
    verify: "验证邮箱",
    forgot: "找回密码",
    reset: "重置密码",
    email: "邮箱",
    displayName: "昵称",
    password: "密码（至少 10 位，包含字母和数字）",
    newPassword: "新密码（至少 10 位，包含字母和数字）",
    token: "验证令牌",
    loginAction: "登录账户",
    registerAction: "创建账户",
    verifyAction: "完成验证",
    forgotAction: "发送重置邮件",
    resetAction: "更新密码",
    resend: "重新发送验证邮件",
    logout: "退出账户",
    syncNow: "立即同步",
    close: "关闭账户面板",
    syncing: "正在同步…",
    synced: "云存档已同步",
    localOnly: "离线保存，联网后重试",
    conflict: "检测到两份不同的存档",
    conflictHint: "请选择保留当前设备存档或云端存档。不会自动合并背包、实体和门状态。",
    currentDevice: "当前设备",
    cloud: "云端",
    keepLocal: "保留当前设备并覆盖云端",
    useCloud: "使用云端存档",
    importTitle: "发现游客存档",
    importHint: "是否把当前游客进度复制到账户？游客原件会继续保留。",
    importGuest: "复制游客进度到账户",
    startBlank: "账户从头开始",
    noSave: "尚无存档",
    level: "层级",
    runtime: "用时",
    savedAt: "保存时间",
    requestFailed: "账户服务暂时不可用，本地游戏仍可继续。",
    registered: "账户已创建，请验证邮箱。",
    verified: "邮箱验证成功，现在可以登录。",
    verificationSent: "如果账户尚未验证，新的验证邮件已经发送。",
    resetSent: "如果邮箱存在，重置邮件已经发送。",
    resetDone: "密码已更新，请重新登录。",
    loggedOut: "已退出，现已切回游客存档。",
  },
  en: {
    guestLabel: "GUEST MODE",
    guestHint: "SAVE STORED ON THIS DEVICE",
    offlineLabel: "LOCAL SAVE",
    offlineHint: "CLOUD SAVES REQUIRE THE ONLINE BUILD",
    accountTitle: "ACCOUNT & CLOUD SAVE",
    signedOut: "Sign in for cross-device saves. Guest local saves remain available.",
    signedIn: "SIGNED IN",
    login: "LOGIN",
    register: "REGISTER",
    verify: "VERIFY EMAIL",
    forgot: "RESET PASSWORD",
    reset: "SET NEW PASSWORD",
    email: "Email",
    displayName: "Display name",
    password: "Password (10+ characters with letters and numbers)",
    newPassword: "New password (10+ characters with letters and numbers)",
    token: "Verification token",
    loginAction: "SIGN IN",
    registerAction: "CREATE ACCOUNT",
    verifyAction: "VERIFY",
    forgotAction: "SEND RESET EMAIL",
    resetAction: "UPDATE PASSWORD",
    resend: "RESEND VERIFICATION",
    logout: "SIGN OUT",
    syncNow: "SYNC NOW",
    close: "Close account panel",
    syncing: "SYNCING…",
    synced: "CLOUD SAVE SYNCED",
    localOnly: "SAVED OFFLINE; WILL RETRY",
    conflict: "TWO DIFFERENT SAVES WERE FOUND",
    conflictHint: "Choose the device or cloud copy. Inventory, entities, and doors are never merged automatically.",
    currentDevice: "THIS DEVICE",
    cloud: "CLOUD",
    keepLocal: "KEEP DEVICE SAVE & REPLACE CLOUD",
    useCloud: "USE CLOUD SAVE",
    importTitle: "GUEST SAVE FOUND",
    importHint: "Copy the guest progress into this account? The guest copy will be preserved.",
    importGuest: "COPY GUEST SAVE TO ACCOUNT",
    startBlank: "START ACCOUNT FROM LEVEL 0",
    noSave: "NO SAVE",
    level: "LEVEL",
    runtime: "TIME",
    savedAt: "SAVED",
    requestFailed: "Account service is unavailable. Local play still works.",
    registered: "Account created. Verify your email to continue.",
    verified: "Email verified. You can now sign in.",
    verificationSent: "If the account is not verified, a new verification email has been sent.",
    resetSent: "If the address exists, a reset email has been sent.",
    resetDone: "Password updated. Sign in again.",
    loggedOut: "Signed out. Guest save is active again.",
  },
};

function safeStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function getDeviceId() {
  const storage = safeStorage();
  const existing = storage?.getItem(DEVICE_ID_KEY);
  if (existing && /^[a-z0-9-]{8,80}$/i.test(existing)) return existing;
  const created = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    storage?.setItem(DEVICE_ID_KEY, created);
  } catch {
    // A device identifier is helpful but not required for local play.
  }
  return created;
}

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {
      credentials: "same-origin",
      headers: options.body ? { "content-type": "application/json" } : undefined,
      ...options,
      signal: controller.signal,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `HTTP ${response.status}`);
    error.code = payload.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function readMetadata(accountId) {
  const storage = safeStorage();
  const key = getAccountMetadataKey(accountId, "cloud");
  if (!storage || !key) return { revision: 0, lastSyncedClientSavedAt: 0 };
  try {
    const value = JSON.parse(storage.getItem(key) ?? "{}");
    return {
      revision: Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
      lastSyncedClientSavedAt: Number.isFinite(value.lastSyncedClientSavedAt) ? value.lastSyncedClientSavedAt : 0,
    };
  } catch {
    return { revision: 0, lastSyncedClientSavedAt: 0 };
  }
}

function writeMetadata(accountId, revision, envelope) {
  const storage = safeStorage();
  const key = getAccountMetadataKey(accountId, "cloud");
  if (!storage || !key) return;
  try {
    storage.setItem(key, JSON.stringify({
      revision,
      lastSyncedClientSavedAt: envelope?.clientSavedAt ?? 0,
    }));
  } catch {
    // The account save itself remains available even if metadata cannot persist.
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function saveSummary(envelope, text) {
  if (!envelope?.gameSave?.player) return text.noSave;
  const player = envelope.gameSave.player;
  const timestamp = envelope.clientSavedAt || envelope.gameSave.savedAt;
  const saved = timestamp ? new Date(timestamp).toLocaleString() : "--";
  return `${text.level} ${player.level} · ${text.runtime} ${formatTime(player.runTime)} · ${text.savedAt} ${saved}`;
}

export function createAccountSystem(hooks) {
  const elements = {
    menuButton: document.querySelector("#main-menu-account"),
    menuLabel: document.querySelector("#main-menu-account-label"),
    menuHint: document.querySelector("#main-menu-account-hint"),
    modal: document.querySelector("#account-modal"),
    panel: document.querySelector(".account-modal__panel"),
    close: document.querySelector("#account-close"),
    title: document.querySelector("#account-title"),
    description: document.querySelector("#account-description"),
    message: document.querySelector("#account-message"),
    guestView: document.querySelector("#account-guest-view"),
    signedInView: document.querySelector("#account-signed-in-view"),
    userName: document.querySelector("#account-user-name"),
    userEmail: document.querySelector("#account-user-email"),
    syncState: document.querySelector("#account-sync-state"),
    forms: [...document.querySelectorAll("[data-account-form]")],
    tabs: [...document.querySelectorAll("[data-account-mode]")],
    conflict: document.querySelector("#account-conflict"),
    conflictTitle: document.querySelector("#account-conflict-title"),
    conflictHint: document.querySelector("#account-conflict-hint"),
    localSummary: document.querySelector("#account-local-summary"),
    cloudSummary: document.querySelector("#account-cloud-summary"),
    keepLocal: document.querySelector("#account-keep-local"),
    useCloud: document.querySelector("#account-use-cloud"),
    importGuest: document.querySelector("#account-import-guest"),
    startBlank: document.querySelector("#account-start-blank"),
    sync: document.querySelector("#account-sync"),
    logout: document.querySelector("#account-logout"),
    resendVerification: document.querySelector("#account-resend-verification"),
  };
  const supported = window.location.protocol === "http:" || window.location.protocol === "https:";
  let user = null;
  let mode = "login";
  let syncTimer = 0;
  let syncStatus = "idle";
  let revision = 0;
  let conflictCloud = null;
  let guestMigration = null;
  let busy = false;

  const text = () => COPY[hooks.getLanguage?.() === "en" ? "en" : "zh-CN"];

  function setMessage(message = "", kind = "info") {
    if (!elements.message) return;
    elements.message.textContent = message;
    elements.message.dataset.kind = kind;
    elements.message.toggleAttribute("hidden", !message);
  }

  function render() {
    const t = text();
    if (elements.title) elements.title.textContent = t.accountTitle;
    if (elements.close) elements.close.setAttribute("aria-label", t.close);
    if (!supported) {
      if (elements.menuLabel) elements.menuLabel.textContent = t.offlineLabel;
      if (elements.menuHint) elements.menuHint.textContent = t.offlineHint;
      if (elements.menuButton) elements.menuButton.disabled = true;
      return;
    }
    if (elements.menuButton) elements.menuButton.disabled = false;
    if (elements.menuLabel) elements.menuLabel.textContent = user ? user.displayName : t.guestLabel;
    if (elements.menuHint) {
      elements.menuHint.textContent = user
        ? (syncStatus === "syncing" ? t.syncing : syncStatus === "error" ? t.localOnly : syncStatus === "conflict" ? t.conflict : t.synced)
        : t.guestHint;
    }
    elements.guestView?.toggleAttribute("hidden", Boolean(user));
    elements.signedInView?.toggleAttribute("hidden", !user);
    if (elements.description) elements.description.textContent = user ? t.signedIn : t.signedOut;
    if (elements.userName) elements.userName.textContent = user?.displayName ?? "";
    if (elements.userEmail) elements.userEmail.textContent = user?.email ?? "";
    if (elements.syncState) {
      elements.syncState.textContent = syncStatus === "syncing"
        ? t.syncing
        : syncStatus === "error"
          ? t.localOnly
          : syncStatus === "conflict"
            ? t.conflict
            : t.synced;
      elements.syncState.dataset.state = syncStatus;
    }
    elements.forms.forEach((form) => form.toggleAttribute("hidden", form.dataset.accountForm !== mode));
    elements.tabs.forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.accountMode === mode));
      const labels = { login: t.login, register: t.register, forgot: t.forgot, verify: t.verify, reset: t.reset };
      if (labels[tab.dataset.accountMode]) tab.textContent = labels[tab.dataset.accountMode];
    });
    document.querySelector("#account-login-email")?.setAttribute("placeholder", t.email);
    document.querySelector("#account-login-password")?.setAttribute("placeholder", t.password);
    document.querySelector("#account-register-name")?.setAttribute("placeholder", t.displayName);
    document.querySelector("#account-register-email")?.setAttribute("placeholder", t.email);
    document.querySelector("#account-register-password")?.setAttribute("placeholder", t.password);
    document.querySelector("#account-verify-email")?.setAttribute("placeholder", t.email);
    document.querySelector("#account-verify-token")?.setAttribute("placeholder", t.token);
    document.querySelector("#account-forgot-email")?.setAttribute("placeholder", t.email);
    document.querySelector("#account-reset-token")?.setAttribute("placeholder", t.token);
    document.querySelector("#account-reset-password")?.setAttribute("placeholder", t.newPassword);
    const actionLabels = {
      "account-login-submit": t.loginAction,
      "account-register-submit": t.registerAction,
      "account-verify-submit": t.verifyAction,
      "account-resend-verification": t.resend,
      "account-forgot-submit": t.forgotAction,
      "account-reset-submit": t.resetAction,
      "account-sync": t.syncNow,
      "account-logout": t.logout,
      "account-keep-local": t.keepLocal,
      "account-use-cloud": t.useCloud,
      "account-import-guest": t.importGuest,
      "account-start-blank": t.startBlank,
    };
    Object.entries(actionLabels).forEach(([id, label]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = label;
    });
    elements.conflict?.toggleAttribute("hidden", syncStatus !== "conflict" && !guestMigration);
    if (elements.conflictTitle) elements.conflictTitle.textContent = guestMigration ? t.importTitle : t.conflict;
    if (elements.conflictHint) elements.conflictHint.textContent = guestMigration ? t.importHint : t.conflictHint;
    elements.keepLocal?.toggleAttribute("hidden", Boolean(guestMigration));
    elements.useCloud?.toggleAttribute("hidden", Boolean(guestMigration));
    elements.importGuest?.toggleAttribute("hidden", !guestMigration);
    elements.startBlank?.toggleAttribute("hidden", !guestMigration);
    if (elements.localSummary) {
      elements.localSummary.textContent = saveSummary(guestMigration ?? hooks.getActiveEnvelope?.(), t);
    }
    if (elements.cloudSummary) elements.cloudSummary.textContent = saveSummary(conflictCloud, t);
    elements.forms.forEach((form) => {
      [...form.elements].forEach((control) => { control.disabled = busy; });
    });
  }

  function setMode(nextMode) {
    mode = ["login", "register", "verify", "forgot", "reset"].includes(nextMode) ? nextMode : "login";
    setMessage();
    render();
  }

  function setOpen(open) {
    if (!elements.modal || !supported) return;
    elements.modal.toggleAttribute("hidden", !open);
    elements.modal.classList.toggle("is-visible", open);
    if (open) {
      render();
      window.requestAnimationFrame(() => elements.panel?.querySelector("input:not([hidden]), button")?.focus());
    } else {
      elements.menuButton?.focus();
    }
  }

  function updateMetadata(envelope) {
    if (user) writeMetadata(user.id, revision, envelope);
  }

  async function reconcile() {
    if (!user) return;
    const local = hooks.getActiveEnvelope?.();
    const guest = hooks.getGuestEnvelope?.();
    const metadata = readMetadata(user.id);
    syncStatus = "syncing";
    render();
    try {
      const remote = await apiRequest("/save");
      revision = remote.revision;
      if (local && remote.save) {
        const localChanged = local.clientSavedAt > metadata.lastSyncedClientSavedAt;
        const cloudChanged = remote.revision !== metadata.revision;
        if (localChanged && cloudChanged) {
          conflictCloud = remote.save;
          syncStatus = "conflict";
        } else if (cloudChanged) {
          hooks.applyEnvelope?.(remote.save);
          updateMetadata(remote.save);
          syncStatus = "synced";
        } else if (localChanged) {
          await syncNow();
        } else {
          syncStatus = "synced";
        }
      } else if (remote.save) {
        hooks.applyEnvelope?.(remote.save);
        updateMetadata(remote.save);
        syncStatus = "synced";
      } else if (local) {
        await syncNow();
      } else if (guest) {
        guestMigration = guest;
        syncStatus = "idle";
      } else {
        updateMetadata(null);
        syncStatus = "synced";
      }
    } catch {
      syncStatus = "error";
    }
    render();
  }

  async function activateUser(nextUser) {
    user = nextUser;
    hooks.activateAccount?.(user);
    revision = user ? readMetadata(user.id).revision : 0;
    conflictCloud = null;
    guestMigration = null;
    syncStatus = user ? "syncing" : "idle";
    render();
    if (user) await reconcile();
  }

  async function syncNow() {
    if (!user || syncStatus === "conflict") return false;
    const localEnvelope = hooks.getActiveEnvelope?.();
    if (!localEnvelope) return false;
    const envelope = { ...localEnvelope, deviceId: localEnvelope.deviceId || getDeviceId() };
    syncStatus = "syncing";
    render();
    try {
      const result = await apiRequest("/save", {
        method: "PUT",
        body: { baseRevision: revision, envelope },
      });
      revision = result.revision;
      updateMetadata(envelope);
      syncStatus = "synced";
      render();
      return true;
    } catch (error) {
      if (error.code === "SAVE_CONFLICT") {
        conflictCloud = error.payload.save;
        revision = error.payload.revision;
        syncStatus = "conflict";
      } else {
        syncStatus = "error";
      }
      render();
      return false;
    }
  }

  function notifyLocalChange() {
    if (!user || syncStatus === "conflict") return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = 0;
      syncNow();
    }, SYNC_DEBOUNCE_MS);
  }

  async function handleForm(form) {
    const data = new FormData(form);
    busy = true;
    render();
    try {
      if (form.dataset.accountForm === "login") {
        const result = await apiRequest("/auth/login", {
          method: "POST",
          body: { email: data.get("email"), password: data.get("password") },
        });
        await activateUser(result.user);
        setMessage();
        return;
      }
      if (form.dataset.accountForm === "register") {
        const result = await apiRequest("/auth/register", {
          method: "POST",
          body: { email: data.get("email"), displayName: data.get("displayName"), password: data.get("password") },
        });
        const verifyInput = document.querySelector("#account-verify-token");
        const verifyEmail = document.querySelector("#account-verify-email");
        if (verifyInput && result.testVerificationToken) verifyInput.value = result.testVerificationToken;
        if (verifyEmail) verifyEmail.value = String(data.get("email") ?? "");
        setMode("verify");
        setMessage(text().registered, "success");
        return;
      }
      if (form.dataset.accountForm === "verify") {
        await apiRequest("/auth/verify-email", { method: "POST", body: { token: data.get("token") } });
        setMode("login");
        setMessage(text().verified, "success");
        return;
      }
      if (form.dataset.accountForm === "forgot") {
        const result = await apiRequest("/auth/forgot-password", { method: "POST", body: { email: data.get("email") } });
        const resetInput = document.querySelector("#account-reset-token");
        if (resetInput && result.testResetToken) resetInput.value = result.testResetToken;
        setMode(result.testResetToken ? "reset" : "login");
        setMessage(text().resetSent, "success");
        return;
      }
      if (form.dataset.accountForm === "reset") {
        await apiRequest("/auth/reset-password", {
          method: "POST",
          body: { token: data.get("token"), password: data.get("password") },
        });
        setMode("login");
        setMessage(text().resetDone, "success");
      }
    } catch (error) {
      setMessage(error.message || text().requestFailed, "error");
    } finally {
      busy = false;
      render();
    }
  }

  elements.menuButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setOpen(true);
  });
  elements.close?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setOpen(false);
  });
  elements.tabs.forEach((tab) => tab.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setMode(tab.dataset.accountMode);
  }));
  elements.forms.forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleForm(form);
  }));
  elements.sync?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    syncNow();
  });
  elements.resendVerification?.addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#account-verify-email")?.value;
    if (!email) {
      setMessage(text().requestFailed, "error");
      return;
    }
    busy = true;
    render();
    try {
      const result = await apiRequest("/auth/resend-verification", { method: "POST", body: { email } });
      const verifyInput = document.querySelector("#account-verify-token");
      if (verifyInput && result.testVerificationToken) verifyInput.value = result.testVerificationToken;
      setMessage(text().verificationSent, "success");
    } catch (error) {
      setMessage(error.message || text().requestFailed, "error");
    } finally {
      busy = false;
      render();
    }
  });
  elements.logout?.addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    if (syncTimer) {
      window.clearTimeout(syncTimer);
      syncTimer = 0;
    }
    if (syncStatus !== "conflict") await syncNow();
    await apiRequest("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    await activateUser(null);
    setMessage(text().loggedOut, "success");
  });
  elements.keepLocal?.addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    syncStatus = "idle";
    conflictCloud = null;
    await syncNow();
  });
  elements.useCloud?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (conflictCloud) {
      hooks.applyEnvelope?.(conflictCloud);
      updateMetadata(conflictCloud);
    }
    conflictCloud = null;
    syncStatus = "synced";
    render();
  });
  elements.importGuest?.addEventListener("pointerdown", async (event) => {
    event.preventDefault();
    if (guestMigration) hooks.applyEnvelope?.(guestMigration);
    guestMigration = null;
    syncStatus = "idle";
    await syncNow();
  });
  elements.startBlank?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    guestMigration = null;
    syncStatus = "synced";
    updateMetadata(null);
    render();
  });

  async function initialize() {
    render();
    if (!supported) return;
    const query = new URLSearchParams(window.location.search);
    const action = query.get("accountAction");
    const token = query.get("token");
    if (action === "verify" && token) {
      setMode("verify");
      const input = document.querySelector("#account-verify-token");
      if (input) input.value = token;
      setOpen(true);
    } else if (action === "reset" && token) {
      setMode("reset");
      const input = document.querySelector("#account-reset-token");
      if (input) input.value = token;
      setOpen(true);
    }
    if ((action === "verify" || action === "reset") && token) {
      query.delete("accountAction");
      query.delete("token");
      const cleanQuery = query.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`);
    }
    try {
      const result = await apiRequest("/auth/me");
      if (result.user) await activateUser(result.user);
    } catch {
      syncStatus = "error";
      render();
    }
  }

  return {
    initialize,
    notifyLocalChange,
    syncNow,
    render,
    isSignedIn: () => Boolean(user),
    getUser: () => user,
    isOpen: () => Boolean(elements.modal && !elements.modal.hasAttribute("hidden")),
    close: () => setOpen(false),
    async deleteCloudSave() {
      if (!user) return true;
      try {
        const result = await apiRequest("/save", { method: "DELETE", body: { baseRevision: revision } });
        revision = result.revision;
        updateMetadata(null);
        syncStatus = "synced";
        return true;
      } catch (error) {
        if (error.code === "SAVE_CONFLICT") {
          conflictCloud = error.payload.save;
          revision = error.payload.revision;
          syncStatus = "conflict";
          render();
        }
        return false;
      }
    },
  };
}
