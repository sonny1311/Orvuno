// WorldProject - verbindet UI, Lieferanten, Fuhrpark, Produktion, Kunden und Betriebsaufbau
import { EconomyGameplaySystem } from "./EconomyGameplaySystem.js";
import { FleetManagementSystem } from "./FleetManagementSystem.js";
import { FleetOperatingCostSystem, runFleetOperatingCostTest } from "./FleetOperatingCostSystem.js";
import { SupplierMarketSystem, runSupplierMarketTest } from "./SupplierMarketSystem.js";
import { MissionSystem, runMissionSystemTest } from "./MissionSystem.js";
import { BeverageRecipeCatalog, runBeverageRecipeTest } from "./BeverageRecipeCatalog.js";
import { EconomyDashboard } from "./EconomyDashboard.js";
import { AdvancedEconomySystem, CoinStoreCatalog, runAdvancedEconomyTest } from "./AdvancedEconomySystem.js";
import { BusinessSetupSystem, runBusinessSetupTest } from "./BusinessSetupSystem.js";
import { allowedItem, getIndustryProfile } from "./IndustryCatalog.js";
import { runMicroLocalOrderTest } from "./MicroLocalOrderIntegration.js";
import { ensureAllIndustryMicroLocalOrders, runAllIndustryMicroOrderRegression } from "./AllIndustryMicroOrderIntegration.js";

export class ConnectedEconomyGameplay {
    constructor(){this.economy=new EconomyGameplaySystem();this.advanced=new AdvancedEconomySystem();this.setup=new BusinessSetupSystem();this.fleet=new FleetManagementSystem();this.fleetCosts=new FleetOperatingCostSystem();this.market=new SupplierMarketSystem();this.missions=new MissionSystem();this.salePrice=0.95;}

    ensureCompany(company){
        company.money??=0;company.coins??=0;company.vehicles??=[];company.inventory??={};company.finishedGoods??={};company.production??={capacity:1000,active:false};company.missions??=[];company.completedMissions??=[];
        this.advanced.ensureCompany(company);
        if(company.setupPhase)this.setup.ensure(company);
        if(!company.salesPrices.lager033_bottle)company.salesPrices.lager033_bottle=this.salePrice;
        return company;
    }

    getSetupState(company){this.ensureCompany(company);return this.setup.getState(company);}
    buySetupEquipment(company,equipmentId){this.ensureCompany(company);return this.setup.buyEquipment(company,equipmentId);}
    startBusinessOperations(company){this.ensureCompany(company);return this.setup.startOperations(company);}
    getIndustryProfile(company){return getIndustryProfile(company);}
    buyVehicle(company,type,price=0){this.ensureCompany(company);return this.fleet.buyVehicle(company,type,{price});}

    getSupplierComparison(companyOrItem,itemOrAmount,maybeAmount){
        if(typeof companyOrItem==="string")return this.advanced.getSupplierComparison(this.market,companyOrItem,itemOrAmount,null);
        return this.advanced.getSupplierComparison(this.market,itemOrAmount,maybeAmount,companyOrItem);
    }

    buyInput(company,itemId,amount,{transportMode="auto",offerId=null}={}){
        this.ensureCompany(company);
        if(company.setupPhase && !["ready","operating"].includes(company.setupPhase))return{success:false,reason:"Richte zuerst den Betrieb ein"};
        if(company.setupPhase && !allowedItem(company,itemId))return{success:false,reason:"Dieser Rohstoff gehört nicht zu deinem Gewerbe"};
        let offer;
        if(offerId){const comparison=this.getSupplierComparison(company,itemId,amount);offer=comparison.find(x=>x.id===offerId)||null;}
        else offer=this.market.getBestOffer(itemId,amount,company);
        if(!offer)return{success:false,reason:"Kein passendes Lieferangebot"};
        const reserve=this.market.reserveOffer(offer.id,offer.orderAmount??amount);if(!reserve.success)return reserve;
        const selection=this.advanced.chooseTransport(company,offer,amount),chosenMode=transportMode==="auto"?selection.mode:transportMode,vehicle=chosenMode==="own"?selection.vehicle:null;
        const transportCost=chosenMode==="own"?Math.max(offer.distanceKm*0.25,10):(offer.estimatedTransportCost??offer.transportCost??this.market.estimateTransportCost(offer,offer.orderAmount??amount));
        const materialCost=offer.materialCost??(offer.effectiveUnitPrice??offer.unitPrice)*(offer.orderAmount??amount),total=materialCost+transportCost;
        const delivery=this.advanced.createSupplierDelivery(company,offer,offer.orderAmount??amount,total,{transportMode:chosenMode,vehicle});
        if(!delivery.success){const raw=this.market.offers.find(x=>x.id===offer.id);if(raw)raw.availableAmount+=(offer.orderAmount??amount);return delivery;}
        return{success:true,offer,order:delivery.order,transportMode:chosenMode,vehicle,transportCost,totalCost:total,delivered:false};
    }

    buyRecipeInputs(company,recipeId,batches=1,{supplierSelections={}}={}){
        this.ensureCompany(company);const recipe=BeverageRecipeCatalog[recipeId];if(!recipe)return{success:false,reason:"Rezept unbekannt"};
        const profile=getIndustryProfile(company);if(profile.recipes?.length&&!profile.recipes.includes(recipeId))return{success:false,reason:"Dieses Rezept gehört nicht zu deinem Gewerbe"};
        const ordered=[];let materialCost=0,transportCost=0;
        for(const[itemId,perBatch]of Object.entries(recipe.inputs)){const needed=perBatch*batches,have=Number(company.inventory?.[itemId])||0,incoming=(company.supplierOrders||[]).filter(o=>o.itemId===itemId&&!["delivered","cancelled"].includes(o.status)).reduce((s,o)=>s+(Number(o.amount)||0),0),missing=Math.max(needed-have-incoming,0);if(missing<=0)continue;const result=this.buyInput(company,itemId,missing,{offerId:supplierSelections[itemId]||null});if(!result.success)return{success:false,reason:`Einkauf ${itemId} fehlgeschlagen: ${result.reason}`,ordered};materialCost+=result.offer.materialCost??0;transportCost+=result.transportCost;ordered.push({itemId,amount:missing,...result});}
        return{success:true,ordered,materialCost,transportCost,message:"Bestellungen aufgegeben - Ware wird erst nach Ankunft eingelagert."};
    }

    processTime(company,now=new Date()){this.ensureCompany(company);const deliveries=this.advanced.processSupplierDeliveries(company,now),productions=this.advanced.processProduction(company,now);for(const v of company.vehicles)this.advanced.updateVehicleStatus(v);return{deliveries,productions};}
    fastForward(company,hours=24){return this.processTime(company,new Date(Date.now()+Math.max(Number(hours)||0,0)*3600000));}

    produce(company,recipeId,batches=1){
        this.ensureCompany(company);const recipe=BeverageRecipeCatalog[recipeId];if(!recipe)return{success:false,reason:"Rezept unbekannt"};const started=this.advanced.startProduction(company,recipeId,batches);
        if(started.success){const comparisons={};let materials=0,transport=0;for(const[itemId,amount]of Object.entries(recipe.inputs||{})){const best=this.getSupplierComparison(company,itemId,amount*batches)[0];if(best){comparisons[itemId]=best;materials+=best.materialCost;transport+=best.transportCost;}}const detailed=this.advanced.calculateDetailedProductionCost({recipeId,batches,supplierComparisonByItem:comparisons,transportCost:transport});this.advanced.registerProductCost(company,recipeId,batches,detailed.ingredients,detailed.transportCost,detailed.energy+detailed.staff+detailed.machineWear);started.costs=detailed;}
        return started;
    }

    queueProduction(company,recipeId,batches=1){return this.advanced.queueProduction(company,recipeId,batches);}
    startNextQueued(company){return this.advanced.startNextQueued(company);}
    upgradeMachine(company,machineId="line1"){return this.advanced.upgradeMachine(company,machineId);}
    getStorageStatus(company){this.ensureCompany(company);return this.advanced.getStorageStatus(company);}
    getStorageAreas(company){this.ensureCompany(company);return this.advanced.getStorageAreas(company);}
    expandStorage(company){return this.advanced.expandStorage(company,10000,5000);}
    setSalePrice(company,price,productId="lager033_bottle"){this.ensureCompany(company);this.salePrice=Math.max(Number(price)||0,0);return this.advanced.setSalePrice(company,productId,this.salePrice);}
    getDemand(company,productId="lager033_bottle"){this.ensureCompany(company);return this.advanced.demandAtPrice(productId,company.salesPrices[productId]??this.salePrice);}
    getCompetitors(productId="lager033_bottle"){return this.advanced.getCompetitorMarket(productId);}
    getMargin(company,productId="lager033_bottle",price=null){this.ensureCompany(company);const p=price??company.salesPrices[productId]??this.salePrice;return this.advanced.getMargin(company,productId,p);}
    createCustomerOrder(company,options={}){this.ensureCompany(company);return this.advanced.createCustomerOrder(company,options);}
    deliverCustomerOrder(company,orderId,amount){return this.advanced.deliverCustomerOrder(company,orderId,amount);}

    ensureCustomerOrders(company){
        this.ensureCompany(company);
        if(company.setupPhase&&company.setupPhase!=="operating")return[];
        if(company.microBusiness?.stage==="micro")return ensureAllIndustryMicroLocalOrders(this,company,{targetOpen:2});
        const profile=getIndustryProfile(company),open=company.customerOrders.filter(x=>x.status==="open");
        if(profile.branchKey!=="brewery")return open;
        const regional=[
            {customer:"REWE Regional",amount:1000,unitPrice:0.98,dueHours:72},
            {customer:"Getränkemarkt West",amount:1500,unitPrice:1.02,dueHours:96}
        ];
        for(const template of regional){
            if(company.customerOrders.filter(x=>x.status==="open").length>=2)break;
            const duplicate=company.customerOrders.some(x=>x.status==="open"&&x.customer===template.customer);
            if(!duplicate)this.createCustomerOrder(company,template);
        }
        return company.customerOrders.filter(x=>x.status==="open");
    }

    ensureMission(company){if(company.setupPhase&&company.setupPhase!=="operating")return null;return this.missions.getActiveMission(company)??this.missions.createNextMission(company);}
    deliverMission(company,amount){this.ensureCompany(company);this.processTime(company,new Date());const mission=this.ensureMission(company);if(!mission)return{success:false,reason:"Betrieb noch nicht eröffnet"};const available=Number(company.finishedGoods?.[mission.productId])||0,deliverable=Math.min(Math.max(Number(amount)||0,0),available);if(deliverable<=0)return{success:false,reason:"Keine passende Fertigware im Lager"};const result=this.missions.deliver(company,mission.id,deliverable);if(result.success){company.finishedGoods[mission.productId]-=result.accepted;const price=company.salesPrices[mission.productId]??this.salePrice,revenue=result.accepted*price;company.money+=revenue;this.advanced.record(company,"mission_sale",revenue,{missionId:mission.id,qty:result.accepted});result.salesRevenue=revenue;result.margin=this.getMargin(company,mission.productId,price);if(result.completed){this.advanced.rewardMilestone(company,"mission_completed",1);this.missions.createNextMission(company);}}return result;}

    applyTripCosts(company,vehicle,distanceKm){const result=this.fleetCosts.calculateTrip(vehicle,distanceKm);if(result.success){company.money-=result.totalOperatingCost;this.advanced.record(company,"fleet_trip",-result.totalOperatingCost,{vehicleId:vehicle?.id,distanceKm});this.advanced.updateVehicleStatus(vehicle);}return result;}
    serviceVehicle(company,vehicle){return this.advanced.serviceVehicle(company,vehicle,1200);}
    getReport(company,hours=168){return this.advanced.createReport(company,hours);}
    spendCoins(company,amount,reason){return this.advanced.spendCoins(company,amount,reason);}
    getCoinStoreCatalog(){return CoinStoreCatalog;}

    openDashboard(company){this.ensureCompany(company);this.processTime(company,new Date());if(!company.setupPhase||company.setupPhase==="operating"){this.ensureMission(company);this.ensureCustomerOrders(company);}const dashboard=new EconomyDashboard({controller:this,company});dashboard.open();return dashboard;}
}

function createDemoCompany(){return{name:"WorldProject Testbrauerei",type:"Brauerei",money:200000,coins:0,vehicles:[],inventory:{},finishedGoods:{},production:{capacity:1000,active:false},missions:[],completedMissions:[]};}
export function runConnectedEconomyGameplayTest(){const game=new ConnectedEconomyGameplay(),company=createDemoCompany();game.ensureCompany(company);const vehicle=game.buyVehicle(company,"truck18",35000),supplies=game.buyRecipeInputs(company,"lager033",1);game.fastForward(company,24);const production=game.produce(company,"lager033",1);game.fastForward(company,48);const mission=game.ensureMission(company);if(!mission)return{success:false,company,reason:"Keine Testmission verfügbar"};mission.targetAmount=1000;const first=game.deliverMission(company,500),second=game.deliverMission(company,500),trip=vehicle.success?game.applyTripCosts(company,vehicle.vehicle,200):{success:false};const customer=game.createCustomerOrder(company,{amount:100,unitPrice:1.05});company.finishedGoods.lager033_bottle=(company.finishedGoods.lager033_bottle||0)+100;const orderId=customer?.order?.id;const customerDelivery=orderId!=null?game.deliverCustomerOrder(company,orderId,100):{success:false,reason:"Test-Kundenauftrag wurde nicht erzeugt"},report=game.getReport(company,999999);const success=vehicle.success&&supplies.success&&production.success&&first.success&&second.success&&second.completed&&trip.success&&customerDelivery.success&&report.income>0&&company.coins>=1;console[success?"log":"error"](success?"✅ VERBUNDENER-WIRTSCHAFTS-TEST ERFOLGREICH":"❌ VERBUNDENER-WIRTSCHAFTS-TEST FEHLGESCHLAGEN",{company,vehicle,supplies,production,first,second,trip,customerDelivery,report});return{success,company};}

// Integrations-/Regressionstests duerfen NIEMALS beim normalen Spieler-Start laufen.
// Sie erzeugen Demo-Daten, koennen absichtlich fehlschlagen und hatten auf Fire/Silk den
// kompletten ORVUNO-Start mit "Cannot read properties of undefined (reading 'id')" beendet.
// Tests sind nur noch explizit per ?orvuno_dev_tests=1 aktivierbar.
const runBrowserDevTests=()=>{
    try{
        const params=new URLSearchParams(location.search);
        if(params.get("orvuno_dev_tests")!=="1")return;
        runBeverageRecipeTest();runSupplierMarketTest();runFleetOperatingCostTest();runMissionSystemTest();runAdvancedEconomyTest();runBusinessSetupTest();runMicroLocalOrderTest();runAllIndustryMicroOrderRegression();runConnectedEconomyGameplayTest();
    }catch(error){console.error("ORVUNO DEV-TESTS FEHLGESCHLAGEN",error);}
};
runBrowserDevTests();

const visibleGame=new ConnectedEconomyGameplay(),fallbackCompany=createDemoCompany();visibleGame.ensureMission(fallbackCompany);window.worldEconomyGameplay={game:visibleGame,company:fallbackCompany};
function getCurrentCompany(){return window.worldPlayerCompany||fallbackCompany;}
function mountEconomyButton(){if(document.getElementById("world-economy-button"))return;const button=document.createElement("button");button.id="world-economy-button";button.textContent="🏭 Wirtschaft";Object.assign(button.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"11000",border:"0",borderRadius:"10px",padding:"12px 16px",fontWeight:"800",cursor:"pointer",boxShadow:"0 5px 18px rgba(0,0,0,.35)"});button.addEventListener("click",()=>{const company=getCurrentCompany();window.worldEconomyGameplay.company=company;visibleGame.openDashboard(company);});document.body.append(button);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mountEconomyButton);else mountEconomyButton();