import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const apiPath = new URL("../api/generate.js", import.meta.url);

assert.equal(existsSync(apiPath), true, "Vercel should expose an /api/generate function.");

const api = readFileSync(apiPath, "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

assert.match(api, /process\.env\.OPENAI_API_KEY/, "The API function should read the OpenAI key on the server.");
assert.match(api, /process\.env\.NOTION_API_KEY/, "The API function should read the Notion key on the server.");
assert.match(api, /process\.env\.NOTION_PARENT_PAGE_ID/, "The API function should write under the configured Notion parent page.");
assert.match(api, /process\.env\.NOTION_DATA_SOURCE_ID/, "The API function should support writing rows to a Notion data source table.");
assert.match(api, /https:\/\/api\.openai\.com\/v1\/responses/, "The API function should call OpenAI Responses API.");
assert.match(api, /https:\/\/api\.notion\.com\/v1\/pages/, "The API function should create a Notion page record.");
assert.match(api, /generated_image_url/, "The Notion record payload should include generated_image_url even when blank.");
assert.match(api, /database_id/, "The Notion table path should accept the database ID copied from the Notion table URL.");
assert.match(api, /participant_id.*title/s, "The Notion table row should use participant_id as the title column.");
assert.match(api, /condition.*rich_text/s, "The Notion table row should write condition as text.");
assert.match(api, /time_point_type.*select/s, "The Notion table row should write the condition label into the configured time_point_type select.");
assert.match(api, /time_point_label.*select/s, "The Notion table row should write the time label into the configured time_point_label select.");
assert.match(api, /image URL.*url/s, "The Notion table row should use the configured image URL column.");
assert.match(api, /time.*date/s, "The Notion table row should write time as a date column.");
assert.match(api, /反事實不是角色本身的反事實/, "The prompt should clarify that counterfactual applies to the event scenario, not the character.");
assert.match(api, /不要直接說出時間點標籤/, "The prompt should prevent literal time-label exposition.");
assert.match(api, /不要用「如果.*」作為開頭/, "The prompt should avoid starting by reciting counterfactual settings.");
assert.match(api, /past.*present.*future/s, "The prompt should vary perspective rules by time point.");

assert.match(script, /fetch\("\/api\/generate"/, "The browser should call the Vercel function instead of only using mock data.");
assert.match(script, /participant_id/, "The browser should send participant_id to the API.");
assert.match(script, /time_point_type/, "The browser should send time_point_type to the API.");
assert.match(script, /prompt_version/, "The browser should send prompt_version to the API.");
assert.match(script, /real_event_description/, "The browser should send the real event description for contrast.");
assert.match(script, /counterfactual_event_description/, "The browser should send the counterfactual event description for contrast.");
