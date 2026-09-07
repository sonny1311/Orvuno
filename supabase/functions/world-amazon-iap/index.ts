import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)?.trim()||"";
const INTERNAL_SKU_BY_AMAZON:Record<string,string>={
 "orvuno_coins_100":"coins_100","orvuno_coins_550":"coins_550","orvuno_coins_1200":"coins_1200","orvuno_coins_2600":"coins_2600",
 "orvuno_coins_6000":"coins_6000","orvuno_coins_13000":"coins_13000","orvuno_coins_26000":"coins_26000","orvuno_coins_50000":"coins_50000",
 "orvuno_premium_4w":"premium_4w","orvuno_premium_3m":"premium_3m","orvuno_premium_6m":"premium_6m","orvuno_premium_12m":"premium_12m"
};

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

  const body=await req.json().catch(()=>({}));
  const amazonUserId=String(body?.amazonUserId||"").trim();
  const receiptId=String(body?.receiptId||"").trim();
  const amazonSku=String(body?.sku||"").trim();
  const internalSku=INTERNAL_SKU_BY_AMAZON[amazonSku]||"";
  if(!amazonUserId||amazonUserId.length>512||!receiptId||receiptId.length>1024||!amazonSku||amazonSku.length>150||!internalSku)return json({error:"Amazon-Kaufdaten sind unvollständig oder das Produkt ist unbekannt"},400);

  const {data:product,error:productError}=await sb.from("store_products").select("sku,active,kind").eq("sku",internalSku).eq("active",true).maybeSingle();
  if(productError||!product||!["coins","premium"].includes(String(product.kind)))return json({error:"Amazon-Produkt ist in ORVUNO nicht verfügbar"},400);

  const mode=(env("AMAZON_RVS_MODE")||"production").toLowerCase();
  const sandbox=mode==="sandbox";
  let secret=env("AMAZON_RVS_SHARED_SECRET");
  if(!secret){
   const {data,error}=await sb.rpc("get_server_secret",{p_name:"AMAZON_RVS_SHARED_SECRET"});
   if(!error&&typeof data==="string")secret=data.trim();
  }
  if(!secret)return json({error:"Amazon RVS ist serverseitig noch nicht vollständig konfiguriert"},503);
  const suffix=sandbox?"?testVerification=true":"";
  const verifyUrl=`https://appstore-sdk.amazon.com/version/1.0/verifyReceiptId/developer/${encodeURIComponent(secret)}/user/${encodeURIComponent(amazonUserId)}/receiptId/${encodeURIComponent(receiptId)}${suffix}`;
  const r=await fetch(verifyUrl,{headers:{Accept:"application/json"}});
  const verified=await r.json().catch(()=>({}));
  if(r.status===410)return json({error:"Amazon-Kauf wurde storniert oder ist nicht mehr gültig"},409);
  if(!r.ok)return json({error:r.status===429?"Amazon-Prüfung ist ausgelastet. Bitte gleich erneut versuchen.":"Amazon-Kauf konnte nicht bestätigt werden",amazonStatus:r.status},r.status===429?429:400);
  if(String(verified?.receiptId||"")!==receiptId||String(verified?.productId||"")!==amazonSku)return json({error:"Amazon-Beleg passt nicht zum angeforderten Produkt"},409);
  if(verified?.cancelDate!==null&&verified?.cancelDate!==undefined)return json({error:"Amazon-Kauf wurde storniert"},409);
  if(!sandbox&&verified?.testTransaction===true)return json({error:"Testkauf kann in der Live-Version nicht gutgeschrieben werden"},409);
  if(!["CONSUMABLE","ENTITLED","SUBSCRIPTION"].includes(String(verified?.productType||"")))return json({error:"Unbekannter Amazon-Produkttyp"},409);

  const {data:fulfillment,error:fulfillError}=await sb.rpc("fulfill_amazon_purchase",{p_user_id:Number(profile.id),p_receipt_id:receiptId,p_sku:internalSku,p_status:"paid"});
  if(fulfillError){console.error("Amazon fulfillment failed",fulfillError.code);return json({error:"Amazon-Zahlung bestätigt, Gutschrift konnte aber nicht abgeschlossen werden"},500);}
  return json({success:true,verified:true,provider:"amazon",receiptId,sku:internalSku,amazonSku,fulfillment});
 }catch(error){console.error("world-amazon-iap",error instanceof Error?error.message:"unknown");return json({error:error instanceof Error?error.message:"Amazon-IAP-Fehler"},500);}
});
