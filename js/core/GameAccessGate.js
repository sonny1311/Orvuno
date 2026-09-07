// ORVUNO - Spielzugang ohne sichtbare Anmeldung: automatisch oder per Spiel-ID.
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

        document.documentElement.classList.add("orvuno-authenticated");
        try{
            const issued=await this.gameIdAccess.ensureForCurrentPlayer();
            if(issued?.gameId)window.dispatchEvent(new CustomEvent("world:game-id-issued",{detail:{gameId:issued.gameId}}));
        }catch(error){console.warn("Spiel-ID konnte noch nicht zugeordnet werden",error);}

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
        this.openGameIdAccess();
        return this._promise;
    }

    openGameIdAccess(){
        if(this.dialog?.overlay) return;
        document.documentElement.classList.remove("orvuno-authenticated");
        this.dialog=new GameIdAccessDialog({client:this.gameIdAccess,onAuthenticated:user=>this.grant(user)});
        this.dialog.open();
    }

    openRequiredLogin(){ this.openGameIdAccess(); }

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
