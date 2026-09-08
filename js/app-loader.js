// ORVUNO - fast pre-auth loader.
// Keep the expensive gameplay/module graph out of the critical startup path.
import { AuthApiClient } from './core/AuthApiClient.js';
import { GameAccessGate } from './core/GameAccessGate.js';

const params=new URLSearchParams(location.search);
const crazyGames=params.get('source')==='crazygames'||params.get('crazygames')==='1'||params.get('platform')==='crazygames';

async function loadFullRuntimeInBackground(){
  const task=()=>import('./bootstrap.js').catch(error=>{
    console.error('ORVUNO Hintergrundmodule konnten nicht geladen werden',error);
  });
  if('requestIdleCallback' in window)requestIdleCallback(task,{timeout:1200});
  else setTimeout(task,40);
}

async function start(){
  // CrazyGames must patch the access dialog before the gate opens.
  if(crazyGames)await import('./core/CrazyGamesBasicLaunchIntegration.js');

  // This gate only imports AuthApiClient/GameAccessGate instead of the entire game graph.
  const api=new AuthApiClient();
  const gate=new GameAccessGate({api});
  await gate.ensureAccess();
  window.orvunoAccessPrechecked=true;

  if(crazyGames){
    // Show the actual game/company setup immediately. The large integration graph is
    // hydrated just after first paint so the player does not stare at a loader.
    await import('./main.js');
    window.orvunoBootComplete=true;
    window.dispatchEvent(new CustomEvent('orvuno:boot-complete'));
    loadFullRuntimeInBackground();
    return;
  }

  await import('./bootstrap.js');
}

start().catch(error=>{
  console.error('ORVUNO VORSTART FEHLGESCHLAGEN',error);
  window.orvunoShowBootError?.(error?.message||String(error));
});
