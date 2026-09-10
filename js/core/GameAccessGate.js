// ORVUNO - normaler Account-Zugang im Web/App; CrazyGames Basic bleibt Gastzugang.
import { AuthApiClient } from "./AuthApiClient.js";
import { AccountAuthDialog } from "./AccountAuthDialog.js";
import { GameIdAccessClient, GameIdAccessDialog } from "./GameIdAccess.js";
import { applyPlayerMoneyContext } from "./CurrencyPresentationBridge.js";

function isCrazyGamesRuntime(){
    if(typeof window!=="undefined"&&window.orvunoCrazyGames?.active)return true;
    if(typeof location==="undefined")return false;
    const p=new URLSearchParams(location.search||"");
    return p.get("source")==="crazygames"||p.get("crazygames")==="1"||p.get("platform")==="crazygames";
}

export class GameAccessGate {
    constructor({ accountSystem, api = new AuthApiClient() } = {}) {
        this.accountSystem=accountSystem;
        this.api=api;
        this.gameIdAccess=new GameIdAccessClient({api:this.api});
        this.dialog=null;
        this.user=null;
        this.backendOnline=false;
        this._resolver=null;
        this._promise=null;
    }

    async detectBackend(){ try{ await this.api.health(); this.backendOnline=true; }catch{ this.backendOnline=false; } return this.backendOnline; }

    markTutorialVoluntary(user){
        const id=String(user?.id||user?.authId||user?.auth_user_id||user?.public_id||'').trim();
        if(!id)return;
        try{localStorage.setItem(`orvuno.tutorial.v1.seen.${id}`,'1');}catch{}
    }

    async grant(user){
        if(!user||user.status!=="active") return false;
        this.user=user;
        window.worldCurrentUser=user;

        let profile=user;
        try{
            window.worldServerAccountOverview=await this.api.accountOverview();
            profile={...user,...(window.worldServerAccountOverview?.user||{})};
            this.user=profile;
            window.worldCurrentUser=profile;
            if(window.worldServerAccountOverview)window.worldServerAccountOverview.user=profile;
            applyPlayerMoneyContext(profile);
            window.dispatchEvent(new CustomEvent("worldproject:profile-loaded",{detail:{profile}}));
        }catch(error){
            console.warn("Serverübersicht konnte noch nicht geladen werden",error);
            applyPlayerMoneyContext(user);
        }

        this.markTutorialVoluntary(profile);
        document.documentElement.classList.add("orvuno-authenticated");

        window.dispatchEvent(new CustomEvent("world:access-granted",{detail:{user:profile}}));
        if(this._resolver){ const resolve=this._resolver; this._resolver=null; resolve(profile); }
        return true;
    }

    async restoreSession(){
        await this.detectBackend();
        if(!this.backendOnline) return null;
        try{
            const user=await this.api.me();
            if(user?.status==="active"){ await this.grant(user); return this.user||user; }
        }catch{}
        // Unsichtbarer Migrations-Fallback für Geräte, die noch eine alte lokale Kennung besitzen.
        try{
            const user=await this.gameIdAccess.resumeLocalPlayer();
            if(user?.status==="active"){ await this.grant(user); return this.user||user; }
        }catch{}
        return null;
    }

    async ensureAccess(){
        if(this.user){ document.documentElement.classList.add("orvuno-authenticated"); return this.user; }
        if(!this._promise) this._promise=new Promise(resolve=>{this._resolver=resolve;});
        const restored=await this.restoreSession();
        if(restored) return restored;
        this.openPlayerAccess();
        return this._promise;
    }

    openPlayerAccess(){
        if(this.dialog?.overlay) return;
        document.documentElement.classList.remove("orvuno-authenticated");

        // CrazyGames Basic: anonymer Gastzugang; das Plattform-Modul ersetzt den Dialog passend.
        if(isCrazyGamesRuntime()){
            this.dialog=new GameIdAccessDialog({client:this.gameIdAccess,onAuthenticated:user=>this.grant(user)});
            this.dialog.open();
            return;
        }

        // Web, Amazon und Google: bestehende Accounts wieder normal per E-Mail/Passwort anmelden.
        this.dialog=new AccountAuthDialog({accountSystem:this.accountSystem,api:this.api,required:true,onAuthenticated:user=>this.grant(user)});
        this.dialog.open("login");
    }

    openGameIdAccess(){ return this.openPlayerAccess(); }
    openRequiredLogin(){ this.openPlayerAccess(); }

    async switchGame(){
        try{ await this.api.logout(); }catch{}
        this.user=null;
        window.worldCurrentUser=null;
        window.worldServerAccountOverview=null;
        this.gameIdAccess.clearLocalGameId();
        document.documentElement.classList.remove("orvuno-authenticated");
        window.dispatchEvent(new CustomEvent("world:access-revoked"));
        location.reload();
    }

    async logout(){ return this.switchGame(); }
}
