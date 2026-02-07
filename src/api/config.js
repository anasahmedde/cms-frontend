const HOST = process.env.REACT_APP_API_HOST || window.location.hostname;

// Update these if your ports differ
export const API = {
  GROUP: process.env.REACT_APP_API_GROUP_BASEURL || `http://${HOST}:8001`,
  SHOP: process.env.REACT_APP_API_SHOP_BASEURL || `http://${HOST}:8002`,
  VIDEO: process.env.REACT_APP_API_VIDEO_BASEURL || `http://${HOST}:8003`,
  LINK: process.env.REACT_APP_API_LINK_BASEURL || `http://${HOST}:8005`,
  DEVICE: process.env.REACT_APP_API_DEVICE_BASEURL || `http://${HOST}:8005`,
  DVSG: process.env.REACT_APP_API_DVSG_BASEURL || `http://${HOST}:8005`,
};

export const PAGE_SIZE = Number(process.env.REACT_APP_API_PAGE_SIZE || 100);

