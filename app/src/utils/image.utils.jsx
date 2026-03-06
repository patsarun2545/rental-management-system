import config from "../../config";

export const getImageUrl = (path) => {
  if (!path) return "";
  return `${config.apiServer}${path}`;
};
