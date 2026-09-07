// ORVUNO - Spielerprofil, Spiel-ID, Coin-Wallet und Betriebe
export class AccountProfileDialog {
    constructor({api,parent=document.body}={}){this.api=api;this.parent=parent;this.overlay=null;}
    el(tag,text=null){const e=document.createElement(tag);if(text!==null)e.textContent=text;return e;}
    input(value=""){const i=this.el("input");i.value=value;Object.assign(i.style,{width:"100%",boxSizing:"border-box",padding:"10px",margin:"5px 0",border:"1px solid #475569",borderRadius:"8px",background:'#0f172a',color:'#f8fafc'});return i;}
    button(text,fn){const b=this.el("button",text);Object.assign(b.style,{padding:"10px 13px",border:'1px solid #475569',borderRadius:"8px",cursor:"pointer",fontWeight:"700",margin:"4px",background:'#1e293b',color:'#f8fafc'});b.addEventListener("click",fn);return b;}
    money(v){return Number(v||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});}
    adminRole(user={}){return String(user.admin_role||user.adminRole||user.role||'').toLowerCase();}
    isAdmin(user={}){return ['owner','admin','moderator','support','economy'].includes(this.adminRole(user));}
    gameId(){return window.worldAccounts?.gameAccessGate?.gameIdAccess?.getLocalGameId?.()||'';}
    async open(){if(this.overlay)return;const overlay=this.el("div");Object.assign(overlay.style,{position:"fixed",inset:0,zIndex:21000,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"92px 20px 20px",boxSizing:'border-box'});const panel=this.el("div");Object.assign(panel.style,{width:"min(680px,95vw)",maxHeight:"calc(100vh - 112px)",overflow:"auto",background:"#111827",color:'#f8fafc',border:'1px solid #334155',borderRadius:"14px",padding:"22px",fontFamily:"Arial,sans-serif"});overlay.append(panel);this.parent.append(overlay);this.overlay=overlay;await this.render(panel);}
    close(){this.overlay?.remove();this.overlay=null;}
    async render(panel){
        panel.innerHTML="";let data;try{data=await this.api.accountOverview();}catch(error){panel.append(this.el("h2","Spielerprofil"),this.el("div",`Serverprofil nicht verfügbar: ${error.message}`),this.button("Schließen",()=>this.close()));return;}
        const user=data.user||{},wallet=data.wallet||{balance:0},companies=data.companies||[],transactions=data.transactions||[];
        window.worldServerAccountOverview=data;if(window.worldCurrentUser)window.worldCurrentUser={...window.worldCurrentUser,...user};
        const head=this.el("div");Object.assign(head.style,{display:"flex",justifyContent:"space-between",alignItems:"center",position:'sticky',top:0,zIndex:30,background:'#111827',borderBottom:'1px solid #334155',padding:'4px 0 8px'});head.append(this.el("h2","🎮 Spielerprofil"),this.button("✕",()=>this.close()));panel.append(head);

        const gameId=this.gameId();
        panel.append(this.el("div",`Spielername: ${user.display_name||user.username||"-"}`),this.el("div",`Status: ${user.status||"-"}`));
        const idBox=this.el('div');Object.assign(idBox.style,{margin:'14px 0',padding:'14px',border:'1px solid #725e25',borderRadius:'10px',background:'#1b170b'});
        idBox.append(this.el('strong','Deine Spiel-ID'));
        const code=this.el('div',gameId||'Auf diesem Gerät noch nicht gespeichert');Object.assign(code.style,{margin:'8px 0',fontFamily:'monospace',fontSize:'16px',fontWeight:'800',letterSpacing:'1px',color:'#f4bd43',overflowWrap:'anywhere'});idBox.append(code);
        if(gameId){
            idBox.append(this.button('Spiel-ID kopieren',async()=>{try{await navigator.clipboard.writeText(gameId);alert('Spiel-ID kopiert.');}catch{alert(gameId);}}));
        }
        idBox.append(this.el('div','Mit dieser ID kannst du auf einem anderen Handy, Tablet oder im Browser genau diesen letzten Spielstand laden. Bewahre sie sicher auf.'));
        panel.append(idBox);

        if(this.isAdmin(user)){const role=this.adminRole(user),badge=this.el('div',`🛠 Adminzugang · ${role==='owner'?'Owner':role}`);Object.assign(badge.style,{display:'inline-flex',alignItems:'center',gap:'8px',margin:'12px 0',padding:'7px 11px',borderRadius:'999px',background:'#2a2110',color:'#f4bd43',border:'1px solid #8a6a22',fontWeight:'800',fontSize:'13px'});panel.append(badge);}
        const display=this.input(user.display_name||user.username||""),country=this.input(user.country_code||"DE"),language=this.input(user.language_code||"de");panel.append(this.el("h3","Profil"),this.el("div","Anzeigename"),display,this.el("div","Land"),country,this.el("div","Sprache"),language,this.button("Profil speichern",async()=>{try{await this.api.updateProfile({displayName:display.value,countryCode:country.value,languageCode:language.value});alert("Profil gespeichert.");await this.render(panel);}catch(e){alert(e.message);}}));
        panel.append(this.el("h3","🪙 Coin-Wallet"),this.el("div",`Kontostand: ${Number(wallet.balance||0).toLocaleString("de-DE")} Coins`));
        if(transactions.length){const list=this.el("div");transactions.slice(0,8).forEach(t=>list.append(this.el("div",`${new Date(t.created_at).toLocaleString("de-DE")} · ${Number(t.amount)>0?"+":""}${t.amount} · ${t.transaction_type}`)));panel.append(list);}else panel.append(this.el("div","Noch keine Coin-Transaktionen."));
        panel.append(this.el("h3",`🏢 Betriebe (${companies.length})`));for(const c of companies)panel.append(this.el("div",`Betrieb ${c.slot_no}: ${c.name} · ${c.company_type||"-"} · ${this.money(c.money)} € · ${c.setup_phase}`));
        const actions=[this.button("Betriebe verwalten",()=>{this.close();window.worldAccounts?.businessPortfolioDialog?.open?.();})];
        if(this.isAdmin(user))actions.push(this.button("🛠 Adminbereich öffnen",async()=>{this.close();try{await window.worldInGameAdminAccess?.open?.();}catch(e){alert(`Adminbereich konnte nicht geöffnet werden: ${e.message}`);}}));
        actions.push(this.button('Neue Spiel-ID erzeugen',async()=>{if(!confirm('Die bisherige Spiel-ID wird dadurch ungültig. Neue Spiel-ID erzeugen?'))return;try{const result=await window.worldAccounts?.gameAccessGate?.gameIdAccess?.rotateGameId?.();alert(`Neue Spiel-ID:\n${result.gameId}\n\nBitte sicher aufbewahren.`);await this.render(panel);}catch(e){alert(e.message);}}));
        actions.push(this.button("Anderen Spielstand öffnen",async()=>{await window.worldAccounts?.gameAccessGate?.switchGame?.();}));
        panel.append(...actions);window.dispatchEvent(new CustomEvent('world:profile-updated',{detail:{user:window.worldCurrentUser||user}}));
    }
}
