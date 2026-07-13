// API layer for screen templates — all calls go through the shared authed
// axios instance (httpFactory), per the repo ruleset.
import {
  safeGet,
  safePost,
  safePut,
  safeDelete,
  uploadWithProgress,
} from "../../api/httpFactory";

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
