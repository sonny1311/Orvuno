// ORVUNO – lightweight pre-auth loader.
// The large game/module graph is fetched only after the account gate has succeeded.
import { gameAccessGate } from './core/AccountMultiplayerIntegration.js';
import { AuthApiClient } from './core/AuthApiClient.js';

function passwordRecoveryDialog(api){
  return new Promise((resolve,reject)=>{
    const overlay=document.createElement('div');
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.style.cssText='position:fixed;inset:0;z-index:999998;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 15%,#17263d,#03070c 72%);font-family:Arial,sans-serif;color:#fff';
    const card=document.createElement('section');
    card.style.cssText='width:min(520px,94vw);padding:26px;border:1px solid #40516a;border-radius:18px;background:#0f172a;box-shadow:0 24px 80px rgba(0,0,0,.55)';
    const title=document.createElement('h1');title.textContent='🔐 Neues Passwort setzen';title.style.cssText='margin:0 0 8px;font-size:28px';
    const text=document.createElement('p');text.textContent='Dein Passwort-Reset wurde bestätigt. Lege jetzt ein neues Passwort fest, bevor ORVUNO gestartet wird.';text.style.cssText='margin:0 0 18px;color:#cbd5e1;line-height:1.5';
    const p1=document.createElement('input'),p2=document.createElement('input');
    for(const input of [p1,p2]){input.type='password';input.autocomplete='new-password';input.style.cssText='width:100%;box-sizing:border-box;margin:7px 0;padding:13px 14px;border:1px solid #475569;border-radius:9px;background:#111827;color:#fff;font-size:16px';}
    p1.placeholder='Neues Passwort (mind. 10 Zeichen)';p2.placeholder='Neues Passwort wiederholen';
    const error=document.createElement('div');error.style.cssText='min-height:20px;margin:8px 0;color:#fda4af;font-size:14px';
    const submit=document.createElement('button');submit.type='button';submit.textContent='Passwort speichern';submit.style.cssText='width:100%;margin-top:8px;padding:13px 16px;border:0;border-radius:9px;background:#3868ee;color:#fff;font-weight:800;cursor:pointer';
    const finish=async()=>{
      if(submit.disabled)return;
      error.textContent='';
      if(p1.value.length<10){error.textContent='Das Passwort muss mindestens 10 Zeichen haben.';return;}
      if(p1.value!==p2.value){error.textContent='Die beiden Passwörter stimmen nicht überein.';return;}
      submit.disabled=true;submit.textContent='Wird gespeichert …';
      try{
        await api.resetPassword(null,p1.value);
        await api.logout();
        overlay.remove();
        resolve(true);
      }catch(e){error.textContent=e?.message||'Passwort konnte nicht gespeichert werden.';submit.disabled=false;submit.textContent='Passwort speichern';}
    };
    submit.addEventListener('click',finish);
    for(const input of [p1,p2])input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();finish();}});
    card.append(title,text,p1,p2,error,submit);overlay.append(card);document.body.append(overlay);p1.focus();
  });
}

async function handlePasswordRecovery(){
  const api=new AuthApiClient();
  const query=new URLSearchParams(location.search);
  const mightBeRecovery=api.isPasswordRecovery?.()||query.has('code');
  if(!mightBeRecovery)return false;
  await api.preparePasswordRecovery?.();
  if(!api.isPasswordRecovery?.())return false;
  await passwordRecoveryDialog(api);
  history.replaceState(null,document.title,location.pathname);
  location.reload();
  return true;
}

async function start(){
  if(await handlePasswordRecovery())return;
  await gameAccessGate.ensureAccess();
  window.orvunoAccessPrechecked=true;
  await import('./bootstrap.js');
}

start().catch(error=>{
  console.error('❌ ORVUNO VORSTART FEHLGESCHLAGEN',error);
  window.orvunoShowBootError?.(error?.message||String(error));
});
