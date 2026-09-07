// ORVUNO - Spielerprofil, Coin-Wallet und Betriebe
export class AccountProfileDialog {
    constructor({api,parent=document.body}={}){this.api=api;this.parent=parent;this.overlay=null;}
    el(tag,text=null){const e=document.createElement(tag);if(text!==null)e.textContent=text;return e;}
    input(value=""){const i=this.el("input");i.value=value;Object.assign(i.style,{width:"100%",boxSizing:"border-box",padding:"10px",margin:"5px 0",border:"1px solid #475569",borderRadius:"8px",background:'#0f172a',color:'#f8fafc'});return i;}
    button(text,fn){const b=this.el("button",text);Object.assign(b.style,{padding:"10px 13px",border:'1px solid #475569',borderRadius:"8px",cursor:"pointer",fontWeight:"700",margin:"4px",background:'#1e293b',color:'#f8fafc'});b.addEventListener("click",fn);return b;}
    money(v){return Number(v||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});}
    adminRole(user={}){return String(user.admin_role||user.adminRole||user.role||'').toLowerCase();}
    isAdmin(user={}){return ['owner','admin','moderator','support','economy'].includes(this.adminRole(user));}
    date(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toLocaleString('de-DE');}
    async open(){if(this.overlay)return;const overlay=this.el("div");Object.assign(overlay.style,{position:"fixed",inset:0,zIndex:21000,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"92px 20px 20px",boxSizing:'border-box'});const panel=this.el("div");Object.assign(panel.style,{width:"min(680px,95vw)",maxHeight:"calc(100vh - 112px)",overflow:"auto",background:"#111827",color:"#f8fafc",border:'1px solid #334155',borderRadius:"14px",padding:"22px",fontFamily:"Arial,sans-serif"});overlay.append(panel);this.parent.append(overlay);this.overlay=overlay;await this.render(panel);}
    close(){this.overlay?.remove();this.overlay=null;}
    async render(panel){
        panel.innerHTML="";let data;try{data=await this.api.accountOverview();}catch(error){panel.append(this.el("h2","Account"),this.el("div",`Serverprofil nicht verfügbar: ${error.message}`),this.button("Schließen",()=>this.close()));return;}
        const user=data.user||{},wallet=data.wallet||{balance:0},companies=data.companies||[],transactions=data.transactions||[];
        window.worldServerAccountOverview=data;if(window.worldCurrentUser)window.worldCurrentUser={...window.worldCurrentUser,...user};
        const head=this.el("div");Object.assign(head.style,{display:"flex",justifyContent:"space-between",alignItems:"center",position:'sticky',top:0,zIndex:30,background:'#111827',borderBottom:'1px solid #334155',padding:'4px 0 8px'});head.append(this.el("h2","👤 Spielerprofil"),this.button("✕",()=>this.close()));panel.append(head);
        panel.append(this.el("div",`Benutzername: ${user.username||"-"}`),this.el("div",`E-Mail: ${user.email||"-"}`),this.el("div",`Status: ${user.status||"-"}`),this.el("div",`Spieler-ID: ${user.public_id||user.id||"-"}`));
        if(this.isAdmin(user)){const role=this.adminRole(user),badge=this.el('div',`🛠 Adminzugang · ${role==='owner'?'Owner':role}`);Object.assign(badge.style,{display:'inline-flex',alignItems:'center',gap:'8px',margin:'12px 0',padding:'7px 11px',borderRadius:'999px',background:'#2a2110',color:'#f4bd43',border:'1px solid #8a6a22',fontWeight:'800',fontSize:'13px'});panel.append(badge);}
        const display=this.input(user.display_name||user.username||""),country=this.input(user.country_code||"DE"),language=this.input(user.language_code||"de");panel.append(this.el("h3","Profil"),this.el("div","Anzeigename"),display,this.el("div","Land"),country,this.el("div","Sprache"),language,this.button("Profil speichern",async()=>{try{await this.api.updateProfile({displayName:display.value,countryCode:country.value,languageCode:language.value});alert("Profil gespeichert.");await this.render(panel);}catch(e){alert(e.message);}}));

        const tutorialBox=this.el('section');Object.assign(tutorialBox.style,{margin:'18px 0',padding:'14px',border:'1px solid #36557a',borderRadius:'12px',background:'rgba(19,47,78,.35)'});
        const seen=this.date(user.tutorial_seen_at),completed=this.date(user.tutorial_completed_at);
        tutorialBox.append(this.el('h3','❓ Hilfe & Tutorial'),this.el('div',completed?`Tutorial abgeschlossen: ${completed}`:seen?`Tutorial bereits angezeigt: ${seen}`:'Tutorial wird beim ersten Spielstart einmal automatisch angezeigt.'),this.el('div','Danach bleibt es hier im Profil jederzeit verfügbar. Zusätzlich erklären ?-Symbole direkt an wichtigen Aktionen die jeweilige Spielsequenz.'));
        const helpActions=this.el('div');Object.assign(helpActions.style,{display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'10px'});
        helpActions.append(this.button('▶ Tutorial ansehen',()=>{this.close();window.orvunoHelp?.startTutorial?.({manual:true});}),this.button('❓ Spielhilfe öffnen',()=>{this.close();window.orvunoHelp?.open?.();}));tutorialBox.append(helpActions);panel.append(tutorialBox);

        panel.append(this.el("h3","🪙 Coin-Wallet"),this.el("div",`Kontostand: ${Number(wallet.balance||0).toLocaleString("de-DE")} Coins`));
        if(transactions.length){const list=this.el("div");transactions.slice(0,8).forEach(t=>list.append(this.el("div",`${new Date(t.created_at).toLocaleString("de-DE")} · ${Number(t.amount)>0?"+":""}${t.amount} · ${t.transaction_type}`)));panel.append(list);}else panel.append(this.el("div","Noch keine Coin-Transaktionen."));
        panel.append(this.el("h3",`🏢 Betriebe (${companies.length}/4)`));for(const c of companies)panel.append(this.el("div",`Betrieb ${c.slot_no}: ${c.name} · ${c.company_type||"-"} · ${this.money(c.money)} € · ${c.setup_phase}`));
        const actions=[this.button("Betriebe verwalten",()=>{this.close();window.worldAccounts?.businessPortfolioDialog?.open?.();})];if(this.isAdmin(user))actions.push(this.button("🛠 Adminbereich öffnen",async()=>{this.close();try{await window.worldInGameAdminAccess?.open?.();}catch(e){alert(`Adminbereich konnte nicht geöffnet werden: ${e.message}`);}}));actions.push(this.button("Abmelden",async()=>{await window.worldAccounts?.gameAccessGate?.logout?.();}));panel.append(...actions);window.dispatchEvent(new CustomEvent('world:profile-updated',{detail:{user:window.worldCurrentUser||user}}));
    }
}
