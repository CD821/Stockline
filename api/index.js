import { handleRequest } from "../serve.mjs";

function restoreOriginalPath(request) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const routedPath = url.searchParams.get("__stockline_path");
  if (routedPath === null) return;

  url.searchParams.delete("__stockline_path");
  const path = routedPath ? `/${routedPath.replace(/^\/+/, "")}` : "/";
  const search = url.searchParams.toString();
  request.url = `${path}${search ? `?${search}` : ""}`;
}

export default async function handler(request, response) {
  restoreOriginalPath(request);
  await handleRequest(request, response);
}
