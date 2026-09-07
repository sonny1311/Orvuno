import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)?.trim()||"";
const ALPHABET="23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const normalize=(v:unknown)=>String(v||"").toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g,"");
const normalizeUsername=(v:unknown)=>String(v||"").trim().replace(/\s+/g," ");
const validUsername=(v:string)=>v.length>=3&&v.length<=24&&/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(v);
function randomId(){const bytes=crypto.getRandomValues(new Uint8Array(20));let s="";for(const b of bytes)s+=ALPHABET[b%ALPHABET.length];return `ORV-${s.slice(0,5)}-${s.slice(5,10)}-${s.slice(10,15)}-${s.slice(15,20)}`;}
async function sha256Hex(value:string){const d=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return [...d].map(x=>x.toString(16).padStart(2,"0")).join("");}
function internalEmail(id:string){return `player-${id}@game-id.orvuno.invalid`;}
async function issueSession(admin:any,anon:any,email:string){
  const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email});
  if(linkError)throw linkError;
  const tokenHash=String(link?.properties?.hashed_token||"");
  if(!tokenHash)throw new Error("Spieler-Sitzung konnte nicht erzeugt werden");
  const {data:verified,error:verifyError}=await anon.auth.verifyOtp({token_hash:tokenHash,type:"email"});
  if(verifyError||!verified.session)throw new Error(verifyError?.message||"Spieler-Sitzung konnte nicht geöffnet werden");
  return verified.session;
}
async function authenticatedProfile(req:Request,admin:any){
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!jwt)throw new Error("Nicht angemeldet");
  const {data:{user},error:userError}=await admin.auth.getUser(jwt);
  if(userError||!user)throw new Error("Sitzung ist ungültig");
  const {data:profile,error:profileError}=await admin.from("users").select("id,status").eq("auth_user_id",user.id).maybeSingle();
  if(profileError||!profile||profile.status!=="active")throw new Error("Spielerkonto ist nicht aktiv");
  return profile;
}
async function makeCredential(admin:any,userId:number){
  const gameId=randomId(),compact=normalize(gameId),hash=await sha256Hex(compact),hint=compact.slice(-4),now=new Date().toISOString();
  const {error}=await admin.from("game_id_credentials").upsert({user_id:userId,game_id_hash:hash,game_id_hint:hint,updated_at:now,last_used_at:now},{onConflict:"user_id"});
  if(error)throw error;
  return {gameId,hint};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=env("SUPABASE_URL"),service=env("SUPABASE_SERVICE_ROLE_KEY"),anonKey=env("SUPABASE_ANON_KEY");
    if(!url||!service||!anonKey)return json({error:"Server configuration incomplete"},500);
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const anon=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"");

    // Nur für alte, bereits vorhandene Spielstände. Neue Spieler erhalten keine sichtbare Kennung mehr.
    if(action==="issue"||action==="rotate"){
      let profile;
      try{profile=await authenticatedProfile(req,admin);}catch(error){return json({error:error instanceof Error?error.message:"Nicht angemeldet"},401);}
      if(action==="issue"){
        const {data:existing}=await admin.from("game_id_credentials").select("game_id_hint").eq("user_id",profile.id).maybeSingle();
        if(existing)return json({success:true,alreadyIssued:true,hint:existing.game_id_hint});
      }
      const credential=await makeCredential(admin,Number(profile.id));
      return json({success:true,...credential,rotated:action==="rotate"});
    }

    if(action==="create"){
      const username=normalizeUsername(body?.username);
      if(!validUsername(username))return json({error:"Benutzername: 3–24 Zeichen; erlaubt sind Buchstaben, Zahlen, Leerzeichen, Punkt, Bindestrich und Unterstrich"},400);
      if(body?.privacyAccepted!==true)return json({error:"Bitte bestätige zuerst die Datenschutzerklärung"},400);

      const {data:existing,error:existingError}=await admin.from("users").select("id").eq("username",username).maybeSingle();
      if(existingError)throw existingError;
      if(existing)return json({error:"Dieser Benutzername ist bereits vergeben"},409);

      const id=crypto.randomUUID(),email=internalEmail(id),now=new Date().toISOString();
      const {data:created,error:createError}=await admin.auth.admin.createUser({
        id,email,email_confirm:true,
        user_metadata:{username,country_code:"DE",language_code:"de",privacy_version:"1.0",privacy_acknowledged:true,registration_channel:"device_session"}
      });
      if(createError||!created.user){
        const duplicate=/duplicate|unique|username/i.test(String(createError?.message||""));
        return json({error:duplicate?"Dieser Benutzername ist bereits vergeben":(createError?.message||"Spieler konnte nicht erstellt werden")},duplicate?409:500);
      }

      const {data:profile,error:profileError}=await admin.from("users").select("id,status").eq("auth_user_id",created.user.id).maybeSingle();
      if(profileError||!profile)throw new Error(profileError?.message||"Spielerprofil fehlt");
      const {error:updateError}=await admin.from("users").update({
        username,display_name:username,status:"active",privacy_accepted_at:now,privacy_version:"1.0",terms_accepted_at:null,terms_version:"not-required"
      }).eq("id",profile.id);
      if(updateError)throw updateError;

      const session=await issueSession(admin,anon,email);
      return json({success:true,session,username});
    }

    // Unsichtbarer Migrationsweg für ältere lokale Spielstände.
    if(action==="resume"){
      const compact=normalize(body?.gameId);
      if(compact.length!==20)return json({error:"Wiederherstellungskennung ist ungültig"},400);
      const hash=await sha256Hex(compact);
      const {data:cred,error:credError}=await admin.from("game_id_credentials").select("user_id").eq("game_id_hash",hash).maybeSingle();
      if(credError)throw credError;
      if(!cred)return json({error:"Wiederherstellungskennung wurde nicht gefunden"},404);
      const {data:profile,error:profileError}=await admin.from("users").select("id,status,auth_user_id,email").eq("id",cred.user_id).maybeSingle();
      if(profileError||!profile||profile.status!=="active")return json({error:"Spielstand ist nicht verfügbar"},403);
      if(!profile.auth_user_id||!profile.email)return json({error:"Dieser alte Spielstand braucht einmalig eine interne Zuordnung"},409);
      const session=await issueSession(admin,anon,String(profile.email));
      await admin.from("game_id_credentials").update({last_used_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",profile.id);
      return json({success:true,session,hint:compact.slice(-4)});
    }

    return json({error:"Unbekannte Aktion"},400);
  }catch(error){console.error("world-game-id-auth",error instanceof Error?error.message:"unknown");return json({error:error instanceof Error?error.message:"Zugangsfehler"},500);}
});
