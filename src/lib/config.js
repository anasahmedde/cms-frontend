// Single source of truth for backend URLs. Nothing else in src/ may read
// process.env.REACT_APP_* URL vars or hardcode a port.

const stripSlash = (u) => (u ? u.replace(/\/+$/, "") : u);

export const API_BASE_URL = stripSlash(
  process.env.REACT_APP_API_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8005`
);

export const WS_BASE_URL = stripSlash(
  process.env.REACT_APP_WS_BASE_URL ||
    API_BASE_URL.replace(/^http/, "ws")
);

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 20);
