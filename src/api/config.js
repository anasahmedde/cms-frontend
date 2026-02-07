const UNIFIED_API = process.env.REACT_APP_API_BASE_URL; // single gateway in staging/prod

// Update these if your ports differ
export const API = {
  GROUP: UNIFIED_API || process.env.REACT_APP_API_GROUP_BASEURL || "https://api-staging-cms.wizioners.com",
  SHOP: UNIFIED_API || process.env.REACT_APP_API_SHOP_BASEURL || "https://api-staging-cms.wizioners.com",
  VIDEO: UNIFIED_API || process.env.REACT_APP_API_VIDEO_BASEURL || "https://api-staging-cms.wizioners.com",
  LINK: UNIFIED_API || process.env.REACT_APP_API_LINK_BASEURL || "https://api-staging-cms.wizioners.com",
  DEVICE: UNIFIED_API || process.env.REACT_APP_API_DEVICE_BASEURL || "https://api-staging-cms.wizioners.com",
  DVSG: UNIFIED_API || process.env.REACT_APP_API_DVSG_BASEURL || "https://api-staging-cms.wizioners.com",
};

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 100);
