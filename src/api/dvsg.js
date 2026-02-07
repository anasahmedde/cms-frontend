import { httpFactory } from "./httpFactory";
import { API } from "./config";
import { enc } from "./paginate";
import { safeGet } from "./httpFactory";


const http = httpFactory({ baseURL: API.DVSG });

/**
 * Group linked videos
 * Your earlier request was like: /group/Pepsi%20Chiller%20Handle/videos
 */
export const listGroupVideosByName = (groupName) =>
  http.get(`/group/${enc(groupName)}/videos`);

export async function listGroupVideoNames(groupName) {
  const res = await listGroupVideosByName(groupName);
  // API returns {gid, gname, vids: [...], video_names: [...], count}
  const data = res?.data || res || {};
  const names = data.video_names || data.items?.map(v => v.video_name) || [];
  console.log("Group videos response:", data, "-> names:", names);
  return { data, video_names: names };
}

// Your component complained about setGroupVideosByNames missing:
export const setGroupVideosByNames = (groupName, videoNames = []) =>
  http.post(`/group/${enc(groupName)}/videos`, { video_names: videoNames });

export async function getDeviceTemperatureSeries(mobileId, days = 30, bucket = "day") {
  return safeGet(`/device/${encodeURIComponent(mobileId)}/temperature_series`, { days, bucket });
}
