// API layer for screen templates — all calls go through THE shared client
// (lib/api); the old httpFactory instance is gone.
import {
  apiGet as safeGet,
  apiPost as safePost,
  apiPut as safePut,
  apiDelete as safeDelete,
  uploadWithProgress,
} from "../../lib/api";

export const listTemplates = () => safeGet("/platform/templates");
export const getTemplate = (id) => safeGet(`/platform/templates/${id}`);
export const createTemplate = (body) => safePost("/platform/templates", body);
export const updateTemplate = (id, body) => safePut(`/platform/templates/${id}`, body);
export const deleteTemplate = (id) => safeDelete(`/platform/templates/${id}`);
export const publishTemplate = (id) => safePost(`/platform/templates/${id}/publish`);
export const duplicateTemplate = (id) => safePost(`/platform/templates/${id}/duplicate`);
export const getTemplateVersions = (id) => safeGet(`/platform/templates/${id}/versions`);
export const rollbackTemplate = (id, version) =>
  safePost(`/platform/templates/${id}/rollback/${version}`);

export const listCompanies = () => safeGet("/platform/companies");
export const linkCompanyTemplate = (companyId, templateId) =>
  safePut(`/platform/companies/${companyId}/template`, { template_id: templateId });

// Company-dashboard side (shop content + device overrides)
export const getCompanyTemplate = () => safeGet("/company/template");
export const getShopContent = (shopId) => safeGet(`/shop/${shopId}/template-content`);
export const putShopContent = (shopId, zoneKey, payload) =>
  safePut(`/shop/${shopId}/template-content/${zoneKey}`, { payload });
export const uploadShopMedia = (shopId, zoneKey, file, onProgress) => {
  const fd = new FormData();
  fd.append("file", file);
  return uploadWithProgress(`/shop/${shopId}/template-content/${zoneKey}/media`, fd, onProgress);
};
export const getDeviceContent = (deviceId) => safeGet(`/device-config/${deviceId}/template-content`);
export const putDeviceContent = (deviceId, zoneKey, payload) =>
  safePut(`/device-config/${deviceId}/template-content/${zoneKey}`, { payload });
export const deleteDeviceContent = (deviceId, zoneKey) =>
  safeDelete(`/device-config/${deviceId}/template-content/${zoneKey}`);
export const uploadDeviceMedia = (deviceId, zoneKey, file, onProgress) => {
  const fd = new FormData();
  fd.append("file", file);
  return uploadWithProgress(`/device-config/${deviceId}/template-content/${zoneKey}/media`, fd, onProgress);
};

// Company-wide default content (lowest-precedence layer; endpoints landed with
// the fleet-telemetry backend PR).
export const getCompanyContent = () => safeGet("/company/template-content");
export const putCompanyContent = (zoneKey, payload) =>
  safePut(`/company/template-content/${zoneKey}`, { payload });
export const uploadCompanyMedia = (zoneKey, file, onProgress) => {
  const fd = new FormData();
  fd.append("file", file);
  return uploadWithProgress(`/company/template-content/${zoneKey}/media`, fd, onProgress);
};
