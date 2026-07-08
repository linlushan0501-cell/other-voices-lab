import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const apiPath = new URL("../api/generate.js", import.meta.url);

assert.equal(existsSync(apiPath), true, "Vercel should expose an /api/generate function.");

const api = readFileSync(apiPath, "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

assert.match(api, /process\.env\.OPENAI_API_KEY/, "The API function should read the OpenAI key on the server.");
assert.match(api, /process\.env\.NOTION_API_KEY/, "The API function should read the Notion key on the server.");
assert.match(api, /process\.env\.NOTION_PARENT_PAGE_ID/, "The API function should write under the configured Notion parent page.");
assert.match(api, /https:\/\/api\.openai\.com\/v1\/responses/, "The API function should call OpenAI Responses API.");
assert.match(api, /https:\/\/api\.notion\.com\/v1\/pages/, "The API function should create a Notion page record.");
assert.match(api, /generated_image_url/, "The Notion record payload should include generated_image_url even when blank.");

assert.match(script, /fetch\("\/api\/generate"/, "The browser should call the Vercel function instead of only using mock data.");
assert.match(script, /participant_id/, "The browser should send participant_id to the API.");
assert.match(script, /time_point_type/, "The browser should send time_point_type to the API.");
assert.match(script, /prompt_version/, "The browser should send prompt_version to the API.");
