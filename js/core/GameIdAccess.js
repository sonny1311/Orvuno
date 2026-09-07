// ORVUNO – passwortloser Spielzugang ohne sichtbare Kontokennung.
// Ältere lokale Spiel-IDs bleiben ausschließlich als unsichtbarer Migrations-Fallback erhalten.
const GAME_ID_STORAGE_KEY='orvuno.gameId';
const GAME_ID_ENDPOINT='world-game-id-auth';
const GAME_ID_ALPHABET=/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g;
const USERNAME_MIN=3;
const USERNAME_MAX=24;

export function normalizeGameId(value=''){
  const raw=String(value||'').trim().toUpperCase().replace(/^ORV[\s-]*/,'');
  return raw.replace(GAME_ID_ALPHABET,'');
}

export function formatGameId(value=''){
  const compact=normalizeGameId(value);
  if(compact.length!==20)return String(value||'').trim().toUpperCase();
  return `ORV-${compact.slice(0,5)}-${compact.slice(5,10)}-${compact.slice(10,15)}-${compact.slice(15,20)}`;
}

export function normalizePlayerName(value=''){
  return String(value||'').trim().replace(/\s+/g,' ');
}

export function validatePlayerName(value=''){
  const username=normalizePlayerName(value);
  if(username.length<USERNAME_MIN)return {success:false,username,error:`Der Benutzername muss mindestens ${USERNAME_MIN} Zeichen lang sein`};
  if(username.length>USERNAME_MAX)return {success:false,username,error:`Der Benutzername darf höchstens ${USERNAME_MAX} Zeichen lang sein`};
  if(!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(username))return {success:false,username,error:'Erlaubt sind Buchstaben, Zahlen, Leerzeichen, Punkt, Bindestrich und Unterstrich'};
  return {success:true,username,error:''};
}

export class GameIdAccessClient{
  constructor({api}={}){this.api=api;}
  getLocalGameId(){try{return formatGameId(localStorage.getItem(GAME_ID_STORAGE_KEY)||'');}catch{return '';}}
  saveLocalGameId(gameId){const formatted=formatGameId(gameId);if(normalizeGameId(formatted).length!==20)throw new Error('Ungültige Wiederherstellungskennung');try{localStorage.setItem(GAME_ID_STORAGE_KEY,formatted);}catch{}return formatted;}
  clearLocalGameId(){try{localStorage.removeItem(GAME_ID_STORAGE_KEY);}catch{}}
  async request(action,data={},auth=false){
    const headers={apikey:this.api.publishableKey,'Content-Type':'application/json'};
    if(auth){const token=await this.api.ensureAccessToken();if(!token)throw new Error('Spielersitzung ist nicht verfügbar');headers.Authorization=`Bearer ${token}`;}
    const response=await fetch(`${this.api.baseUrl}/functions/v1/${GAME_ID_ENDPOINT}`,{method:'POST',headers,body:JSON.stringify({action,...data})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body?.success===false)throw new Error(body?.error||body?.message||`Zugangsfehler (${response.status})`);
    return body;
  }
  acceptSession(session){if(!session?.access_token||!session?.refresh_token)throw new Error('Spielersitzung ist unvollständig');this.api.saveSession(session);return session;}
  async createPlayer({username,privacyAccepted=false}={}){
    const checked=privacyAccepted===true;
    const name=validatePlayerName(username);
    if(!name.success)throw new Error(name.error);
    if(!checked)throw new Error('Bitte bestätige zuerst die Datenschutzerklärung');
    const result=await this.request('create',{username:name.username,privacyAccepted:true,privacyVersion:'1.0'});
    this.acceptSession(result.session);
    // Kompatibel mit einem kurzzeitig noch älteren Backend, ohne die Kennung im UI offenzulegen.
    if(result?.gameId)try{this.saveLocalGameId(result.gameId);}catch{}
    return this.api.me();
  }
  // Nur für bereits vorhandene lokale Alt-Spielstände. Es gibt keinen sichtbaren Eingabeweg mehr.
  async resumePlayer(gameId){const formatted=formatGameId(gameId);if(normalizeGameId(formatted).length!==20)throw new Error('Ungültige Wiederherstellungskennung');const result=await this.request('resume',{gameId:formatted});this.acceptSession(result.session);this.saveLocalGameId(formatted);return this.api.me();}
  async resumeLocalPlayer(){const id=this.getLocalGameId();if(!id)return null;try{return await this.resumePlayer(id);}catch(error){console.warn('Alter lokaler Spielzugang konnte nicht automatisch geladen werden',error);return null;}}
}

export class GameIdAccessDialog{
  constructor({client,onAuthenticated,parent=document.body}={}){this.client=client;this.onAuthenticated=onAuthenticated;this.parent=parent;this.overlay=null;this.privacyOverlay=null;this.busy=false;}
  el(tag,text=null){const e=document.createElement(tag);if(text!==null)e.textContent=text;return e;}
  async finish(user){if(this.onAuthenticated)await this.onAuthenticated(user);this.close();}
  closePrivacy(){this.privacyOverlay?.remove();this.privacyOverlay=null;}
  close(){this.closePrivacy();this.overlay?.remove();this.overlay=null;}
  async run(button,task,status,busyText='Spiel wird geladen …'){if(this.busy)return;this.busy=true;button.disabled=true;button.style.opacity='.6';status.textContent=busyText;status.style.color='#d7dee9';try{const user=await task();await this.finish(user);}catch(error){status.textContent=error?.message||String(error);status.style.color='#ff8f8f';}finally{this.busy=false;button.disabled=false;button.style.opacity='';}}
  openPrivacy(){
    if(!this.overlay||this.privacyOverlay)return;
    const layer=this.el('div');this.privacyOverlay=layer;layer.dataset.orvunoPrivacyReader='1';
    Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:'30020',display:'flex',alignItems:'center',justifyContent:'center',padding:'max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))',boxSizing:'border-box',background:'rgba(2,7,15,.92)'});
    const card=this.el('section');Object.assign(card.style,{width:'min(900px,98vw)',height:'min(900px,94dvh)',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid #46536a',borderRadius:'16px',background:'#0c1422',boxShadow:'0 24px 80px rgba(0,0,0,.65)'});
    const head=this.el('div');Object.assign(head.style,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'14px 16px',borderBottom:'1px solid #334057'});
    const title=this.el('strong','Datenschutzerklärung');Object.assign(title.style,{fontSize:'18px'});
    const close=this.el('button','Schließen');close.type='button';Object.assign(close.style,{padding:'9px 12px',border:'1px solid #5b6578',borderRadius:'9px',background:'#172235',color:'#fff',fontWeight:'800',cursor:'pointer'});close.onclick=()=>this.closePrivacy();
    const frame=this.el('iframe');frame.src='/datenschutz.html';frame.title='Datenschutzerklärung ORVUNO';Object.assign(frame.style,{flex:'1 1 auto',width:'100%',border:'0',background:'#07101d'});
    head.append(title,close);card.append(head,frame);layer.append(card);layer.addEventListener('mousedown',e=>{if(e.target===layer)this.closePrivacy();});this.overlay.append(layer);
  }
  open(){
    if(this.overlay)return;
    const overlay=this.el('div');this.overlay=overlay;
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'30000',display:'flex',alignItems:'center',justifyContent:'center',padding:'22px',boxSizing:'border-box',overflow:'auto',background:'radial-gradient(circle at 50% 15%,#17263d 0,#07101d 48%,#03070c 100%)',fontFamily:'Arial,sans-serif',color:'#fff'});
    const panel=this.el('section');Object.assign(panel.style,{width:'min(560px,96vw)',padding:'30px',boxSizing:'border-box',border:'1px solid #394457',borderRadius:'20px',background:'#0c1422',boxShadow:'0 24px 80px rgba(0,0,0,.55)'});
    const logo=this.el('div','ORVUNO');Object.assign(logo.style,{fontSize:'34px',fontWeight:'900',letterSpacing:'3px',textAlign:'center'});
    const sub=this.el('div','Benutzername wählen – danach geht es direkt ins Spiel.');Object.assign(sub.style,{textAlign:'center',color:'#b8c2d2',margin:'8px 0 22px',fontSize:'16px'});

    const nameLabel=this.el('label','Benutzername');nameLabel.htmlFor='orvuno-player-name';Object.assign(nameLabel.style,{display:'block',marginBottom:'7px',fontWeight:'800',color:'#e8edf5'});
    const nameInput=this.el('input');nameInput.id='orvuno-player-name';nameInput.dataset.orvunoPlayerName='1';nameInput.placeholder='z. B. Jörg';nameInput.autocomplete='nickname';nameInput.maxLength=USERNAME_MAX;Object.assign(nameInput.style,{width:'100%',boxSizing:'border-box',padding:'14px 15px',border:'1px solid #465064',borderRadius:'10px',background:'#111827',color:'#fff',fontSize:'16px',outline:'none'});
    const nameHint=this.el('div',`${USERNAME_MIN}–${USERNAME_MAX} Zeichen. Buchstaben, Zahlen, Leerzeichen, Punkt, Bindestrich und Unterstrich.`);Object.assign(nameHint.style,{margin:'6px 0 13px',fontSize:'12px',lineHeight:'1.4',color:'#8f9aad'});

    const privacyRow=this.el('label');privacyRow.dataset.orvunoPrivacyConsent='1';Object.assign(privacyRow.style,{display:'flex',alignItems:'flex-start',gap:'10px',padding:'12px',border:'1px solid #39475d',borderRadius:'10px',background:'#0f1929',fontSize:'14px',lineHeight:'1.45',cursor:'pointer'});
    const privacyBox=this.el('input');privacyBox.type='checkbox';privacyBox.required=true;privacyBox.dataset.orvunoPrivacyConsentBox='1';Object.assign(privacyBox.style,{marginTop:'3px',width:'18px',height:'18px',flex:'0 0 auto'});
    const privacyText=this.el('span');privacyText.append(document.createTextNode('Ich habe die '));const privacyLink=this.el('button','Datenschutzerklärung');privacyLink.type='button';privacyLink.dataset.orvunoPrivacyLink='1';Object.assign(privacyLink.style,{padding:'0',border:'0',background:'transparent',color:'#8db5ff',font:'inherit',fontWeight:'800',textDecoration:'underline',cursor:'pointer'});privacyLink.onclick=e=>{e.preventDefault();e.stopPropagation();this.openPrivacy();};privacyText.append(privacyLink,document.createTextNode(' zur Kenntnis genommen.'));
    privacyRow.append(privacyBox,privacyText);

    const newButton=this.el('button','Spiel starten');newButton.type='button';newButton.dataset.orvunoCreatePlayer='1';Object.assign(newButton.style,{width:'100%',marginTop:'13px',padding:'14px 16px',border:'1px solid #4b78ff',borderRadius:'11px',background:'#3868ee',color:'#fff',fontSize:'17px',fontWeight:'800',cursor:'pointer'});
    const newStatus=this.el('div','');Object.assign(newStatus.style,{minHeight:'20px',marginTop:'8px',textAlign:'center',fontWeight:'700'});
    const updateNewButton=()=>{const valid=validatePlayerName(nameInput.value).success&&privacyBox.checked&&!this.busy;newButton.disabled=!valid;newButton.style.opacity=valid?'1':'.45';newButton.style.cursor=valid?'pointer':'not-allowed';};
    nameInput.addEventListener('input',updateNewButton);privacyBox.addEventListener('change',updateNewButton);updateNewButton();
    newButton.onclick=()=>this.run(newButton,()=>this.client.createPlayer({username:nameInput.value,privacyAccepted:privacyBox.checked}),newStatus,'Spieler wird angelegt …');
    nameInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!newButton.disabled)newButton.click();});

    panel.append(logo,sub,nameLabel,nameInput,nameHint,privacyRow,newButton,newStatus);overlay.append(panel);this.parent.append(overlay);nameInput.focus();
  }
}
