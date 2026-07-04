import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

assert.match(html, /id="participant-select"/, "UI should let researchers switch participants.");
assert.match(html, /id="add-participant"/, "UI should let researchers add another participant.");
assert.match(html, /id="delete-participant"/, "UI should let researchers delete the active participant.");
assert.match(script, /code: `P-\$\{String\(index\)\.padStart\(3, "0"\)\}`/, "Participant labels should start from P-001.");
assert.match(script, /participants:/, "State should store multiple participants.");
assert.match(script, /activeParticipantId/, "State should track the active participant.");
assert.match(script, /getActiveParticipant/, "Code should read data through the active participant.");
assert.match(script, /participantId === participant\.id/, "Generated records should be scoped to the active participant.");

assert.doesNotMatch(html + script, /此時此刻/, "The UI/mock output should not use the stiff phrase 此時此刻.");
assert.doesNotMatch(html + script, /我站在/, "Mock monologues should not force a spatial time-travel opening.");
assert.doesNotMatch(html + script, /現在/, "Research-facing time labels should use 當下 instead of 現在.");
assert.match(html + script, /當下/, "The present-time condition should be labeled 當下.");
assert.match(html + script, /真實/, "The experimental condition should be labeled 真實.");
assert.match(html + script, /反事實/, "The experimental condition should be labeled 反事實.");
assert.doesNotMatch(html + script, /請先完成目前條件/, "The UI should not show extra instructional hint text.");

assert.match(html + script, /自動寫入 Notion/, "The UI should clarify that API mode writes to Notion automatically.");
assert.doesNotMatch(html + script, /核可|退回|重生|審閱/, "The experiment UI should not imply subjective review/regeneration.");
