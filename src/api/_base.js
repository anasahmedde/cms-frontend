const proto = window.location.protocol; // "http:" or "https:"
const host = window.location.hostname;  // "34.248.112.237" (or whatever you open)
const UNIFIED_API = process.env.REACT_APP_API_BASE_URL; // single gateway in staging/prod

export const BASE = {
  GROUP: UNIFIED_API || process.env.REACT_APP_GROUP_API || "https://api-staging-cms.wizioners.com",
  SHOP: UNIFIED_API || process.env.REACT_APP_SHOP_API || "https://api-staging-cms.wizioners.com",
  VIDEO: UNIFIED_API || process.env.REACT_APP_VIDEO_API || "https://api-staging-cms.wizioners.com",
  DEVICE: UNIFIED_API || process.env.REACT_APP_DEVICE_API || "https://api-staging-cms.wizioners.com",
  LINK: UNIFIED_API || process.env.REACT_APP_LINK_API || "https://api-staging-cms.wizioners.com",
  DVSG: UNIFIED_API || process.env.REACT_APP_DVSG_API || "https://api-staging-cms.wizioners.com",
};

// Backend limit is le=100 => always cap to 100 to avoid 422
export const capLimit = (limit) => {
  const n = Number(limit ?? 100);
  if (Number.isNaN(n) || n <= 0) return 100;
  return Math.min(n, 100);
};

