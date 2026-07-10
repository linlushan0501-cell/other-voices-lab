import { timingSafeEqual } from "node:crypto";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function isValidAccessCode(value) {
  const expected = process.env.APP_ACCESS_CODE;
  const provided = String(value || "");

  if (!expected || !provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (!process.env.APP_ACCESS_CODE) {
    sendJson(response, 503, { error: "Missing APP_ACCESS_CODE." });
    return;
  }

  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};

  if (!isValidAccessCode(body.access_code)) {
    sendJson(response, 401, { error: "存取碼不正確。" });
    return;
  }

  sendJson(response, 200, { ok: true });
}
