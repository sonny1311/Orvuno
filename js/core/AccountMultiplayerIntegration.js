// WorldProject - Account-/Multiplayer-Integration
// Production runtime only. Development/regression tests must never run in the player startup path.
import "../content/GameContentData.js";
import "../content/WorkforceContentData.js";
import "../content/MarketAndFleetContentData.js";
import "./IndustryExtensionRegistry.js";
import { AccountSystem } from "./AccountSystem.js";
import { CoinMarketplaceSystem } from "./CoinMarketplaceSystem.js";
import { GuildSystem } from "./GuildSystem.js";
import { AntiAbuseRiskSystem } from "./AntiAbuseRiskSystem.js";
import { AuthApiClient } from "./AuthApiClient.js";
import { GameAccessGate } from "./GameAccessGate.js";
import { AccountProfileDialog } from "./AccountProfileDialog.js";
import { SupabaseGameStateSync } from "./SupabaseGameStateSync.js";
import { runSupabaseSecurityTest } from "./SupabaseSecurityTest.js";
import { BusinessPortfolioSystem } from "./BusinessPortfolioSystem.js";
import { BusinessPortfolioDialog } from "./BusinessPortfolioDialog.js";
import { OperationalSupplyChainDialog } from "./OperationalSupplyChainDialog.js";
import { WorkforceOperationsDialog } from "./WorkforceOperationsDialog.js";
import { MarketFleetDialog } from "./MarketFleetDialog.js";
import { TempAgencySystem } from "./TempAgencyAndFleetUpgradeSystem.js";
import { EmployeeAbsenceSystem } from "./EmployeeAbsenceSystem.js";
import { PersistentFleetSystem } from "./PersistentFleetSystem.js";
import { FleetDispatcherSystem } from "./FleetDispatcherSystem.js";
import { OperationsDashboardSystem } from "./OperationsDashboardSystem.js";
import { QualityEconomySystem } from "./QualityEconomySystem.js";
import { BusinessUpgradeSystem } from "./BusinessUpgradeSystem.js";
import { MachineOperationsSystem } from "./MachineOperationsSystem.js";
import { ProductionQualitySystem } from "./ProductionQualitySystem.js";
import { EmployeeWorkAssignmentSystem } from "./EmployeeWorkAssignmentSystem.js";
import { QualitySalesSystem } from "./QualitySalesSystem.js";
import { BusinessReputationSystem } from "./BusinessReputationSystem.js";
import { SupplierRelationshipSystem } from "./SupplierRelationshipSystem.js";
import { SupplierComparisonSystem } from "./SupplierComparisonSystem.js";
import { PlayerMarketplaceSystem } from "./PlayerMarketplaceSystem.js";
import { CoinExchangeSystem } from "./CoinExchangeSystem.js";
import { NpcMarketLiquiditySystem, DefaultNpcMarketCompanies } from "./NpcMarketLiquiditySystem.js";
import { SupplyContractSystem } from "./SupplyContractSystem.js";
import { DemandAndOrderSystem } from "./DemandAndOrderSystem.js";
import { GoodsCirculationSystem } from "./GoodsCirculationSystem.js";
import { DailyBusinessCashflowSystem } from "./DailyBusinessCashflowSystem.js";
import { CapacityPressureSystem } from "./CapacityPressureSystem.js";
import { PremiumEntitlementSystem } from "./PremiumEntitlementSystem.js";
import { PremiumStatusDialog } from "./PremiumStatusDialog.js";
import { PremiumLifecycleCoordinator } from "./PremiumLifecycleCoordinator.js";
import { PremiumInventoryAutomationSystem } from "./PremiumInventoryAutomationSystem.js";
import { ConstructionQueueSystem } from "./ConstructionQueueSystem.js";
import { PremiumProductionQueueSystem } from "./PremiumProductionQueueSystem.js";
import { worldContentRegistry } from "./ContentRegistry.js";

export const accountSystem=new AccountSystem(),
 coinMarketplace=new CoinMarketplaceSystem(),
 guildSystem=new GuildSystem(),
 antiAbuseRiskSystem=new AntiAbuseRiskSystem(),
 authApi=new AuthApiClient(),
 gameAccessGate=new GameAccessGate({accountSystem,api:authApi}),
 accountProfileDialog=new AccountProfileDialog({api:authApi}),
 gameStateSync=new SupabaseGameStateSync({api:authApi}),
 businessPortfolio=new BusinessPortfolioSystem({api:authApi}),
 businessPortfolioDialog=new BusinessPortfolioDialog({portfolio:businessPortfolio}),
 operationalSupplyChainDialog=new OperationalSupplyChainDialog(),
 workforceOperationsDialog=new WorkforceOperationsDialog(),
 marketFleetDialog=new MarketFleetDialog(),
 premiumEntitlements=new PremiumEntitlementSystem(),
 constructionQueue=new ConstructionQueueSystem({premium:premiumEntitlements}),
 premiumProductionQueue=new PremiumProductionQueueSystem({premium:premiumEntitlements}),
 premiumInventoryAutomation=new PremiumInventoryAutomationSystem({premium:premiumEntitlements,contentRegistry:worldContentRegistry}),
 tempAgency=new TempAgencySystem(),
 employeeAbsences=new EmployeeAbsenceSystem({tempAgency}),
 persistentFleet=new PersistentFleetSystem(),
 fleetDispatcher=new FleetDispatcherSystem({fleet:persistentFleet}),
 qualityEconomy=new QualityEconomySystem(),
 businessUpgrades=new BusinessUpgradeSystem(),
 machineOperations=new MachineOperationsSystem(),
 productionQuality=new ProductionQualitySystem(),
 employeeWorkAssignments=new EmployeeWorkAssignmentSystem(),
 qualitySales=new QualitySalesSystem(),
 businessReputation=new BusinessReputationSystem(),
 supplierRelationships=new SupplierRelationshipSystem(),
 supplierComparison=new SupplierComparisonSystem(),
 npcMarketLiquidity=new NpcMarketLiquiditySystem({npcCompanies:DefaultNpcMarketCompanies}),
 playerMarketplace=new PlayerMarketplaceSystem({marketFeeRate:.005,npcLiquidity:npcMarketLiquidity}),
 coinExchange=new CoinExchangeSystem(),
 supplyContracts=new SupplyContractSystem(),
 demandOrders=new DemandAndOrderSystem(),
 goodsCirculation=new GoodsCirculationSystem(),
 dailyCashflow=new DailyBusinessCashflowSystem(),
 capacityPressure=new CapacityPressureSystem(),
 operationsDashboard=new OperationsDashboardSystem({constructionQueue,productionQueue:premiumProductionQueue,inventoryAutomation:premiumInventoryAutomation,employeeAbsences,fleet:persistentFleet,dispatcher:fleetDispatcher}),
 premiumStatusDialog=new PremiumStatusDialog({premium:premiumEntitlements,constructionQueue,productionQueue:premiumProductionQueue}),
 premiumLifecycle=new PremiumLifecycleCoordinator({premium:premiumEntitlements,constructionQueue,productionQueue:premiumProductionQueue,getAccount:()=>window.worldCurrentUser||{}});

window.worldAccounts={accountSystem,coinMarketplace,guildSystem,antiAbuseRiskSystem,authApi,gameAccessGate,accountProfileDialog,gameStateSync,businessPortfolio,businessPortfolioDialog,operationalSupplyChainDialog,workforceOperationsDialog,marketFleetDialog,premiumEntitlements,premiumStatusDialog,premiumLifecycle,premiumInventoryAutomation,constructionQueue,premiumProductionQueue,tempAgency,employeeAbsences,persistentFleet,fleetDispatcher,operationsDashboard,qualityEconomy,businessUpgrades,machineOperations,productionQuality,employeeWorkAssignments,qualitySales,businessReputation,supplierRelationships,supplierComparison,playerMarketplace,coinExchange,supplyContracts,demandOrders,goodsCirculation,dailyCashflow,capacityPressure,contentRegistry:worldContentRegistry,runSupabaseSecurityTest:()=>runSupabaseSecurityTest(authApi)};

function mainNav(){let nav=document.getElementById("world-main-nav");if(nav)return nav;nav=document.createElement("div");nav.id="world-main-nav";Object.assign(nav.style,{position:"fixed",left:"18px",right:"18px",bottom:"18px",zIndex:"11000",display:"flex",flexWrap:"wrap",alignItems:"center",gap:"10px",pointerEvents:"none",maxWidth:"calc(100vw - 36px)"});document.body.append(nav);return nav;}
function button(id,text,left,fn){if(document.getElementById(id))return document.getElementById(id);const b=document.createElement("button");b.type='button';b.id=id;b.textContent=text;Object.assign(b.style,{position:"static",flex:"0 0 auto",whiteSpace:"nowrap",border:"0",borderRadius:"10px",padding:"12px 16px",fontWeight:"800",cursor:"pointer",boxShadow:"0 5px 18px rgba(0,0,0,.35)",pointerEvents:"auto"});b.onclick=e=>{e.preventDefault();e.stopPropagation();fn(e);};mainNav().append(b);return b;}
function mount(){const a=button("world-account-button","👤 Account","18px",async()=>{const u=window.worldCurrentUser;if(u){try{await accountProfileDialog.open();}catch(e){alert(`Profil konnte nicht geöffnet werden: ${e.message}`);}}else gameAccessGate.openRequiredLogin();}),refresh=async()=>{if(a)a.textContent=window.worldCurrentUser?`👤 ${window.worldCurrentUser.username}`:"👤 Account";if(window.worldCurrentUser)try{await premiumLifecycle.refreshAccount(authApi);}catch(e){console.warn("Premiumstatus konnte nicht aktualisiert werden",e);}};window.addEventListener("world:user-login",refresh);window.addEventListener("world:access-granted",refresh);refresh();button("world-businesses-button","🏢 Betriebe","150px",()=>businessPortfolioDialog.open().catch(e=>alert(e.message)));button("world-operations-button","📦 Betrieb","270px",()=>operationalSupplyChainDialog.open().catch(e=>alert(e.message)));button("world-workforce-button","👷 Personal","382px",()=>workforceOperationsDialog.open().catch(e=>alert(e.message)));button("world-market-fleet-button","💶 Markt & Fuhrpark","500px",()=>marketFleetDialog.open().catch(e=>alert(e.message)));button("world-premium-button","⭐ Premium & Coins","650px",()=>{const open=window.worldPremiumPlanUI?.open;if(typeof open==='function')open();else window.dispatchEvent(new CustomEvent('world:open-premium'));});premiumLifecycle.start();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();

// Expensive regression/integration tests are explicitly opt-in only.
// Use ?orvuno_dev_tests=1 during development; players never execute them.
if(new URLSearchParams(location.search).get('orvuno_dev_tests')==='1'){
  import('./CoreRegressionSuite.js').catch(error=>console.error('ORVUNO dev tests failed to load',error));
}
