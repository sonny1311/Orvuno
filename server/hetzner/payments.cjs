const crypto=require("crypto");
const braintree=require("braintree");

function env(name){return String(process.env[name]||"").trim();}
function jsonError(res,error){
  console.error(error);
  const status=Number(error?.status)>=400&&Number(error?.status)<=599?Number(error.status):500;
  res.status(status).json({success:false,error:error?.message||"Serverfehler"});
}
function httpError(status,message){const e=new Error(message);e.status=status;return e;}
function stripeConfig(){
  const key=env("STRIPE_SECRET_KEY");
  if(!key)throw httpError(503,"Stripe ist serverseitig noch nicht konfiguriert");
  if(key.startsWith("sk_live_"))return{key,live:true,environment:"live",sessionPrefix:"cs_live_"};
  if(key.startsWith("sk_test_"))return{key,live:false,environment:"test",sessionPrefix:"cs_test_"};
  throw httpError(503,"STRIPE_SECRET_KEY ist ungueltig");
}
async function stripeForm(path,form){
  const cfg=stripeConfig();
  const r=await fetch("https://api.stripe.com/v1/"+path,{method:"POST",headers:{Authorization:"Bearer "+cfg.key,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw httpError(502,body?.error?.message||"Stripe-Anfrage fehlgeschlagen");
  return body;
}
async function retrieveStripeSession(id){
  const cfg=stripeConfig();
  id=String(id||"").trim();
  if(!id.startsWith(cfg.sessionPrefix)||id.length>255)throw httpError(400,"Ungueltige Stripe-Session");
  const r=await fetch("https://api.stripe.com/v1/checkout/sessions/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+cfg.key}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.id)throw httpError(502,body?.error?.message||"Stripe-Checkoutstatus konnte nicht geprueft werden");
  if(String(body.id)!==id||body.livemode!==cfg.live)throw httpError(409,"Stripe lieferte eine Session aus der falschen Umgebung");
  return {...body,orvuno_environment:cfg.environment};
}
async function expireStripeSession(id){
  try{await stripeForm("checkout/sessions/"+encodeURIComponent(id)+"/expire",new URLSearchParams());}catch(e){console.warn("Stripe session expire failed",e?.message||e);}
}
async function createStripeSession(product,userId){
  const cfg=stripeConfig();
  const base=env("STRIPE_CHECKOUT_BASE_URL").replace(/\/$/,"");
  if(!/^https:\/\//i.test(base))throw httpError(503,"STRIPE_CHECKOUT_BASE_URL fehlt");
  const sku=String(product.sku),label=String(product.label||sku),amountCents=Math.round(Number(product.price_eur)*100);
  if(!sku||!Number.isInteger(amountCents)||amountCents<=0)throw httpError(409,"Ungueltiges Stripe-Kaufprodukt");
  const expiresAt=Math.floor(Date.now()/1000)+1800;
  const form=new URLSearchParams();
  form.set("mode","payment");
  form.set("success_url",base+"/?payment=stripe_success&session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url",base+"/?payment=stripe_cancelled");
  form.set("client_reference_id",String(userId));
  form.set("expires_at",String(expiresAt));
  form.set("line_items[0][quantity]","1");
  form.set("line_items[0][price_data][currency]","eur");
  form.set("line_items[0][price_data][unit_amount]",String(amountCents));
  form.set("line_items[0][price_data][product_data][name]",label);
  form.set("metadata[user_id]",String(userId));
  form.set("metadata[sku]",sku);
  form.set("payment_intent_data[metadata][user_id]",String(userId));
  form.set("payment_intent_data[metadata][sku]",sku);
  const payload=await stripeForm("checkout/sessions",form);
  if(payload.livemode!==cfg.live||!String(payload.id||"").startsWith(cfg.sessionPrefix)||!payload.url)throw httpError(502,"Stripe-Session ist ungueltig");
  return{sessionId:String(payload.id),url:String(payload.url),expiresAt:Number(payload.expires_at||expiresAt),environment:cfg.environment};
}
function gateway(){
  const merchantId=env("BRAINTREE_MERCHANT_ID"),publicKey=env("BRAINTREE_PUBLIC_KEY"),privateKey=env("BRAINTREE_PRIVATE_KEY");
  if(!merchantId||!publicKey||!privateKey)throw httpError(503,"Braintree ist serverseitig noch nicht konfiguriert");
  const mode=(env("BRAINTREE_ENVIRONMENT")||env("BRAINTREE_ENV")||"sandbox").toLowerCase();
  const environment=mode==="production"||mode==="live"?braintree.Environment.Production:braintree.Environment.Sandbox;
  return{mode:environment===braintree.Environment.Production?"production":"sandbox",gw:new braintree.BraintreeGateway({environment,merchantId,publicKey,privateKey})};
}
function btClientToken(gw){return new Promise((resolve,reject)=>gw.clientToken.generate({},(err,res)=>err?reject(err):resolve(res.clientToken)));}
function btSale(gw,payload){return new Promise((resolve,reject)=>gw.transaction.sale(payload,(err,res)=>err?reject(err):resolve(res)));}
function b64url(input){return Buffer.from(input).toString("base64url");}
function googleServiceAccount(){
  const raw=env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if(!raw)throw httpError(503,"Google Play Service Account ist noch nicht auf Hetzner konfiguriert");
  const value=JSON.parse(raw);
  if(!value?.client_email||!value?.private_key)throw httpError(503,"Google Play Service Account ist unvollstaendig");
  return value;
}
async function googleAccessToken(){
  const account=googleServiceAccount(),now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const payload=b64url(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/androidpublisher",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3300}));
  const unsigned=header+"."+payload;
  const signature=crypto.sign("RSA-SHA256",Buffer.from(unsigned),account.private_key).toString("base64url");
  const form=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+signature});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.access_token)throw httpError(502,body?.error_description||body?.error||"Google OAuth fehlgeschlagen");
  return String(body.access_token);
}
function googleSkuMap(){
  const out={coins_100:"orvuno_coins_100",coins_550:"orvuno_coins_550",coins_1200:"orvuno_coins_1200",coins_2600:"orvuno_coins_2600",coins_6000:"orvuno_coins_6000",coins_13000:"orvuno_coins_13000",coins_26000:"orvuno_coins_26000",coins_50000:"orvuno_coins_50000",premium_1m:"orvuno_premium_1m",premium_3m:"orvuno_premium_3m",premium_6m:"orvuno_premium_6m",premium_12m:"orvuno_premium_12m"};
  const raw=env("GOOGLE_PLAY_SKU_MAP_JSON");if(!raw)return out;
  const parsed=JSON.parse(raw);for(const [k,v] of Object.entries(parsed||{})){if(k&&v)out[String(k)]=String(v);}return out;
}
async function googlePurchase(accessToken,packageName,playSku,purchaseToken){
  const url="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+encodeURIComponent(packageName)+"/purchases/products/"+encodeURIComponent(playSku)+"/tokens/"+encodeURIComponent(purchaseToken);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+accessToken,Accept:"application/json"}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw httpError(502,body?.error?.message||"Google Play Kaufpruefung fehlgeschlagen");
  return body;
}
async function googleConsume(accessToken,packageName,playSku,purchaseToken){
  const url="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"+encodeURIComponent(packageName)+"/purchases/products/"+encodeURIComponent(playSku)+"/tokens/"+encodeURIComponent(purchaseToken)+":consume";
  const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+accessToken}});
  if(!r.ok){const b=await r.json().catch(()=>({}));throw httpError(502,b?.error?.message||"Google Play Consume fehlgeschlagen");}
}
function amazonSecret(){
  if(env("AMAZON_RVS_SHARED_SECRET"))return env("AMAZON_RVS_SHARED_SECRET");
  const b64=env("AMAZON_RVS_SHARED_SECRET_B64");
  if(!b64)return "";
  try{return Buffer.from(b64,"base64").toString("utf8").trim();}catch{return "";}
}
function secureEqualHex(a,b){try{const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&crypto.timingSafeEqual(x,y);}catch{return false;}}
function verifyStripeSignature(raw,header,secret){
  const parts=String(header||"").split(",").map(x=>x.trim());
  const timestamp=(parts.find(x=>x.startsWith("t="))||"").slice(2);
  const sigs=parts.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
  if(!/^\d+$/.test(timestamp)||!sigs.length)return false;
  if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)return false;
  const digest=crypto.createHmac("sha256",secret).update(timestamp+"."+raw).digest("hex");
  return sigs.some(sig=>secureEqualHex(digest,sig));
}

module.exports=function setupPayments({app,pool,withUser}){
  app.post("/api/orvuno/payments",async(req,res)=>{
    try{
      const out=await withUser(req,async({client,gameUser})=>{
        const body=req.body||{},action=String(body.action||""),userId=Number(gameUser.id);
        if(action==="stripe_checkout"){
          const sku=String(body.sku||"");
          const pr=await client.query("select sku,label,price_eur,active,kind,coin_amount,premium_plan,duration_days from public.store_products where sku=$1 and active=true limit 1",[sku]);
          const product=pr.rows[0];if(!product)throw httpError(400,"Produkt ist nicht verfuegbar");
          if(product.kind==="coins"&&Number(product.coin_amount)<=0)throw httpError(409,"Coin-Paket ist ungueltig");
          if(product.kind==="premium"&&(!product.premium_plan||Number(product.duration_days)<=0))throw httpError(409,"Premium-Paket ist ungueltig");
          if(!["coins","premium"].includes(String(product.kind)))throw httpError(409,"Produkttyp ist nicht kaufbar");
          const session=await createStripeSession(product,userId);
          try{
            await client.query("insert into public.payment_checkout_intents(provider,provider_session_id,user_id,sku,amount_eur,currency,kind,coin_amount,premium_plan,duration_days,expires_at) values('stripe',$1,$2,$3,$4,'EUR',$5,$6,$7,$8,to_timestamp($9))",[session.sessionId,userId,product.sku,Number(product.price_eur),product.kind,product.kind==="coins"?Number(product.coin_amount):null,product.kind==="premium"?product.premium_plan:null,product.kind==="premium"?Number(product.duration_days):null,session.expiresAt]);
          }catch(e){await expireStripeSession(session.sessionId);throw e;}
          return{success:true,source:"hetzner",provider:"stripe",...session};
        }
        if(action==="stripe_status"){
          const session=await retrieveStripeSession(body.sessionId),expected=String(userId);
          if(String(session?.metadata?.user_id||"")!==expected||String(session?.client_reference_id||"")!==expected)throw httpError(403,"Stripe-Session gehoert nicht zu diesem Spielerkonto");
          const sku=String(session?.metadata?.sku||""),amountCents=Number(session?.amount_total),currency=String(session?.currency||"").toUpperCase(),paymentIntent=typeof session?.payment_intent==="string"?session.payment_intent:"";
          const ir=await client.query("select * from public.payment_checkout_intents where provider='stripe' and provider_session_id=$1 and user_id=$2 limit 1",[String(session.id),userId]);
          const intent=ir.rows[0];if(!intent)throw httpError(409,"Stripe-Checkout ist ORVUNO nicht bekannt");
          const expectedCents=Math.round(Number(intent.amount_eur)*100);
          if(String(intent.sku)!==sku||String(intent.currency).toUpperCase()!==currency||expectedCents!==amountCents)throw httpError(409,"Stripe-Session stimmt nicht mit dem gespeicherten Kauf ueberein");
          const checkoutStatus=String(session.status||""),paymentStatus=String(session.payment_status||""),paid=checkoutStatus==="complete"&&paymentStatus==="paid";
          let fulfilled=!!intent.fulfilled_at;
          if(paid&&!fulfilled&&paymentIntent.startsWith("pi_")){
            const fr=await client.query("select public.fulfill_stripe_checkout_intent($1,$2,$3,$4,$5,$6) as result",[userId,String(session.id),paymentIntent,amountCents/100,currency,"paid"]);
            fulfilled=fr.rows[0]?.result?.success===true;
          }
          return{success:true,source:"hetzner",provider:"stripe",environment:String(session.orvuno_environment),sessionId:String(session.id),checkoutStatus,paymentStatus,sku,paid,fulfilled};
        }
        const bt=gateway();
        if(action==="client_token")return{success:true,source:"hetzner",clientToken:await btClientToken(bt.gw),environment:bt.mode};
        if(action!=="checkout")throw httpError(400,"Unbekannte Zahlungsaktion");
        const sku=String(body.sku||""),nonce=String(body.paymentMethodNonce||"");if(!sku||!nonce)throw httpError(400,"Produkt oder Zahlungsfreigabe fehlt");
        const pr=await client.query("select sku,label,price_eur,active from public.store_products where sku=$1 and active=true limit 1",[sku]);const product=pr.rows[0];if(!product)throw httpError(400,"Produkt ist nicht verfuegbar");
        const amount=Number(product.price_eur).toFixed(2);
        const sale=await btSale(bt.gw,{amount,paymentMethodNonce:nonce,deviceData:body.deviceData?String(body.deviceData):undefined,options:{submitForSettlement:true},orderId:"ORVUNO-"+userId+"-"+sku+"-"+Date.now()});
        if(!sale?.success||!sale?.transaction?.id)throw httpError(402,sale?.message||"Zahlung wurde abgelehnt");
        const tx=sale.transaction,status=String(tx.status||""),currency=String(tx.currencyIsoCode||"EUR").toUpperCase();
        if(currency!=="EUR")throw httpError(500,"Zahlung wurde in einer unerwarteten Waehrung verarbeitet");
        if(!["submitted_for_settlement","settling","settled"].includes(status))throw httpError(409,"Zahlung ist noch nicht zur Gutschrift freigegeben");
        const fr=await client.query("select public.fulfill_braintree_purchase($1,$2,$3,$4,$5,$6) as result",[userId,String(tx.id),sku,Number(tx.amount||amount),currency,status]);
        return{success:true,source:"hetzner",provider:"braintree",transactionId:String(tx.id),status,fulfillment:fr.rows[0].result};
      });
      res.json(out);
    }catch(e){jsonError(res,e);}
  });

  app.post("/api/orvuno/google-play",async(req,res)=>{
    try{
      const out=await withUser(req,async({client,gameUser})=>{
        const body=req.body||{},action=String(body.action||""),mapping=googleSkuMap(),packageName=env("GOOGLE_PLAY_PACKAGE_NAME")||"de.nadena.orvuno",userId=Number(gameUser.id);
        if(action==="catalog"){
          const rows=(await client.query("select sku,kind from public.store_products where active=true and sku=any($1::text[])",[Object.keys(mapping)])).rows.map(p=>({internalSku:String(p.sku),playSku:mapping[String(p.sku)]||"",kind:String(p.kind||"")})).filter(p=>p.playSku&&["coins","premium"].includes(p.kind));
          return{success:true,source:"hetzner",provider:"google_play",packageName,products:rows};
        }
        if(action!=="verify_purchase")throw httpError(400,"Unbekannte Google-Play-Aktion");
        const internalSku=String(body.internalSku||"").trim(),playSku=String(body.playSku||"").trim(),purchaseToken=String(body.purchaseToken||"").trim();
        if(!internalSku||!playSku||!purchaseToken||purchaseToken.length>4096)throw httpError(400,"Google-Play-Kaufdaten sind unvollstaendig");
        if(mapping[internalSku]!==playSku)throw httpError(409,"Google-Play-Produkt stimmt nicht mit ORVUNO ueberein");
        const product=(await client.query("select sku,kind from public.store_products where sku=$1 and active=true limit 1",[internalSku])).rows[0];
        if(!product||!["coins","premium"].includes(String(product.kind)))throw httpError(400,"Google-Play-Produkt ist nicht verfuegbar");
        const accessToken=await googleAccessToken(),purchase=await googlePurchase(accessToken,packageName,playSku,purchaseToken);
        if(Number(purchase?.purchaseState)!==0)throw httpError(409,"Google Play meldet den Kauf nicht als abgeschlossen");
        if(purchase?.productId&&String(purchase.productId)!==playSku)throw httpError(409,"Google-Play-Beleg gehoert zu einem anderen Produkt");
        if(Number(purchase?.quantity||1)!==1)throw httpError(409,"Unerwartete Google-Play-Kaufmenge");
        const transactionId="gp_"+crypto.createHash("sha256").update(purchaseToken).digest("hex");
        const fr=await client.query("select public.fulfill_google_play_purchase($1,$2,$3,$4) as result",[userId,transactionId,internalSku,"purchased"]);
        let consumePending=false;if(Number(purchase?.consumptionState||0)===0){try{await googleConsume(accessToken,packageName,playSku,purchaseToken);}catch(e){console.error("Google consume failed",e);consumePending=true;}}
        return{success:true,source:"hetzner",verified:true,fulfilled:true,consumePending,provider:"google_play",internalSku,playSku,transactionId,fulfillment:fr.rows[0].result};
      });
      res.json(out);
    }catch(e){jsonError(res,e);}
  });

  app.post("/api/orvuno/amazon-iap",async(req,res)=>{
    try{
      const out=await withUser(req,async({client,gameUser})=>{
        const body=req.body||{},amazonUserId=String(body.amazonUserId||"").trim(),receiptId=String(body.receiptId||"").trim(),amazonSku=String(body.sku||"").trim(),userId=Number(gameUser.id);
        const map={orvuno_coins_100:"coins_100",orvuno_coins_550:"coins_550",orvuno_coins_1200:"coins_1200",orvuno_coins_2600:"coins_2600",orvuno_coins_6000:"coins_6000",orvuno_coins_13000:"coins_13000",orvuno_coins_26000:"coins_26000",orvuno_coins_50000:"coins_50000",orvuno_premium_1m:"premium_1m",orvuno_premium_4w:"premium_4w",orvuno_premium_3m:"premium_3m",orvuno_premium_6m:"premium_6m",orvuno_premium_12m:"premium_12m"};
        const internalSku=map[amazonSku]||"";if(!amazonUserId||!receiptId||!amazonSku||!internalSku)throw httpError(400,"Amazon-Kaufdaten sind unvollstaendig oder das Produkt ist unbekannt");
        const product=(await client.query("select sku,kind from public.store_products where sku=$1 and active=true limit 1",[internalSku])).rows[0];if(!product||!["coins","premium"].includes(String(product.kind)))throw httpError(400,"Amazon-Produkt ist in ORVUNO nicht verfuegbar");
        const secret=amazonSecret();if(!secret)throw httpError(503,"Amazon RVS ist serverseitig noch nicht vollstaendig konfiguriert");
        const sandbox=(env("AMAZON_RVS_MODE")||"production").toLowerCase()==="sandbox",suffix=sandbox?"?testVerification=true":"";
        const verifyUrl="https://appstore-sdk.amazon.com/version/1.0/verifyReceiptId/developer/"+encodeURIComponent(secret)+"/user/"+encodeURIComponent(amazonUserId)+"/receiptId/"+encodeURIComponent(receiptId)+suffix;
        const r=await fetch(verifyUrl,{headers:{Accept:"application/json"}}),verified=await r.json().catch(()=>({}));
        if(r.status===410)throw httpError(409,"Amazon-Kauf wurde storniert oder ist nicht mehr gueltig");
        if(!r.ok)throw httpError(r.status===429?429:400,r.status===429?"Amazon-Pruefung ist ausgelastet":"Amazon-Kauf konnte nicht bestaetigt werden");
        if(String(verified?.receiptId||"")!==receiptId||String(verified?.productId||"")!==amazonSku)throw httpError(409,"Amazon-Beleg passt nicht zum angeforderten Produkt");
        if(verified?.cancelDate!==null&&verified?.cancelDate!==undefined)throw httpError(409,"Amazon-Kauf wurde storniert");
        if(!sandbox&&verified?.testTransaction===true)throw httpError(409,"Testkauf kann in der Live-Version nicht gutgeschrieben werden");
        const fr=await client.query("select public.fulfill_amazon_purchase($1,$2,$3,$4) as result",[userId,receiptId,internalSku,"paid"]);
        return{success:true,source:"hetzner",verified:true,provider:"amazon",receiptId,sku:internalSku,amazonSku,fulfillment:fr.rows[0].result};
      });
      res.json(out);
    }catch(e){jsonError(res,e);}
  });

  app.post("/api/orvuno/payments/stripe-webhook",async(req,res)=>{
    try{
      const secret=env("STRIPE_WEBHOOK_SECRET")||env("STRIPE_WEBHOOK_SIGNING_SECRET");if(!secret)throw httpError(503,"Stripe webhook is not configured");
      const raw=Buffer.isBuffer(req.rawBody)?req.rawBody.toString("utf8"):JSON.stringify(req.body||{});
      if(!verifyStripeSignature(raw,req.headers["stripe-signature"],secret))throw httpError(400,"Invalid Stripe signature");
      const event=JSON.parse(raw),cfg=stripeConfig(),eventId=String(event?.id||"");
      if(!eventId.startsWith("evt_")||event?.livemode!==cfg.live)throw httpError(400,"Stripe event environment mismatch");
      const type=String(event?.type||"");if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(type))return res.json({received:true,ignored:true});
      const eventSession=event?.data?.object,sessionId=String(eventSession?.id||"");if(eventSession?.object!=="checkout.session"||!sessionId.startsWith(cfg.sessionPrefix))throw httpError(400,"Invalid Stripe checkout event");
      const session=await retrieveStripeSession(sessionId);if(String(session.status||"")!=="complete"||String(session.payment_status||"")!=="paid")return res.json({received:true,pending:true});
      const userId=Number(session?.metadata?.user_id||0),refId=Number(session?.client_reference_id||0),sku=String(session?.metadata?.sku||""),amountCents=Number(session?.amount_total),currency=String(session?.currency||"").toUpperCase(),paymentIntent=typeof session?.payment_intent==="string"?session.payment_intent:"";
      if(!Number.isSafeInteger(userId)||userId<=0||userId!==refId||!sku||!Number.isInteger(amountCents)||amountCents<=0||currency!=="EUR"||!paymentIntent.startsWith("pi_"))throw httpError(400,"Stripe session metadata is invalid");
      const client=await pool.connect();try{
        const ir=await client.query("select * from public.payment_checkout_intents where provider='stripe' and provider_session_id=$1 and user_id=$2 limit 1",[sessionId,userId]),intent=ir.rows[0];
        if(!intent)throw httpError(400,"Unknown Stripe checkout intent");
        if(String(intent.sku)!==sku||Math.round(Number(intent.amount_eur)*100)!==amountCents||String(intent.currency).toUpperCase()!==currency)throw httpError(400,"Stripe session does not match stored checkout intent");
        const fr=await client.query("select public.fulfill_stripe_checkout_intent($1,$2,$3,$4,$5,$6) as result",[userId,sessionId,paymentIntent,amountCents/100,currency,"paid"]);
        res.json({received:true,fulfilled:true,transactionId:paymentIntent,result:fr.rows[0].result});
      }finally{client.release();}
    }catch(e){jsonError(res,e);}
  });
};
