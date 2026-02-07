const HOST = process.env.REACT_APP_API_HOST || window.location.hostname;
const UNIFIED_API = process.env.REACT_APP_API_BASE_URL; // single gateway in staging/prod

// Update these if your ports differ
export const API = {
  GROUP: UNIFIED_API || process.env.REACT_APP_API_GROUP_BASEURL || `http://${HOST}:8001`,
  SHOP: UNIFIED_API || process.env.REACT_APP_API_SHOP_BASEURL || `http://${HOST}:8002`,
  VIDEO: UNIFIED_API || process.env.REACT_APP_API_VIDEO_BASEURL || `http://${HOST}:8003`,
  LINK: UNIFIED_API || process.env.REACT_APP_API_LINK_BASEURL || `http://${HOST}:8005`,
  DEVICE: UNIFIED_API || process.env.REACT_APP_API_DEVICE_BASEURL || `http://${HOST}:8005`,
  DVSG: UNIFIED_API || process.env.REACT_APP_API_DVSG_BASEURL || `http://${HOST}:8005`,
};

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 100);

