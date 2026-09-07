import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
const ui=await read('js/core/GameIdAccess.js');
const gate=await read('js/core/GameAccessGate.js');
const edge=await read('supabase/functions/world-game-id-auth/index.ts');
const privacy=await read('datenschutz.html');

assert.doesNotMatch(ui,/Spiel-ID laden|ORV-XXXXX-XXXXX-XXXXX-XXXXX|oder vorhandenen Spielstand laden/,'Game-ID recovery is still visible in the player entry UI');
assert.match(ui,/Spiel starten/,'Direct player start is missing');
assert.match(gate,/openPlayerAccess\(\)/,'Direct player access gate is missing');
assert.doesNotMatch(gate,/ensureForCurrentPlayer\(\)/,'The access gate still issues a game ID for current players');

const createStart=edge.indexOf('if(action==="create")');
const resumeStart=edge.indexOf('if(action==="resume")');
assert.ok(createStart>=0&&resumeStart>createStart,'Could not isolate player creation path');
const createBlock=edge.slice(createStart,resumeStart);
assert.doesNotMatch(createBlock,/makeCredential\(|gameId/,'New player creation still generates a game ID credential');
assert.match(createBlock,/registration_channel:"device_session"/,'New player creation is not marked as device-session access');

assert.match(privacy,/Benutzername und lokale Spielsitzung/,'Privacy notice does not describe the current access model');
assert.doesNotMatch(privacy,/Benutzername und Spiel-ID statt Registrierung/,'Old game-ID access wording remains in the privacy notice');

console.log('Player access without visible game ID regression checks passed.');