import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

// Access Vite env variable
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Send the httpOnly refresh cookie with requests (the /refresh endpoint reads
  // it). Required for the cookie to be set/sent cross-origin (localhost:5173 →
  // :5000), alongside the backend's CORS `credentials: true`.
  withCredentials: true,
});

// The app has two independent auth realms (platform super-admin vs hospital
// users), each with its own refresh endpoint and login page.
type Realm = "hospital" | "admin";

const REALMS: Record<Realm, { refreshUrl: string; loginPath: string; profileKeys: string[] }> = {
  hospital: {
    refreshUrl: "/hospital-auth/refresh",
    loginPath: "/hospital/login",
    profileKeys: ["hospitalUser", "hospitalInfo", "hospitalBranch", "hospitalSessionId", "activeBranchId"],
  },
  admin: {
    refreshUrl: "/auth/refresh",
    loginPath: "/login",
    profileKeys: ["user"],
  },
};

// ── Access tokens: in MEMORY only ──────────────────────────────────────────
// The access token is short-lived and is NEVER persisted to web storage (which
// is readable by any XSS). It lives in this module variable for the lifetime of
// the page; on reload it's re-obtained silently from the httpOnly refresh
// cookie via the 401→refresh→retry flow below. The refresh token itself never
// touches JavaScript — it's an httpOnly cookie set by the backend.
const accessTokens: Partial<Record<Realm, string | null>> = {};

export function setAccessToken(realm: Realm, token: string | null): void {
  accessTokens[realm] = token;
}

export function getAccessToken(realm: Realm): string | null {
  return accessTokens[realm] ?? null;
}

// Hospital-portal API prefixes use the hospital token; everything else uses the
// super-admin token. (Same rule the request interceptor has always used.)
function realmForUrl(url?: string): Realm {
  if (url && /^\/(hospital|reception|doctor|nurse|lab|pharmacy|billing)/.test(url)) {
    return "hospital";
  }
  return "admin";
}

// Interceptor to attach the in-memory access token.
axiosInstance.interceptors.request.use(
  (config) => {
    const realm = realmForUrl(config.url);
    const token = accessTokens[realm];
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // For hospital-portal requests, tell the backend which branch this request
    // targets. The backend validates it against the user's allowed branches.
    if (realm === "hospital" && config.headers) {
      const activeBranchId = sessionStorage.getItem("activeBranchId");
      if (activeBranchId) {
        config.headers["X-Branch-Id"] = activeBranchId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function clearRealm(realm: Realm) {
  accessTokens[realm] = null;
  REALMS[realm].profileKeys.forEach((k) => sessionStorage.removeItem(k));
}

function redirectToLogin(realm: Realm) {
  const path = REALMS[realm].loginPath;
  if (window.location.pathname !== path) {
    window.location.assign(path);
  }
}

// One in-flight refresh per realm — concurrent 401s share the same attempt.
const refreshing: Partial<Record<Realm, Promise<string | null>>> = {};

async function doRefresh(realm: Realm): Promise<string | null> {
  const r = REALMS[realm];
  try {
    // Bare axios call (not axiosInstance) so it doesn't recurse through these
    // interceptors. The refresh token rides along as the httpOnly cookie, so we
    // send no body — `withCredentials` makes the browser attach the cookie.
    const resp = await axios.post(`${API_URL}${r.refreshUrl}`, {}, { withCredentials: true });
    const accessToken = resp.data?.data?.tokens?.accessToken;
    if (!accessToken) return null;
    accessTokens[realm] = accessToken;
    return accessToken;
  } catch {
    return null;
  }
}

// Response interceptor: on 401, try a token refresh + retry once; if that fails,
// clear the session and redirect to the correct login (instead of leaving the
// page silently broken).
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url || "";

    // Don't intervene on a failed login/refresh itself (e.g. a 401 for wrong
    // credentials must surface to the login form, not trigger a redirect loop).
    const isAuthEndpoint = /(-?auth)\/(login|refresh)/.test(url);

    if (status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    const realm = realmForUrl(url);
    original._retry = true;

    if (!refreshing[realm]) {
      refreshing[realm] = doRefresh(realm).finally(() => {
        refreshing[realm] = undefined;
      });
    }
    const newToken = await refreshing[realm];

    if (!newToken) {
      clearRealm(realm);
      redirectToLogin(realm);
      return Promise.reject(error);
    }

    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
    return axiosInstance(original);
  }
);
