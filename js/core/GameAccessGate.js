// ORVUNO - Spielzugang ohne sichtbare Anmeldung oder Wiederherstellungscode.
import { AuthApiClient } from "./AuthApiClient.js";
import { GameIdAccessClient, GameIdAccessDialog } from "./GameIdAccess.js";
import { applyPlayerMoneyContext } from "./CurrencyPresentationBridge.js";

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

        // Das Tutorial ist freiwillig. Der lokale Marker verhindert nur den automatischen Erststart;
        // "Tutorial öffnen" und die Hilfe bleiben jederzeit manuell erreichbar.
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
        this.dialog=new GameIdAccessDialog({client:this.gameIdAccess,onAuthenticated:user=>this.grant(user)});
        this.dialog.open();
    }

    // Kompatibilitätsalias für ältere Integrationen; die Oberfläche enthält keine Spiel-ID mehr.
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
