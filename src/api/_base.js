const proto = window.location.protocol; // "http:" or "https:"
const host = window.location.hostname;  // "34.248.112.237" (or whatever you open)
const UNIFIED_API = process.env.REACT_APP_API_BASE_URL; // single gateway in staging/prod

export const BASE = {
  GROUP: UNIFIED_API || process.env.REACT_APP_GROUP_API || `${proto}//${host}:8001`,
  SHOP: UNIFIED_API || process.env.REACT_APP_SHOP_API || `${proto}//${host}:8002`,
  VIDEO: UNIFIED_API || process.env.REACT_APP_VIDEO_API || `${proto}//${host}:8003`,
  DEVICE: UNIFIED_API || process.env.REACT_APP_DEVICE_API || `${proto}//${host}:8005`,
  LINK: UNIFIED_API || process.env.REACT_APP_LINK_API || `${proto}//${host}:8005`,
  DVSG: UNIFIED_API || process.env.REACT_APP_DVSG_API || `${proto}//${host}:8005`,
};

// Backend limit is le=100 => always cap to 100 to avoid 422
export const capLimit = (limit) => {
  const n = Number(limit ?? 100);
  if (Number.isNaN(n) || n <= 0) return 100;
  return Math.min(n, 100);
};

