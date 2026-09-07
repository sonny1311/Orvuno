import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import braintree from "npm:braintree@3.38.0";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)?.trim()||"";
const GOOGLE_PACKAGE_NAME="de.nadena.orvuno";
const GOOGLE_SCOPE="https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_TOKEN_URL="https://oauth2.googleapis.com/token";
const googleProductMap:Record<string,string>=Object.freeze({
 "orvuno_coins_100":"coins_100",
 "orvuno_coins_550":"coins_550",
 "orvuno_coins_1200":"coins_1200",
 "orvuno_coins_2600":"coins_2600",
 "orvuno_coins_6000":"coins_6000",
 "orvuno_coins_13000":"coins_13000",
 "orvuno_coins_26000":"coins_26000",
 "orvuno_coins_50000":"coins_50000",
 "orvuno_premium_1m":"premium_1m",
 "orvuno_premium_3m":"premium_3m",
 "orvuno_premium_6m":"premium_6m",
 "orvuno_premium_12m":"premium_12m"
});

function gateway(){
 const merchantId=env("BRAINTREE_MERCHANT_ID"),publicKey=env("BRAINTREE_PUBLIC_KEY"),privateKey=env("BRAINTREE_PRIVATE_KEY");
 if(!merchantId||!publicKey||!privateKey) throw new Error("Braintree ist serverseitig noch nicht konfiguriert");
 const mode=env("BRAINTREE_ENVIRONMENT").toLowerCase();
 if(mode&&mode!=="sandbox") throw new Error("ORVUNO akzeptiert derzeit ausschließlich Braintree-Sandboxzahlungen");
 return new braintree.BraintreeGateway({environment:braintree.Environment.Sandbox,merchantId,publicKey,privateKey});
}

function stripeConfig(){
 const key=env("STRIPE_SECRET_KEY");
 if(!key) throw new Error("Stripe ist serverseitig noch nicht konfiguriert");
 if(key.startsWith("sk_live_")) return {key,environment:"live",sessionPrefix:"cs_live_"};
 if(key.startsWith("sk_test_")) return {key,environment:"test",sessionPrefix:"cs_test_"};
 throw new Error("STRIPE_SECRET_KEY ist kein gültiger Stripe-Schlüssel");
}

const utf8=(value:string)=>new TextEncoder().encode(value);
function base64Url(bytes:Uint8Array){
 let raw="";
 for(const byte of bytes)raw+=String.fromCharCode(byte);
 return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function pemToBytes(pem:string){
 const body=pem.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");
 if(!body)throw new Error("Google-Play-Privatschlüssel fehlt");
 const raw=atob(body),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}
function googleServiceAccount(){
 const raw=env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
 if(!raw)throw new Error("Google Play Service Account ist serverseitig noch nicht konfiguriert");
 let account:any;
 try{account=JSON.parse(raw);}catch(_e){throw new Error("Google Play Service Account JSON ist ungültig");}
 if(!account?.client_email||!account?.private_key)throw new Error("Google Play Service Account ist unvollständig");
 return account;
}
async function googleAccessToken(){
 const account=googleServiceAccount(),now=Math.floor(Date.now()/1000);
 const header=base64Url(utf8(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claims=base64Url(utf8(JSON.stringify({iss:String(account.client_email),scope:GOOGLE_SCOPE,aud:GOOGLE_TOKEN_URL,iat:now,exp:now+3500})));
 const unsigned=`${header}.${claims}`;
 const key=await crypto.subtle.importKey("pkcs8",pemToBytes(String(account.private_key)),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf8(unsigned)));
 const assertion=`${unsigned}.${base64Url(signature)}`;
 const form=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion});
 const response=await fetch(GOOGLE_TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload?.access_token)throw new Error(payload?.error_description||"Google Play API Anmeldung fehlgeschlagen");
 return String(payload.access_token);
}
async function googlePublisherRequest(path:string,method="GET"){
 const token=await googleAccessToken();
 const response=await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
 const payload=response.status===204?{}:await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload?.error?.message||`Google Play API Fehler (${response.status})`);
 return payload;
}
async function verifyGoogleProductPurchase(productId:string,purchaseToken:string){
 const expectedSku=googleProductMap[productId];
 if(!expectedSku)throw new Error("Unbekanntes Google-Play-Produkt");
 if(!purchaseToken||purchaseToken.length>4096)throw new Error("Ungültiger Google-Play-Kaufbeleg");
 const path=`applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
 const purchase=await googlePublisherRequest(path);
 if(Number(purchase?.purchaseState)!==0)throw new Error("Google Play meldet den Kauf nicht als abgeschlossen");
 if(purchase?.productId&&String(purchase.productId)!==productId)throw new Error("Google Play lieferte ein anderes Produkt zurück");
 return {purchase,internalSku:expectedSku};
}
async function consumeGoogleProduct(productId:string,purchaseToken:string){
 const path=`applications/${encodeURIComponent(GOOGLE_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
 await googlePublisherRequest(path,"POST");
}
async function purchaseTokenReference(token:string){
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",utf8(token)));
 return `gplay_${base64Url(digest)}`;
}

async function retrieveStripeCheckoutSession(sessionId:string){
 const id=String(sessionId||"").trim();
 const stripe=stripeConfig();
 if(!id.startsWith(stripe.sessionPrefix)||id.length>255) throw new Error("Ungültige Stripe-Session");
 const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${stripe.key}`}});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload?.id) throw new Error(payload?.error?.message||"Stripe-Checkoutstatus konnte nicht geprüft werden");
 if(payload.livemode!==(stripe.environment==="live")||String(payload.id)!==id||!String(payload.id).startsWith(stripe.sessionPrefix)) throw new Error("Stripe lieferte keine gültige Session für die konfigurierte Umgebung");
 return {...payload,orvuno_environment:stripe.environment};
}

async function expireStripeCheckoutSession(sessionId:string){
 try{
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,{method:"POST",headers:{Authorization:`Bearer ${stripeConfig().key}`}});
 }catch(error){console.warn("Verwaiste Stripe-Testsession konnte nicht automatisch abgelaufen werden",error instanceof Error?error.message:"unknown");}
}

async function createStripeCheckoutSession(product:any,profileId:number){
 const stripe=stripeConfig(),key=stripe.key;
 const base=env("STRIPE_CHECKOUT_BASE_URL").replace(/\/$/,"");
 if(!/^https:\/\//i.test(base)) throw new Error("STRIPE_CHECKOUT_BASE_URL muss auf eine HTTPS-Spieladresse zeigen");
 const sku=String(product.sku),label=String(product.label||sku),amountCents=Math.round(Number(product.price_eur)*100);
 if(!sku||!Number.isInteger(amountCents)||amountCents<=0) throw new Error("Ungültiges Stripe-Kaufprodukt");
 const expiresAt=Math.floor(Date.now()/1000)+1800;
 const form=new URLSearchParams();
 form.set("mode","payment");
 form.set("success_url",`${base}/?payment=stripe_success&session_id={CHECKOUT_SESSION_ID}`);
 form.set("cancel_url",`${base}/?payment=stripe_cancelled`);
 form.set("client_reference_id",String(profileId));
 form.set("expires_at",String(expiresAt));
 form.set("line_items[0][quantity]","1");
 form.set("line_items[0][price_data][currency]","eur");
 form.set("line_items[0][price_data][unit_amount]",String(amountCents));
 form.set("line_items[0][price_data][product_data][name]",label);
 form.set("metadata[user_id]",String(profileId));
 form.set("metadata[sku]",sku);
 form.set("payment_intent_data[metadata][user_id]",String(profileId));
 form.set("payment_intent_data[metadata][sku]",sku);
 const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/x-www-form-urlencoded"},body:form});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||!payload?.id||!payload?.url) throw new Error(payload?.error?.message||"Stripe Checkout konnte nicht erstellt werden");
 if(payload.livemode!==(stripe.environment==="live")||!String(payload.id).startsWith(stripe.sessionPrefix)) throw new Error("Stripe hat eine Checkout-Session aus der falschen Umgebung zurückgegeben");
 return {sessionId:String(payload.id),url:String(payload.url),expiresAt:Number(payload.expires_at||expiresAt),environment:stripe.environment};
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization")||"",jwt=auth.replace(/^Bearer\s+/i,"");
  if(!jwt) return json({error:"Nicht angemeldet"},401);
  const url=env("SUPABASE_URL"),serviceKey=env("SUPABASE_SERVICE_ROLE_KEY");
  const sb=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await sb.auth.getUser(jwt);
  if(userError||!user) return json({error:"Sitzung ist ungültig"},401);
  const {data:profile,error:profileError}=await sb.from("users").select("id,status").eq("auth_user_id",user.id).maybeSingle();
  if(profileError||!profile||profile.status!=="active") return json({error:"Spielerkonto ist nicht aktiv"},403);
  const profileId=Number(profile.id);
  if(!Number.isSafeInteger(profileId)||profileId<=0) return json({error:"Ungültiges Spielerprofil"},403);
  const body=await req.json().catch(()=>({}));const action=String(body?.action||"");

  if(action==="google_play_purchase"){
   const productId=String(body?.productId||"").trim(),purchaseToken=String(body?.purchaseToken||"").trim();
   const {purchase,internalSku}=await verifyGoogleProductPurchase(productId,purchaseToken);
   const tokenRef=await purchaseTokenReference(purchaseToken);
   const {data:fulfilled,error:fulfillError}=await sb.rpc("fulfill_google_play_purchase",{p_user_id:profileId,p_provider_transaction_id:tokenRef,p_sku:internalSku,p_status:"paid"});
   if(fulfillError){console.error("Google Play fulfillment failed",fulfillError.code);return json({success:false,error:"Google-Play-Kauf bestätigt, Gutschrift konnte nicht abgeschlossen werden. Bitte Support kontaktieren."},500);}
   if(Number(purchase?.consumptionState)!==1){
    try{await consumeGoogleProduct(productId,purchaseToken);}catch(error){console.error("Google Play consume failed",error instanceof Error?error.message:"unknown");return json({success:false,error:"Kauf wurde gutgeschrieben, konnte bei Google Play aber noch nicht abgeschlossen werden. Bitte erneut öffnen."},503);}
   }
   return json({success:true,fulfilled:true,provider:"google_play",productId,sku:internalSku,orderId:String(purchase?.orderId||""),fulfillment:fulfilled});
  }

  if(action==="stripe_checkout"){
   const sku=String(body?.sku||"");
   if(!sku) return json({error:"Produkt fehlt"},400);
   const {data:product,error:productError}=await sb.from("store_products").select("sku,label,price_eur,active,kind,coin_amount,premium_plan,duration_days").eq("sku",sku).eq("active",true).maybeSingle();
   if(productError||!product) return json({error:"Produkt ist nicht verfügbar"},400);
   const kind=String(product.kind||"");
   if(kind==="coins"&&Number(product.coin_amount)<=0) return json({error:"Coin-Paket ist ungültig"},409);
   if(kind==="premium"&&(!String(product.premium_plan||"")||Number(product.duration_days)<=0)) return json({error:"Premium-Paket ist ungültig"},409);
   if(!["coins","premium"].includes(kind)) return json({error:"Produkttyp ist nicht kaufbar"},409);
   const session=await createStripeCheckoutSession(product,profileId);
   const {error:intentError}=await sb.from("payment_checkout_intents").insert({provider:"stripe",provider_session_id:session.sessionId,user_id:profileId,sku:String(product.sku),amount_eur:Number(product.price_eur),currency:"EUR",kind,coin_amount:kind==="coins"?Number(product.coin_amount):null,premium_plan:kind==="premium"?String(product.premium_plan):null,duration_days:kind==="premium"?Number(product.duration_days):null,expires_at:new Date(session.expiresAt*1000).toISOString()});
   if(intentError){await expireStripeCheckoutSession(session.sessionId);console.error("Stripe checkout intent snapshot failed",intentError.code);return json({error:"Stripe Checkout konnte nicht sicher vorbereitet werden"},500);}
   return json({success:true,provider:"stripe",environment:session.environment,sessionId:session.sessionId,url:session.url,expiresAt:session.expiresAt});
  }

  if(action==="stripe_status"){
   const sessionId=String(body?.sessionId||"").trim();
   const session=await retrieveStripeCheckoutSession(sessionId);
   const expectedUser=String(profileId),metadataUser=String(session?.metadata?.user_id||""),referenceUser=String(session?.client_reference_id||"");
   if(!metadataUser||!referenceUser||metadataUser!==expectedUser||referenceUser!==expectedUser) return json({error:"Stripe-Session gehört nicht zu diesem Spielerkonto"},403);
   const sku=String(session?.metadata?.sku||"");
   const amountCents=Number(session?.amount_total),currency=String(session?.currency||"").toUpperCase();
   const paymentIntent=typeof session?.payment_intent==="string"?session.payment_intent:"";
   if(!sku||!Number.isInteger(amountCents)||amountCents<=0||currency!=="EUR") return json({error:"Stripe-Session enthält kein gültiges Kaufprodukt"},409);
   const {data:intent,error:intentError}=await sb.from("payment_checkout_intents").select("sku,amount_eur,currency,fulfilled_at").eq("provider","stripe").eq("provider_session_id",sessionId).eq("user_id",profileId).maybeSingle();
   if(intentError||!intent) return json({error:"Stripe-Checkout ist ORVUNO nicht bekannt"},409);
   const expectedCents=Math.round(Number(intent.amount_eur)*100);
   if(String(intent.sku)!==sku||String(intent.currency).toUpperCase()!==currency||!Number.isInteger(expectedCents)||amountCents!==expectedCents) return json({error:"Stripe-Session stimmt nicht mit dem gespeicherten Kauf überein"},409);
   const checkoutStatus=String(session?.status||""),paymentStatus=String(session?.payment_status||"");
   const paid=checkoutStatus==="complete"&&paymentStatus==="paid";
   let fulfilled=!!intent.fulfilled_at;
   if(paid&&!fulfilled&&paymentIntent.startsWith("pi_")){
    const {data:purchase,error:purchaseError}=await sb.from("payment_purchases").select("id").eq("user_id",profileId).eq("provider","stripe").eq("provider_transaction_id",paymentIntent).maybeSingle();
    if(purchaseError) console.warn("Stripe fulfillment status lookup failed",purchaseError.code);
    fulfilled=!!purchase;
   }
   return json({success:true,provider:"stripe",environment:String(session.orvuno_environment),sessionId:String(session.id),checkoutStatus,paymentStatus,sku,paid,fulfilled});
  }

  const gw=gateway();
  if(action==="client_token"){
   const token=await new Promise<string>((resolve,reject)=>gw.clientToken.generate({},(err:any,res:any)=>err?reject(err):resolve(res.clientToken)));
   return json({success:true,clientToken:token,environment:"sandbox"});
  }
  if(action!=="checkout") return json({error:"Unbekannte Zahlungsaktion"},400);
  const sku=String(body?.sku||""),nonce=String(body?.paymentMethodNonce||""),deviceData=body?.deviceData?String(body.deviceData):undefined;
  if(!sku||!nonce) return json({error:"Produkt oder Zahlungsfreigabe fehlt"},400);
  const {data:product,error:productError}=await sb.from("store_products").select("sku,label,price_eur,active").eq("sku",sku).eq("active",true).maybeSingle();
  if(productError||!product) return json({error:"Produkt ist nicht verfügbar"},400);
  const amount=Number(product.price_eur).toFixed(2);
  const sale=await new Promise<any>((resolve,reject)=>gw.transaction.sale({amount,paymentMethodNonce:nonce,deviceData,options:{submitForSettlement:true},orderId:`ORVUNO-${profileId}-${sku}-${Date.now()}`},(err:any,result:any)=>err?reject(err):resolve(result)));
  if(!sale?.success||!sale?.transaction?.id){
   const message=sale?.message||sale?.errors?.deepErrors?.()?.map((x:any)=>x.message).join("; ")||"Zahlung wurde abgelehnt";
   return json({success:false,error:message},402);
  }
  const tx=sale.transaction,status=String(tx.status||""),currency=String(tx.currencyIsoCode||"EUR").toUpperCase();
  if(currency!=="EUR") return json({success:false,error:"Zahlung wurde in einer unerwarteten Währung verarbeitet",transactionId:tx.id},500);
  if(!["submitted_for_settlement","settling","settled"].includes(status)) return json({success:false,error:"Zahlung ist noch nicht zur Gutschrift freigegeben",transactionId:tx.id,status},409);
  const {data:fulfilled,error:fulfillError}=await sb.rpc("fulfill_braintree_purchase",{p_user_id:profileId,p_provider_transaction_id:String(tx.id),p_sku:sku,p_amount_eur:Number(tx.amount||amount),p_currency:currency,p_status:status});
  if(fulfillError){console.error("fulfillment failed",fulfillError);return json({success:false,error:"Zahlung bestätigt, Gutschrift konnte nicht abgeschlossen werden. Bitte Support kontaktieren.",transactionId:tx.id},500);}
  return json({success:true,transactionId:tx.id,status,fulfillment:fulfilled});
 }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Zahlungsfehler"},500);}
});
