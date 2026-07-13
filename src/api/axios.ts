import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

// Access Vite env variable — the single source of truth for the backend's
// base URL. Other modules that need it (asset URLs, the socket connection,
// the AI summary stream) should import this rather than hardcoding their own
// fallback, which can silently drift from this one.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// The app has two independent auth realms (platform super-admin vs hospital
// users), each with its own token storage, refresh endpoint, and login page.
type Realm = "hospital" | "admin";

const REALMS: Record<Realm, { access: string; refresh: string; refreshUrl: string; loginPath: string }> = {
  hospital: {
    access: "hospitalAccessToken",
    refresh: "hospitalRefreshToken",
    refreshUrl: "/hospital-auth/refresh",
    loginPath: "/hospital/login",
  },
  admin: {
    access: "accessToken",
    refresh: "refreshToken",
    refreshUrl: "/auth/refresh",
    loginPath: "/login",
  },
};

// Hospital-portal API prefixes use the hospital token; everything else uses the
// super-admin token. (Same rule the request interceptor has always used.)
//
// The trailing \b is required: without it, "/hospital" as a bare PREFIX match
// also matches the super-admin's own "/hospitals" (list/CRUD) endpoint — "l"
// and "s" are both word characters, so there's no boundary between them and
// the match slips through. That misclassified every /hospitals call as the
// hospital-PORTAL realm, which sent the wrong (nonexistent) token, 401'd, and
// bounced the super-admin to the hospital-staff login page instead of their
// own. \b forces a real path-segment boundary, so "/hospital/..." still
// matches (boundary before "/") but "/hospitals" no longer does.
function realmForUrl(url?: string): Realm {
  if (url && /^\/(hospital|reception|doctor|nurse|lab|pharmacy|billing|ipd|vaccination|claims)\b/.test(url)) {
    return "hospital";
  }
  return "admin";
}

// Interceptor to attach access token
axiosInstance.interceptors.request.use(
  (config) => {
    const realm = realmForUrl(config.url);
    const token = sessionStorage.getItem(REALMS[realm].access);
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
  const keys =
    realm === "hospital"
      ? ["hospitalAccessToken", "hospitalRefreshToken", "hospitalUser", "hospitalInfo", "hospitalBranch", "hospitalSessionId"]
      : ["accessToken", "refreshToken", "user"];
  keys.forEach((k) => sessionStorage.removeItem(k));
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
  const refreshToken = sessionStorage.getItem(r.refresh);
  if (!refreshToken) return null;
  try {
    // Use a bare axios call (not axiosInstance) so this request doesn't recurse
    // back through these interceptors.
    const resp = await axios.post(`${API_URL}${r.refreshUrl}`, { refreshToken });
    const tokens = resp.data?.data?.tokens;
    if (!tokens?.accessToken) return null;
    sessionStorage.setItem(r.access, tokens.accessToken);
    if (tokens.refreshToken) sessionStorage.setItem(r.refresh, tokens.refreshToken);
    return tokens.accessToken;
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
      // Only bounce to a realm's login if the user is actually viewing a page in
      // that realm. A background call from the OTHER realm (e.g. the globally-
      // mounted command palette probing /hospital/module-access while you're on
      // the super-admin portal) must not hijack navigation.
      if (realmForUrl(window.location.pathname) === realm) {
        redirectToLogin(realm);
      }
      return Promise.reject(error);
    }

    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
    return axiosInstance(original);
  }
);
