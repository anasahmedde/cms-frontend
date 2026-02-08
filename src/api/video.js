import axios from "axios";

// Video API - unified on port 8005
const BASE_URL = process.env.REACT_APP_API_BASE_URL || 
  `${window.location.protocol}//${window.location.hostname}:8005`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Auth interceptor for company users
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("digix_token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function normalizeList(payload) {
  const data = payload ?? {};
  const items = Array.isArray(data) ? data : data.items || data.data || data.results || [];
  const total = data.total ?? data.count ?? items.length;
  return { items, total };
}

export async function listVideos(limit = 100, offset = 0, q = "") {
  try {
    const params = { limit, offset };
    if (q) params.q = q;
    const res = await api.get("/videos", { params });
    const { items, total } = normalizeList(res.data);
    return { ok: true, items, total };
  } catch (err) {
    console.error("listVideos error:", err);
    return { ok: false, items: [], total: 0, error: err.message };
  }
}

// Returns array of video names (for GroupLinkedVideo component)
export async function listVideoNames(limit = 100, offset = 0) {
  try {
    const res = await listVideos(limit, offset);
    // Extract just the names as an array
    return (res.items || []).map(v => v.video_name || v.name || v).filter(Boolean);
  } catch (err) {
    console.error("listVideoNames error:", err);
    return [];
  }
}

// Upload video
export async function uploadVideo(formData, onProgress) {
  try {
    const res = await api.post("/upload_video", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("uploadVideo error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// DELETE video by video_name
export async function deleteVideo(videoName) {
  try {
    const encodedName = encodeURIComponent(videoName);
    const res = await api.delete(`/video/${encodedName}`);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("deleteVideo error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// INSERT video (if your API supports it)
export async function insertVideo(videoData) {
  try {
    const res = await api.post("/videos", videoData);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("insertVideo error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}

// UPDATE video by video_name
export async function updateVideo(videoName, videoData) {
  try {
    const encodedName = encodeURIComponent(videoName);
    const res = await api.put(`/video/${encodedName}`, videoData);
    return { ok: true, data: res.data };
  } catch (err) {
    console.error("updateVideo error:", err);
    return { ok: false, error: err.response?.data?.detail || err.message };
  }
}
