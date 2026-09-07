// ORVUNO – lightweight pre-auth loader.
// The large game/module graph is fetched only after the account gate has succeeded.
import { gameAccessGate } from './core/AccountMultiplayerIntegration.js';

async function start(){
  await gameAccessGate.ensureAccess();
  window.orvunoAccessPrechecked=true;
  await import('./bootstrap.js');
}

start().catch(error=>{
  console.error('❌ ORVUNO VORSTART FEHLGESCHLAGEN',error);
  window.orvunoShowBootError?.(error?.message||String(error));
});
