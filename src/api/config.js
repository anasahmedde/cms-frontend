const HOST = process.env.REACT_APP_API_HOST || window.location.hostname;
const UNIFIED_API = process.env.REACT_APP_API_BASE_URL; // single gateway in staging/prod

// Update these if your ports differ
export const API = {
  GROUP: UNIFIED_API || process.env.REACT_APP_API_GROUP_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
  SHOP: UNIFIED_API || process.env.REACT_APP_API_SHOP_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
  VIDEO: UNIFIED_API || process.env.REACT_APP_API_VIDEO_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
  LINK: UNIFIED_API || process.env.REACT_APP_API_LINK_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
  DEVICE: UNIFIED_API || process.env.REACT_APP_API_DEVICE_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
  DVSG: UNIFIED_API || process.env.REACT_APP_API_DVSG_BASEURL || `${window.location.protocol}//${window.location.hostname}:8005`,
};

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 100);

