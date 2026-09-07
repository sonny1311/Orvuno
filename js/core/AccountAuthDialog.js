// ORVUNO - sichtbare Supabase-Registrierung/Login
import { AuthApiClient } from "./AuthApiClient.js";

export class AccountAuthDialog {
    constructor({ accountSystem, api = new AuthApiClient(), parent = document.body, required = false, onAuthenticated = null } = {}) {
        this.accountSystem=accountSystem;
        this.api=api;
        this.parent=parent;
        this.overlay=null;
        this.backendOnline=false;
        this.currentUser=null;
        this.required=required;
        this.onAuthenticated=onAuthenticated;
        this.busy=new WeakSet();
    }

    el(tag,text=null){const e=document.createElement(tag);if(text!==null)e.textContent=text;return e;}
    input(type,placeholder){const i=this.el("input");i.type=type;i.placeholder=placeholder;Object.assign(i.style,{width:"100%",boxSizing:"border-box",padding:"14px 16px",margin:"7px 0 16px",borderRadius:"10px",border:"1px solid #465064",fontSize:"16px",background:"#111827",color:"#f8fafc",outline:"none"});return i;}
    button(text,onClick){const b=this.el("button",text);b.type="button";Object.assign(b.style,{padding:"13px 16px",border:"1px solid #465064",borderRadius:"10px",cursor:"pointer",fontWeight:"700",background:"#151e2f",color:"#f8fafc"});b.addEventListener("click",onClick);return b;}
    i18n(){return window.orvunoI18n||null;}
    locale(){return this.i18n()?.getLocale?.()||"de";}
    tx(key,de,en){const api=this.i18n();const value=api?.t?.(key);if(value&&value!==key)return value;return this.locale()==="de"?de:en;}
    recoveryMode(){return this.api?.session?.type==="recovery";}

    async withBusy(button,task){
        if(!button||this.busy.has(button))return;
        this.busy.add(button);const wasDisabled=button.disabled;button.disabled=true;button.setAttribute("aria-busy","true");button.style.opacity=".62";button.style.cursor="wait";
        try{return await task();}
        finally{this.busy.delete(button);button.disabled=wasDisabled;button.removeAttribute("aria-busy");button.style.opacity="";button.style.cursor="pointer";}
    }

    chooseInitialLocale(){
        const api=this.i18n();if(!api?.getAvailableLocales||!api?.setLocale)return;
        let saved="";try{saved=localStorage.getItem("orvuno.locale")||"";}catch{}
        if(saved)return;
        const available=new Set(api.getAvailableLocales().map(x=>String(x.code||"").toLowerCase()));
        const requested=(navigator.languages?.length?navigator.languages:[navigator.language]).filter(Boolean);
        for(const raw of requested){const code=String(raw).toLowerCase().replace("_","-").split("-")[0];if(available.has(code)){api.setLocale(code);return;}}
        if(available.has("en"))api.setLocale("en");
    }

    defaultCountry(){const raw=String(navigator.language||"");const m=raw.match(/[-_]([A-Za-z]{2})$/);if(m)return m[1].toUpperCase();return this.locale()==="de"?"DE":"";}
    async detectBackend(){try{await this.api.health();this.backendOnline=true;}catch{this.backendOnline=false;}return this.backendOnline;}
    isMobile(){return window.matchMedia?.("(max-width: 760px)")?.matches||window.innerWidth<=760;}

    async open(mode="login"){
        if(this.overlay)return;
        this.chooseInitialLocale();
        await this.detectBackend();
        if(this.recoveryMode())mode="recovery";
        const mobile=this.isMobile();
        const overlay=this.el("div");
        Object.assign(overlay.style,{position:"fixed",inset:"0",zIndex:"20000",background:"radial-gradient(circle at 50% 15%,#17263d 0,#07101d 48%,#03070c 100%)",display:"flex",alignItems:mobile?"stretch":"center",justifyContent:"center",padding:mobile?"0":"28px",overflow:"auto",boxSizing:"border-box"});
        const shell=this.el("div");
        Object.assign(shell.style,mobile?{width:"100%",minHeight:"100dvh",display:"block",background:"#0c1422",border:"0",borderRadius:"0",overflow:"auto",boxShadow:"none",fontFamily:"Arial,sans-serif",color:"#fff"}:{width:"min(1420px,96vw)",minHeight:"min(820px,92vh)",display:"grid",gridTemplateColumns:"minmax(390px,.9fr) minmax(500px,1.1fr)",background:"#0c1422",border:"1px solid #394457",borderRadius:"24px",overflow:"hidden",boxShadow:"0 30px 100px rgba(0,0,0,.55)",fontFamily:"Arial,sans-serif",color:"#fff"});
        overlay.append(shell);this.parent.append(overlay);this.overlay=overlay;this.render(shell,mode);
    }

    close(){if(this.required&&!this.currentUser)return false;this.overlay?.remove();this.overlay=null;return true;}
    feature(icon,title,text){const row=this.el("div");Object.assign(row.style,{display:"grid",gridTemplateColumns:"52px 1fr",gap:"15px",margin:"25px 0"});const ico=this.el("div",icon);ico.style.fontSize="32px";const body=this.el("div"),h=this.el("strong",title),p=this.el("div",text);Object.assign(h.style,{display:"block",fontSize:"19px",color:"#f4bd43",marginBottom:"5px"});Object.assign(p.style,{fontSize:"15px",lineHeight:"1.5",color:"#dce3ed"});body.append(h,p);row.append(ico,body);return row;}

    renderBrand(shell){
        const left=this.el("section");Object.assign(left.style,{padding:"55px 62px",background:"linear-gradient(180deg,rgba(4,13,27,.78),rgba(5,16,31,.94)),radial-gradient(circle at 70% 70%,#263d5b,#06101d 65%)",borderRight:"1px solid #394457",display:"flex",flexDirection:"column"});
        const logo=this.el("div"),mark=this.el("div","◉"),word=this.el("div");Object.assign(mark.style,{fontSize:"58px",color:"#f4bd43",fontWeight:"900"});word.innerHTML='<b style="display:block;font-size:48px;line-height:1;letter-spacing:4px">ORVUNO</b><span style="display:block;margin-top:7px;color:#f4bd43;font-weight:800;letter-spacing:2px">ECONOMY SIMULATION</span>';Object.assign(logo.style,{display:"flex",alignItems:"center",gap:"18px",marginBottom:"22px"});logo.append(mark,word);
        const tag=this.el("div",this.locale()==="de"?"Deine Welt. Deine Wirtschaft. Dein Erfolg.":"Your world. Your economy. Your success.");Object.assign(tag.style,{fontSize:"20px",paddingBottom:"26px",borderBottom:"1px solid #314055"});
        left.append(logo,tag,this.feature("🏢",this.locale()==="de"?"Dein Unternehmen":"Your company",this.locale()==="de"?"Baue Betriebe auf, optimiere Produktionen und entwickle deinen eigenen Konzern.":"Build businesses, optimize production and grow your own company group."),this.feature("📈",this.locale()==="de"?"Echte Wirtschaft":"Real economy",this.locale()==="de"?"Realistische Märkte, Lieferketten, Kosten und dynamische Preise.":"Realistic markets, supply chains, costs and dynamic prices."),this.feature("👥",this.locale()==="de"?"Spielerwirtschaft":"Player economy",this.locale()==="de"?"Handle und kooperiere mit anderen Spielern in einer verbundenen Wirtschaft.":"Trade and cooperate with other players in a connected economy."));
        const safe=this.el("div");Object.assign(safe.style,{marginTop:"auto",paddingTop:"20px",borderTop:"1px solid #314055"});safe.append(this.feature("🛡️",this.locale()==="de"?"Sicher & Fair":"Secure & Fair",this.locale()==="de"?"Accountbasierter Spielstand und servergestützte Wirtschaft für ein faires Spielerlebnis.":"Account-based saves and a server-backed economy for fair gameplay."));left.append(safe);shell.append(left);
    }

    renderLanguageSelector(panel,shell,mode){
        const api=this.i18n();if(!api?.getAvailableLocales)return;
        const row=this.el("div");Object.assign(row.style,{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",padding:"10px 12px",marginBottom:"18px",border:"1px solid #33445d",borderRadius:"10px",background:"#0d1727"});
        const label=this.el("strong",`🌐 ${this.tx("language.label","Sprache","Language")}`);label.style.fontSize="14px";
        const select=this.el("select");Object.assign(select.style,{minWidth:"130px",maxWidth:"55%",padding:"9px 10px",borderRadius:"8px",border:"1px solid #465b78",background:"#142033",color:"#fff",fontWeight:"700"});
        for(const entry of api.getAvailableLocales()){const option=this.el("option",entry.nativeName||entry.name||entry.code);option.value=entry.code;select.append(option);}select.value=this.locale();
        select.onchange=()=>{api.setLocale(select.value);this.render(shell,mode);};row.append(label,select);panel.append(row);
    }

    render(shell,mode="login"){
        if(this.recoveryMode())mode="recovery";
        shell.innerHTML="";
        const mobile=this.isMobile();
        if(!mobile)this.renderBrand(shell);
        const panel=this.el("section");
        Object.assign(panel.style,mobile?{minHeight:"100dvh",padding:"max(28px,env(safe-area-inset-top)) 22px max(28px,env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",justifyContent:"center",background:"linear-gradient(160deg,#101a2b,#07101d)",boxSizing:"border-box"}:{padding:"62px 70px",display:"flex",flexDirection:"column",justifyContent:"center",background:"linear-gradient(135deg,#111a2a,#0c1422)"});
        if(mobile){const brand=this.el("div");brand.innerHTML='<div style="font-size:34px;font-weight:900;letter-spacing:3px">ORVUNO</div><div style="margin-top:5px;color:#f4bd43;font-size:12px;font-weight:800;letter-spacing:1.5px">ECONOMY SIMULATION</div>';Object.assign(brand.style,{textAlign:"center",marginBottom:"24px"});panel.append(brand);}
        this.renderLanguageSelector(panel,shell,mode);
        const recovery=mode==="recovery";
        const titleText=recovery?(this.locale()==="de"?"🔐  Neues Passwort setzen":"🔐  Set a new password"):(mode==="login"?`👤  ${this.tx("auth.login","Anmelden","Sign in")}`:`👤  ${this.tx("auth.register","Registrieren","Register")}`);
        const title=this.el("h1",titleText);Object.assign(title.style,{margin:"0 0 8px",fontSize:mobile?"30px":"36px",textAlign:mobile?"center":"left"});
        const sub=this.el("div",recovery?(this.locale()==="de"?"Der Reset-Link wurde erkannt. Lege jetzt ein neues Passwort fest, bevor das Spiel geöffnet wird.":"The recovery link was detected. Set a new password before the game opens."):(mode==="login"?(this.locale()==="de"?"Melde dich bei ORVUNO an":"Sign in to ORVUNO"):(this.locale()==="de"?"Erstelle deinen ORVUNO-Account":"Create your ORVUNO account")));Object.assign(sub.style,{color:"#aab4c5",fontSize:mobile?"16px":"18px",marginBottom:"25px",textAlign:mobile?"center":"left"});panel.append(title,sub);
        const status=this.el("div",this.backendOnline?(this.locale()==="de"?"●  Spielserver verbunden":"●  Game server connected"):(this.locale()==="de"?"●  Spielserver nicht erreichbar – Spielstart bleibt gesperrt":"●  Game server unavailable – game access remains locked"));Object.assign(status.style,{padding:"14px 16px",borderRadius:"10px",border:`1px solid ${this.backendOnline?'#21663f':'#8b3030'}`,background:this.backendOnline?'rgba(21,92,55,.18)':'rgba(130,35,35,.18)',color:this.backendOnline?'#55df85':'#ff8585',fontWeight:"700",marginBottom:"24px",fontSize:mobile?"14px":"16px"});panel.append(status);
        if(recovery)this.renderRecovery(panel);else if(mode==="login")this.renderLogin(panel);else this.renderRegister(panel,shell);
        if(!recovery){const divider=this.el("div",this.locale()==="de"?"oder":"or");Object.assign(divider.style,{textAlign:"center",color:"#9ba6b8",margin:"18px 0"});panel.append(divider);const switcher=this.button(mode==="login"?(this.locale()==="de"?"Noch keinen Account? Registrieren":"No account yet? Register"):(this.locale()==="de"?"Schon registriert? Anmelden":"Already registered? Sign in"),()=>this.render(shell,mode==="login"?"register":"login"));Object.assign(switcher.style,{width:"100%",borderColor:"#376bff",color:"#9cc0ff",background:"transparent"});panel.append(switcher);}
        shell.append(panel);
    }

    async authenticated(user){this.currentUser=user;window.worldCurrentUser=user;if(this.onAuthenticated)await this.onAuthenticated(user);this.overlay?.remove();this.overlay=null;window.dispatchEvent(new CustomEvent("world:user-login",{detail:{user}}));}

    renderLogin(panel){
        const de=this.locale()==="de",label1=this.el("strong",this.tx("auth.email","E-Mail-Adresse","Email address")),email=this.input("email",de?"name@beispiel.de":"name@example.com"),label2=this.el("strong",this.tx("auth.password","Passwort","Password")),password=this.input("password",de?"Dein Passwort":"Your password");panel.append(label1,email,label2,password);
        const login=this.button(this.tx("auth.login","Anmelden","Sign in"),()=>this.withBusy(login,async()=>{try{if(!this.backendOnline)throw new Error(de?"Der Spielserver ist derzeit nicht erreichbar.":"The game server is currently unavailable.");const result=await this.api.login({email:email.value.trim(),password:password.value});if(["restricted","suspended","banned"].includes(result.user.status))throw new Error(de?"Dieser Account ist derzeit nicht zum Spielen freigegeben.":"This account is currently not allowed to play.");if(result.user.status!=="active")throw new Error(de?"Bitte zuerst deine E-Mail-Adresse bestätigen.":"Please confirm your email address first.");await this.authenticated(result.user);}catch(error){alert(error.message);}}));Object.assign(login.style,{width:"100%",marginTop:"5px",background:"#3868ee",borderColor:"#4b78ff",color:"#fff",fontSize:"16px"});panel.append(login);
        const helpers=this.el("div");Object.assign(helpers.style,{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"10px"});
        const reset=this.button(this.tx("auth.forgot","Passwort vergessen","Forgot password"),()=>this.withBusy(reset,async()=>{try{if(!email.value.trim())throw new Error(de?"Bitte zuerst die E-Mail-Adresse eingeben.":"Please enter your email address first.");await this.api.requestPasswordReset(email.value.trim());alert(de?"Wenn der Account existiert, wurde eine Reset-Mail versendet.":"If the account exists, a reset email has been sent.");}catch(e){alert(e.message);}}));
        const resend=this.button(de?"Bestätigungsmail erneut senden":"Resend confirmation email",()=>this.withBusy(resend,async()=>{try{if(!email.value.trim())throw new Error(de?"Bitte zuerst die E-Mail-Adresse eingeben.":"Please enter your email address first.");await this.api.resendVerification(email.value.trim());alert(de?"Bestätigungsmail wurde erneut angefordert.":"Confirmation email requested again.");}catch(e){alert(e.message);}}));helpers.append(reset,resend);panel.append(helpers);
    }

    renderRegister(panel,shell){
        const de=this.locale()==="de",username=this.input("text",de?"Benutzername":"Username"),email=this.input("email",this.tx("auth.email","E-Mail-Adresse","Email address")),password=this.input("password",de?"Passwort (mind. 10 Zeichen)":"Password (min. 10 characters)"),country=this.input("text",de?"Land (z. B. DE)":"Country (e.g. US)");country.value=this.defaultCountry();
        const terms=this.el("label"),termsBox=this.input("checkbox","");termsBox.style.width="auto";terms.append(termsBox,document.createTextNode(de?" AGB akzeptieren":" Accept Terms of Service"));const privacy=this.el("label"),privacyBox=this.input("checkbox","");privacyBox.style.width="auto";privacy.append(privacyBox,document.createTextNode(de?" Datenschutzerklärung akzeptieren":" Accept Privacy Policy"));panel.append(username,email,password,country,terms,privacy);
        const register=this.button(de?"ORVUNO-Account erstellen":"Create ORVUNO account",()=>this.withBusy(register,async()=>{try{if(!this.backendOnline)throw new Error(de?"Der Spielserver ist derzeit nicht erreichbar.":"The game server is currently unavailable.");if(!termsBox.checked||!privacyBox.checked)throw new Error(de?"AGB und Datenschutzerklärung müssen akzeptiert werden.":"Terms of Service and Privacy Policy must be accepted.");if(username.value.trim().length<3)throw new Error(de?"Benutzername muss mindestens 3 Zeichen haben.":"Username must be at least 3 characters long.");if(password.value.length<10)throw new Error(de?"Passwort muss mindestens 10 Zeichen haben.":"Password must be at least 10 characters long.");const result=await this.api.register({username:username.value.trim(),email:email.value.trim(),password:password.value,countryCode:country.value||this.defaultCountry()||"DE",languageCode:this.locale(),termsAccepted:true,privacyAccepted:true});if(result.session){const user=await this.api.me();await this.authenticated(user);return;}alert(de?"Account erstellt. Bitte bestätige jetzt die E-Mail. Erst danach kannst du ORVUNO spielen.":"Account created. Please confirm your email before playing ORVUNO.");this.render(shell,"login");}catch(error){alert(error.message);}}));Object.assign(register.style,{width:"100%",marginTop:"12px",background:"#3868ee",borderColor:"#4b78ff"});panel.append(register);
    }

    renderRecovery(panel){
        const de=this.locale()==="de",password=this.input("password",de?"Neues Passwort (mind. 10 Zeichen)":"New password (min. 10 characters)"),confirm=this.input("password",de?"Neues Passwort wiederholen":"Repeat new password");panel.append(this.el("strong",de?"Neues Passwort":"New password"),password,this.el("strong",de?"Passwort wiederholen":"Repeat password"),confirm);
        const submit=this.button(de?"Passwort speichern und ORVUNO öffnen":"Save password and open ORVUNO",()=>this.withBusy(submit,async()=>{try{if(!this.backendOnline)throw new Error(de?"Der Spielserver ist derzeit nicht erreichbar.":"The game server is currently unavailable.");if(!this.recoveryMode())throw new Error(de?"Der Passwort-Reset ist nicht mehr gültig. Bitte fordere eine neue Reset-Mail an.":"The password recovery session is no longer valid. Request a new reset email.");if(password.value.length<10)throw new Error(de?"Das neue Passwort muss mindestens 10 Zeichen haben.":"The new password must be at least 10 characters long.");if(password.value!==confirm.value)throw new Error(de?"Die beiden Passwörter stimmen nicht überein.":"The passwords do not match.");await this.api.resetPassword(null,password.value);if(this.api.session)this.api.saveSession({...this.api.session,type:null});const user=await this.api.me();if(user.status!=="active")throw new Error(de?"Dieser Account ist derzeit nicht zum Spielen freigegeben.":"This account is currently not allowed to play.");await this.authenticated(user);}catch(error){alert(error.message);}}));Object.assign(submit.style,{width:"100%",marginTop:"8px",background:"#3868ee",borderColor:"#4b78ff",fontSize:"16px"});panel.append(submit);
    }
}
