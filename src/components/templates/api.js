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

// Company-scoped designer: a company admin edits their OWN copy of the template.
// The backend forks a private copy on first write and re-links the company on
// publish. The (id) arg is ignored — the server derives the target from the
// caller's tenant — but it's accepted so these are drop-in for the designer's
// saveApi/publishApi(id, body) contract.
export const getCompanyTemplateDesign = () => safeGet("/company/template/design");
export const updateCompanyTemplateDesign = (_id, body) => safePut("/company/template/design", body);
export const publishCompanyTemplateDesign = (_id) => safePost("/company/template/design/publish");
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

// Group-scoped content — applies to every device in the group regardless of
// location. Resolves screen > group > location > company.
export const getGroupContent = (groupId) => safeGet(`/group/${groupId}/template-content`);
export const putGroupContent = (groupId, zoneKey, payload) =>
  safePut(`/group/${groupId}/template-content/${zoneKey}`, { payload });
export const deleteGroupContent = (groupId, zoneKey) =>
  safeDelete(`/group/${groupId}/template-content/${zoneKey}`);
export const uploadGroupMedia = (groupId, zoneKey, file, onProgress) => {
  const fd = new FormData();
  fd.append("file", file);
  return uploadWithProgress(`/group/${groupId}/template-content/${zoneKey}/media`, fd, onProgress);
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

// Which zones are pinned at a more-specific scope (location/screen) and shadow
// the company default — so a company edit looks like it "didn't update".
export const getContentOverrides = () => safeGet("/company/template-content/overrides");
export const clearZoneOverrides = (zoneKey) =>
  safeDelete(`/company/template-content/${zoneKey}/overrides`);

// Resolved + presigned zones for the WYSIWYG preview (how a screen actually renders).
export const getTemplatePreview = ({ scope = "company", shopId, deviceId, groupId } = {}) => {
  const q = new URLSearchParams({ scope });
  if (shopId != null) q.set("shop_id", shopId);
  if (deviceId != null) q.set("device_id", deviceId);
  if (groupId != null) q.set("group_id", groupId);
  return safeGet(`/company/template/preview?${q.toString()}`);
};

// ── Multi-template: several templates per company (mixed resolutions) ──
// Assignment precedence mirrors content: screen > group > company default.
export const getCompanyTemplates = () => safeGet("/company/templates");
export const getGroupTemplate = (groupId) => safeGet(`/group/${groupId}/template`);
export const setGroupTemplate = (groupId, templateId) =>
  safePut(`/group/${groupId}/template`, { template_id: templateId });
export const getDeviceTemplate = (deviceId) => safeGet(`/device-config/${deviceId}/template`);
export const setDeviceTemplate = (deviceId, templateId) =>
  safePut(`/device-config/${deviceId}/template`, { template_id: templateId });
