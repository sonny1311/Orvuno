// WorldProject - harter Spielzugang: ohne aktiven Supabase-Account kein Spiel
import { AccountAuthDialog } from "./AccountAuthDialog.js";
import { AuthApiClient } from "./AuthApiClient.js";
import { applyPlayerMoneyContext } from "./CurrencyPresentationBridge.js";

export class GameAccessGate {
    constructor({ accountSystem, api = new AuthApiClient() } = {}) {
        this.accountSystem=accountSystem; this.api=api; this.dialog=null; this.user=null; this.backendOnline=false; this._resolver=null; this._promise=null;
    }

    async detectBackend(){ try{ await this.api.health(); this.backendOnline=true; }catch{ this.backendOnline=false; } return this.backendOnline; }
    recoveryPending(){ return this.api?.session?.type==="recovery"; }

    async grant(user){
        if(!user) return false;
        if(user.status!=="active") return false;
        // Ein Recovery-Token ist nur zum Setzen eines neuen Passworts gedacht.
        // Solange dieser Zustand aktiv ist, darf die Spieloberfläche nicht freigegeben werden.
        if(this.recoveryPending()) return false;

        // Erst den vom Login gelieferten Benutzer setzen, damit der Spielstart nicht blockiert.
        // Danach wird das vollständige, durch RLS geschützte Serverprofil geladen und als
        // alleinige Laufzeitquelle verwendet. Darin steckt u. a. die echte admin_role.
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

        // Erst NACH erfolgreicher Authentifizierung wird die Spieloberfläche sichtbar.
        // Dadurch sieht ein nicht angemeldeter App-Nutzer ausschließlich den Login-Dialog.
        document.documentElement.classList.add("orvuno-authenticated");

        // Wichtig: access-granted bekommt ebenfalls das vollständige Profil, damit
        // InGameAdminAccessIntegration die serverseitige owner/admin-Rolle sofort sieht.
        window.dispatchEvent(new CustomEvent("world:access-granted",{detail:{user:profile}}));
        if(this._resolver){ const resolve=this._resolver; this._resolver=null; resolve(profile); }
        return true;
    }

    async restoreSession(){
        await this.detectBackend();
        if(!this.backendOnline||this.recoveryPending()) return null;
        try{ const user=await this.api.me(); if(user?.status==="active"){ await this.grant(user); return this.user||user; } }
        catch{}
        return null;
    }

    async ensureAccess(){
        if(this.user&&!this.recoveryPending()){ document.documentElement.classList.add("orvuno-authenticated"); return this.user; }
        if(!this._promise) this._promise=new Promise(resolve=>{this._resolver=resolve;});
        const restored=await this.restoreSession(); if(restored) return restored;
        this.openRequiredLogin(this.recoveryPending()?"recovery":"login"); return this._promise;
    }

    openRequiredLogin(mode=null){
        if(this.dialog?.overlay) return;
        document.documentElement.classList.remove("orvuno-authenticated");
        this.dialog=new AccountAuthDialog({accountSystem:this.accountSystem,api:this.api,required:true,onAuthenticated:user=>this.grant(user)});
        this.dialog.open(mode|| (this.recoveryPending()?"recovery":"login"));
    }

    async logout(){
        try{ await this.api.logout(); }catch{}
        this.user=null; window.worldCurrentUser=null; window.worldServerAccountOverview=null;
        document.documentElement.classList.remove("orvuno-authenticated");
        window.dispatchEvent(new CustomEvent("world:access-revoked")); location.reload();
    }
}
