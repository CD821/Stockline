import { handleRequest } from "../serve.mjs";

export default async function handler(request, response) {
  await handleRequest(request, response);
}
