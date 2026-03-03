const proto = window.location.protocol; // "http:" or "https:"
const host = window.location.hostname;
const defaultBase = process.env.REACT_APP_API_BASE_URL || `${proto}//${host}:8005`;

export const BASE = {
  GROUP: process.env.REACT_APP_GROUP_API || defaultBase,
  SHOP: process.env.REACT_APP_SHOP_API || defaultBase,
  VIDEO: process.env.REACT_APP_VIDEO_API || defaultBase,
  DEVICE: process.env.REACT_APP_DEVICE_API || defaultBase,
  LINK: process.env.REACT_APP_LINK_API || defaultBase,
  DVSG: process.env.REACT_APP_DVSG_API || defaultBase,
};

// Backend limit is le=100 => always cap to 100 to avoid 422
export const capLimit = (limit) => {
  const n = Number(limit ?? 100);
  if (Number.isNaN(n) || n <= 0) return 100;
  return Math.min(n, 100);
};

