import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)?.trim()||"";
const PACKAGE_NAME=env("GOOGLE_PLAY_PACKAGE_NAME")||"de.nadena.orvuno";
const PLAY_SCOPE="https://www.googleapis.com/auth/androidpublisher";

function base64Url(input:Uint8Array|string){
  const bytes=typeof input==="string"?new TextEncoder().encode(input):input;
  let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function pemBytes(pem:string){
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");
  if(!body)throw new Error("Google Play service-account private key is missing");
  const binary=atob(body);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
}
async function serviceAccount(){
  const raw=env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if(!raw)throw new Error("Google Play service account is not configured");
  const value=JSON.parse(raw);
  if(!value?.client_email||!value?.private_key)throw new Error("Google Play service account is incomplete");
  return value;
}
async function googleAccessToken(){
  const account=await serviceAccount();
  const now=Math.floor(Date.now()/1000);
  const header=base64Url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const payload=base64Url(JSON.stringify({iss:account.client_email,scope:PLAY_SCOPE,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3300}));
  const unsigned=`${header}.${payload}`;
  const key=await crypto.subtle.importKey("pkcs8",pemBytes(account.private_key),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned)));
  const assertion=`${unsigned}.${base64Url(signature)}`;
  const form=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.access_token)throw new Error(body?.error_description||body?.error||"Google OAuth token request failed");
  return String(body.access_token);
}
function skuMap(){
  const raw=env("GOOGLE_PLAY_SKU_MAP_JSON");
  if(!raw)throw new Error("Google Play SKU mapping is not configured");
  const parsed=JSON.parse(raw);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Google Play SKU mapping is invalid");
  const out:Record<string,string>={};
  for(const [internalSku,playSku] of Object.entries(parsed)){
    const a=String(internalSku||"").trim(),b=String(playSku||"").trim();
    if(a&&b&&a.length<=150&&b.length<=150)out[a]=b;
  }
  if(!Object.keys(out).length)throw new Error("Google Play SKU mapping is empty");
  return out;
}
async function sha256Hex(value:string){
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return [...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function getPurchase(accessToken:string,playSku:string,purchaseToken:string){
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(playSku)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body?.error?.message||`Google Play purchase verification failed (${r.status})`);
  return body;
}
async function consumePurchase(accessToken:string,playSku:string,purchaseToken:string){
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(playSku)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
  const r=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`}});
  if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body?.error?.message||`Google Play consume failed (${r.status})`);}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const auth=req.headers.get("Authorization")||"",jwt=auth.replace(/^Bearer\s+/i,"");
    if(!jwt)return json({error:"Nicht angemeldet"},401);
    const sb=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await sb.auth.getUser(jwt);
    if(userError||!user)return json({error:"Sitzung ist ungültig"},401);
    const {data:profile,error:profileError}=await sb.from("users").select("id,status").eq("auth_user_id",user.id).maybeSingle();
    if(profileError||!profile||profile.status!=="active")return json({error:"Spielerkonto ist nicht aktiv"},403);
    const profileId=Number(profile.id);
    if(!Number.isSafeInteger(profileId)||profileId<=0)return json({error:"Ungültiges Spielerprofil"},403);

    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"");
    const mapping=skuMap();

    if(action==="catalog"){
      const internalSkus=Object.keys(mapping);
      const {data:products,error}=await sb.from("store_products").select("sku,kind,active").in("sku",internalSkus).eq("active",true);
      if(error)throw error;
      const rows=(products||[]).map((p:any)=>({internalSku:String(p.sku),playSku:mapping[String(p.sku)]||"",kind:String(p.kind||"")})).filter((p:any)=>p.playSku&&["coins","premium"].includes(p.kind));
      return json({success:true,provider:"google_play",packageName:PACKAGE_NAME,products:rows});
    }

    if(action!=="verify_purchase")return json({error:"Unbekannte Google-Play-Aktion"},400);
    const internalSku=String(body?.internalSku||"").trim();
    const playSku=String(body?.playSku||"").trim();
    const purchaseToken=String(body?.purchaseToken||"").trim();
    if(!internalSku||!playSku||!purchaseToken||purchaseToken.length>4096)return json({error:"Google-Play-Kaufdaten sind unvollständig"},400);
    if(mapping[internalSku]!==playSku)return json({error:"Google-Play-Produkt stimmt nicht mit ORVUNO überein"},409);

    const {data:product,error:productError}=await sb.from("store_products").select("sku,active,kind").eq("sku",internalSku).eq("active",true).maybeSingle();
    if(productError||!product||!["coins","premium"].includes(String(product.kind)))return json({error:"Google-Play-Produkt ist in ORVUNO nicht verfügbar"},400);

    const accessToken=await googleAccessToken();
    const purchase=await getPurchase(accessToken,playSku,purchaseToken);
    if(Number(purchase?.purchaseState)!==0)return json({error:"Google Play meldet den Kauf nicht als abgeschlossen",purchaseState:purchase?.purchaseState},409);
    if(purchase?.productId&&String(purchase.productId)!==playSku)return json({error:"Google-Play-Beleg gehört zu einem anderen Produkt"},409);
    if(Number(purchase?.quantity||1)!==1)return json({error:"Unerwartete Google-Play-Kaufmenge"},409);

    const transactionId=`gp_${await sha256Hex(purchaseToken)}`;
    const {data:fulfillment,error:fulfillError}=await sb.rpc("fulfill_google_play_purchase",{p_user_id:profileId,p_provider_transaction_id:transactionId,p_sku:internalSku,p_status:"purchased"});
    if(fulfillError){console.error("Google Play fulfillment failed",fulfillError.code);return json({error:"Google-Play-Kauf bestätigt, Gutschrift konnte nicht abgeschlossen werden"},500);}

    if(Number(purchase?.consumptionState||0)===0){
      try{await consumePurchase(accessToken,playSku,purchaseToken);}catch(error){
        console.error("Google Play consume failed after fulfillment",error instanceof Error?error.message:"unknown");
        return json({success:true,verified:true,fulfilled:true,consumePending:true,provider:"google_play",internalSku,playSku,transactionId,fulfillment});
      }
    }
    return json({success:true,verified:true,fulfilled:true,consumePending:false,provider:"google_play",internalSku,playSku,transactionId,fulfillment});
  }catch(error){
    console.error("world-google-play",error instanceof Error?error.message:"unknown");
    return json({error:error instanceof Error?error.message:"Google-Play-IAP-Fehler"},500);
  }
});
