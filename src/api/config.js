const HOST = process.env.REACT_APP_API_HOST || window.location.hostname;
const defaultBase = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${HOST}:8005`;

// Update these if your ports differ
export const API = {
  GROUP: process.env.REACT_APP_API_GROUP_BASEURL || defaultBase,
  SHOP: process.env.REACT_APP_API_SHOP_BASEURL || defaultBase,
  VIDEO: process.env.REACT_APP_API_VIDEO_BASEURL || defaultBase,
  LINK: process.env.REACT_APP_API_LINK_BASEURL || defaultBase,
  DEVICE: process.env.REACT_APP_API_DEVICE_BASEURL || defaultBase,
  DVSG: process.env.REACT_APP_API_DVSG_BASEURL || defaultBase,
};

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 100);

