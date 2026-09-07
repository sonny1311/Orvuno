// ORVUNO – passwortloser Spielzugang über eine automatisch erzeugte Spiel-ID.
const GAME_ID_STORAGE_KEY='orvuno.gameId';
const GAME_ID_ENDPOINT='world-game-id-auth';
const GAME_ID_ALPHABET=/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g;

export function normalizeGameId(value=''){
  return String(value||'').toUpperCase().replace(GAME_ID_ALPHABET,'');
}

export function formatGameId(value=''){
  const compact=normalizeGameId(value);
  if(compact.length!==20)return String(value||'').trim().toUpperCase();
  return `ORV-${compact.slice(0,5)}-${compact.slice(5,10)}-${compact.slice(10,15)}-${compact.slice(15,20)}`;
}

export class GameIdAccessClient{
  constructor({api}={}){this.api=api;}
  getLocalGameId(){try{return formatGameId(localStorage.getItem(GAME_ID_STORAGE_KEY)||'');}catch{return '';}}
  saveLocalGameId(gameId){const formatted=formatGameId(gameId);if(normalizeGameId(formatted).length!==20)throw new Error('Spiel-ID ist ungültig');try{localStorage.setItem(GAME_ID_STORAGE_KEY,formatted);}catch{}return formatted;}
  clearLocalGameId(){try{localStorage.removeItem(GAME_ID_STORAGE_KEY);}catch{}}
  async request(action,data={},auth=false){
    const headers={apikey:this.api.publishableKey,'Content-Type':'application/json'};
    if(auth){const token=await this.api.ensureAccessToken();if(!token)throw new Error('Spielersitzung ist nicht verfügbar');headers.Authorization=`Bearer ${token}`;}
    const response=await fetch(`${this.api.baseUrl}/functions/v1/${GAME_ID_ENDPOINT}`,{method:'POST',headers,body:JSON.stringify({action,...data})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body?.success===false)throw new Error(body?.error||body?.message||`Spiel-ID-Fehler (${response.status})`);
    return body;
  }
  acceptSession(session){if(!session?.access_token||!session?.refresh_token)throw new Error('Spielersitzung ist unvollständig');this.api.saveSession(session);return session;}
  async createPlayer(){const result=await this.request('create');this.acceptSession(result.session);this.saveLocalGameId(result.gameId);return this.api.me();}
  async resumePlayer(gameId){const formatted=formatGameId(gameId);if(normalizeGameId(formatted).length!==20)throw new Error('Bitte eine vollständige Spiel-ID eingeben');const result=await this.request('resume',{gameId:formatted});this.acceptSession(result.session);this.saveLocalGameId(formatted);return this.api.me();}
  async resumeLocalPlayer(){const id=this.getLocalGameId();if(!id)return null;try{return await this.resumePlayer(id);}catch(error){console.warn('Lokale Spiel-ID konnte nicht automatisch geladen werden',error);return null;}}
  async ensureForCurrentPlayer(){
    const local=this.getLocalGameId();if(local)return {success:true,gameId:local,local:true};
    if(!this.api?.session?.access_token)return null;
    const result=await this.request('issue',{},true);
    if(result?.gameId)this.saveLocalGameId(result.gameId);
    return result;
  }
  async rotateGameId(){const result=await this.request('rotate',{},true);if(!result?.gameId)throw new Error('Neue Spiel-ID wurde nicht zurückgegeben');const gameId=this.saveLocalGameId(result.gameId);window.dispatchEvent(new CustomEvent('world:game-id-changed',{detail:{gameId}}));return {...result,gameId};}
}

export class GameIdAccessDialog{
  constructor({client,onAuthenticated,parent=document.body}={}){this.client=client;this.onAuthenticated=onAuthenticated;this.parent=parent;this.overlay=null;this.busy=false;}
  el(tag,text=null){const e=document.createElement(tag);if(text!==null)e.textContent=text;return e;}
  async finish(user){if(this.onAuthenticated)await this.onAuthenticated(user);this.close();}
  close(){this.overlay?.remove();this.overlay=null;}
  async run(button,task,status){if(this.busy)return;this.busy=true;button.disabled=true;button.style.opacity='.6';status.textContent='Spielstand wird geladen …';status.style.color='#d7dee9';try{const user=await task();await this.finish(user);}catch(error){status.textContent=error?.message||String(error);status.style.color='#ff8f8f';}finally{this.busy=false;button.disabled=false;button.style.opacity='';}}
  open(){
    if(this.overlay)return;
    const overlay=this.el('div');this.overlay=overlay;
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'30000',display:'flex',alignItems:'center',justifyContent:'center',padding:'22px',boxSizing:'border-box',background:'radial-gradient(circle at 50% 15%,#17263d 0,#07101d 48%,#03070c 100%)',fontFamily:'Arial,sans-serif',color:'#fff'});
    const panel=this.el('section');Object.assign(panel.style,{width:'min(560px,96vw)',padding:'30px',boxSizing:'border-box',border:'1px solid #394457',borderRadius:'20px',background:'#0c1422',boxShadow:'0 24px 80px rgba(0,0,0,.55)'});
    const logo=this.el('div','ORVUNO');Object.assign(logo.style,{fontSize:'34px',fontWeight:'900',letterSpacing:'3px',textAlign:'center'});
    const sub=this.el('div','Dein Spielstand wird automatisch gespeichert.');Object.assign(sub.style,{textAlign:'center',color:'#b8c2d2',margin:'8px 0 24px',fontSize:'16px'});
    const newButton=this.el('button','Neues Spiel starten');Object.assign(newButton.style,{width:'100%',padding:'14px 16px',border:'1px solid #4b78ff',borderRadius:'11px',background:'#3868ee',color:'#fff',fontSize:'17px',fontWeight:'800',cursor:'pointer'});
    const divider=this.el('div','oder vorhandenen Spielstand laden');Object.assign(divider.style,{textAlign:'center',color:'#8f9aad',margin:'20px 0 10px'});
    const input=this.el('input');input.placeholder='ORV-XXXXX-XXXXX-XXXXX-XXXXX';input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;Object.assign(input.style,{width:'100%',boxSizing:'border-box',padding:'14px 15px',border:'1px solid #465064',borderRadius:'10px',background:'#111827',color:'#fff',fontSize:'16px',textAlign:'center',letterSpacing:'1px',outline:'none'});
    const loadButton=this.el('button','Spiel-ID laden');Object.assign(loadButton.style,{width:'100%',marginTop:'10px',padding:'13px 16px',border:'1px solid #5b6578',borderRadius:'10px',background:'#151e2f',color:'#fff',fontSize:'16px',fontWeight:'800',cursor:'pointer'});
    const note=this.el('div','Die Spiel-ID ersetzt Anmeldung, E-Mail und Passwort. Bewahre sie sicher auf – damit kannst du auf Handy, Tablet oder im Browser denselben letzten Spielstand öffnen.');Object.assign(note.style,{marginTop:'18px',fontSize:'13px',lineHeight:'1.5',color:'#9faabc'});
    const status=this.el('div','');Object.assign(status.style,{minHeight:'20px',marginTop:'14px',textAlign:'center',fontWeight:'700'});
    newButton.onclick=()=>this.run(newButton,()=>this.client.createPlayer(),status);
    loadButton.onclick=()=>this.run(loadButton,()=>this.client.resumePlayer(input.value),status);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')loadButton.click();});
    panel.append(logo,sub,newButton,divider,input,loadButton,note,status);overlay.append(panel);this.parent.append(overlay);input.focus();
  }
}
