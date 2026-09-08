// WorldProject - Premiumplan und zentrale Entitlements.
// Aktuell gibt es bewusst nur eine Premium-Stufe.
export const PremiumPlans=Object.freeze({
 premium_basic:{id:'premium_basic',label:'Premium',priceEuro:4.99,durationDays:30,dailyCoins:0}
});
export const PremiumConfig={
 planId:'premium_basic',label:'Premium',benefits:{
  concurrentConstruction:{standard:3,premium:5,label:'Parallele Bauauftraege'},
  storageMultiplier:{standard:1,premium:1.20,label:'Lagerkapazitaet'},
  timeMultiplier:{standard:1,premium:.75,label:'Alle zeitbasierten Vorgaenge 25 % schneller'},
  productionQueue:{standard:0,premium:3,label:'Produktionswarteschlange'},
  automationSlots:{standard:0,premium:3,label:'Automatisierungs-Slots'},
  recipeTemplates:{standard:2,premium:12,label:'Rezeptvorlagen'},
  vehicleAssignments:{standard:2,premium:10,label:'Gespeicherte Fahrzeugzuweisungen'},
  priceAlerts:{standard:0,premium:10,label:'Preisalarme'},
  profileDesignSlots:{standard:1,premium:6,label:'Profil-/Gestaltungs-Slots'},
  automaticReorder:{standard:false,premium:true,label:'Automatische Mindestbestaende/Nachbestellung'},
  advancedAnalytics:{standard:false,premium:true,label:'Erweiterte Unternehmensauswertungen'},
  guidedSetupNavigation:{standard:false,premium:true,label:'Direkte Hilfe zu fehlenden Voraussetzungen'},
  automaticStaffAssignment:{standard:false,premium:true,label:'Automatische Personalzuweisung'},
  smartDeliveryQuantity:{standard:false,premium:true,label:'Intelligenter Liefermengenvorschlag'}
 }};
const planOf=account=>PremiumPlans[account?.premiumPlan||account?.premium_plan]||PremiumPlans.premium_basic;
const premiumUntilMs=account=>{const raw=account?.premiumUntil??account?.premium_until??0;if(raw instanceof Date){const t=raw.getTime();return Number.isFinite(t)?t:0;}const direct=Number(raw);if(Number.isFinite(direct)&&direct>0)return direct;if(typeof raw==='string'&&raw.trim()){const parsed=Date.parse(raw);if(Number.isFinite(parsed))return parsed;}return 0;};
export class PremiumEntitlementSystem{
 constructor(config=PremiumConfig){this.config=config;}
 state(account={},now=Date.now()){const until=premiumUntilMs(account),active=until>Number(now),plan=planOf(account);return{active,status:active?'active':(until?'expired':'none'),until,planId:plan.id,plan,dailyCoins:0};}
 benefit(account,key,now=Date.now()){const cfg=this.config.benefits[key];if(!cfg)throw new Error(`Unbekannter Premiumvorteil: ${key}`);return this.state(account,now).active?cfg.premium:cfg.standard;}
 activate(account,{until,planId='premium_basic'}={}){const value=until instanceof Date?until.getTime():(Number(until)||Date.parse(until||'')),plan=PremiumPlans[planId];if(!plan)throw new Error('Unbekannter Premiumplan');if(!Number.isFinite(value)||value<=Date.now())throw new Error('Premium-Enddatum muss in der Zukunft liegen');account.premiumUntil=value;account.premiumPlan=plan.id;return this.state(account);}
 deactivate(account){account.premiumUntil=0;return this.state(account);}
 constructionLimit(account,now=Date.now()){return Number(this.benefit(account,'concurrentConstruction',now));}
 productionQueueLimit(account,now=Date.now()){return Number(this.benefit(account,'productionQueue',now));}
 storageCapacity(account,baseCapacity,now=Date.now()){return Math.floor(Number(baseCapacity||0)*Number(this.benefit(account,'storageMultiplier',now)));}
 timeMultiplier(account,now=Date.now()){return Number(this.benefit(account,'timeMultiplier',now));}
 operationDurationMs(account,baseDurationMs,now=Date.now()){return Math.max(0,Math.round(Number(baseDurationMs||0)*this.timeMultiplier(account,now)));}
 operationDurationMinutes(account,baseMinutes,now=Date.now()){return Math.max(0,Number(baseMinutes||0)*this.timeMultiplier(account,now));}
 operationDurationHours(account,baseHours,now=Date.now()){return Math.max(0,Number(baseHours||0)*this.timeMultiplier(account,now));}
 limit(account,key,now=Date.now()){return Number(this.benefit(account,key,now));}
 canStartConstruction(account,runningCount,now=Date.now()){return Number(runningCount||0)<this.constructionLimit(account,now);}
 canQueueProduction(account,queuedCount,now=Date.now()){return Number(queuedCount||0)<this.productionQueueLimit(account,now);}
 canUseGuidedSetupNavigation(account,now=Date.now()){return Boolean(this.benefit(account,'guidedSetupNavigation',now));}
 canUseAutomaticStaffAssignment(account,now=Date.now()){return Boolean(this.benefit(account,'automaticStaffAssignment',now));}
 canUseSmartDeliveryQuantity(account,now=Date.now()){return Boolean(this.benefit(account,'smartDeliveryQuantity',now));}
 overCapacityState(account,{baseStorage=0,currentStored=0,runningConstruction=0,queuedProduction=0,now=Date.now()}={}){const storage=this.storageCapacity(account,baseStorage,now),constructionLimit=this.constructionLimit(account,now),queueLimit=this.productionQueueLimit(account,now);return{storageCapacity:storage,storageOverfilled:Number(currentStored)>storage,constructionLimit,constructionOverLimit:Number(runningConstruction)>constructionLimit,productionQueueLimit:queueLimit,productionQueueOverLimit:Number(queuedProduction)>queueLimit};}
 listBenefits(account,now=Date.now()){const active=this.state(account,now).active;return Object.entries(this.config.benefits).map(([id,cfg])=>({id,label:cfg.label,value:active?cfg.premium:cfg.standard,premiumValue:cfg.premium,standardValue:cfg.standard,active}));}
}
export function runPremiumEntitlementTest(){const now=1000000,p=new PremiumEntitlementSystem(),a={premiumUntil:new Date(now+86400000).toISOString(),premiumPlan:'premium_basic'};if(p.constructionLimit(a,now)!==5||p.productionQueueLimit(a,now)!==3||p.storageCapacity(a,10000,now)!==12000||p.timeMultiplier(a,now)!==.75||p.operationDurationMs(a,3600000,now)!==2700000||p.limit(a,'automationSlots',now)!==3||p.state(a,now).dailyCoins!==0)throw new Error('Premiumvorteile fehlerhaft');a.premiumUntil=new Date(now-1).toISOString();const expired=p.overCapacityState(a,{baseStorage:10000,currentStored:11500,runningConstruction:5,queuedProduction:3,now});if(!expired.storageOverfilled||!expired.constructionOverLimit||!expired.productionQueueOverLimit||p.storageCapacity(a,10000,now)!==10000||p.timeMultiplier(a,now)!==1)throw new Error('Premium-Ablauflogik fehlerhaft');return true;}
