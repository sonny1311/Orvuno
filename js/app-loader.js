// ORVUNO - fast pre-auth loader.
// CrazyGames uses a cooperative loader: no giant static bootstrap graph on the critical path.
import { AuthApiClient } from './core/AuthApiClient.js';
import { GameAccessGate } from './core/GameAccessGate.js';

const params=new URLSearchParams(location.search);
const crazyGames=params.get('source')==='crazygames'||params.get('crazygames')==='1'||params.get('platform')==='crazygames';
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));

async function loadCrazyGamesRuntime(){
  // Features are intentionally imported one by one with yields. This keeps Edge/Silk/Chromium
  // responsive instead of evaluating 100+ modules in one uninterrupted task.
  const modules=[
    './core/GermanTechnicalErrorIntegration.js',
    './core/PlayerFacingBrandNeutralizerIntegration.js',
    './core/HelpQuestionMarkClickFixIntegration.js',
    './core/HelpOverlayFrontFixIntegration.js',
    './core/GlobalDarkThemeIntegration.js',
    './core/DarkMainNavigationIntegration.js',
    './core/DarkCommandCenterHeaderIntegration.js',
    './core/HomeOperationsDashboardIntegration.js',
    './core/HomeDeliveryCoinShortcutIntegration.js',
    './core/HomeWarehouseAndPartialDeliveryIntegration.js',
    './core/CustomerOrderProductIdCompatibilityIntegration.js',
    './core/CustomerOrderRuntimeHydrationIntegration.js',
    './core/HomeDashboardViewportIntegration.js',
    './core/OrvunoCommandCenterLayoutIntegration.js',
    './core/GlobalWheelScrollIntegration.js',
    './core/CompanyEconomyIntegration.js',
    './core/WarehouseSpaceIntegration.js',
    './core/LegacyEconomyWarehouseSpaceBridge.js',
    './core/UnifiedOperationalStockBridge.js',
    './core/WarehousePackDisplayIntegration.js',
    './core/OperationalSupplyChainEquipmentIntegration.js',
    './core/OperationalWarehouseVisualFixIntegration.js',
    './core/MachineConditionProductionGuard.js',
    './core/MachineMaintenanceSystem.js',
    './core/MachineConditionVisibilityIntegration.js',
    './core/MachineMaintenanceUIIntegration.js',
    './core/ReputationSystem.js',
    './core/UrgentCustomerOrderSystem.js',
    './core/ReputationCustomerOrderIntegration.js',
    './core/CustomerFreightEconomySystem.js',
    './core/CustomerFreightDeliveryIntegration.js',
    './core/CustomerOrderFreightPreviewIntegration.js',
    './core/CustomerOrderProfitabilityIntegration.js',
    './core/UniversalOperationsDialog.js',
    './core/UniversalWarehouseOverviewUIIntegration.js',
    './core/LandConstructionExpansionUIIntegration.js',
    './core/BusinessPremisesOverviewIntegration.js',
    './core/WarehouseExpansionUIIntegration.js',
    './core/WarehouseExpansionUsabilityFixIntegration.js',
    './core/ConstructionRuntimeCompletionIntegration.js',
    './core/EconomyDashboardSetupIntegration.js',
    './core/ConnectedEconomyGameplay.js',
    './core/AutomaticSupplierDeliveryCompletionIntegration.js',
    './core/DeliveryOverviewUIIntegration.js',
    './core/CustomerOrderPricingIntegration.js',
    './core/ProductionProgressIntegration.js',
    './core/ProductionStockCreditRecoveryIntegration.js',
    './core/BottlingSizeSelectionIntegration.js',
    './core/OperationalProductionVisualCleanupIntegration.js',
    './core/ProductionStatusBannerIntegration.js',
    './core/MachineStaffingOverviewIntegration.js',
    './core/MachineStaffingHireLinkIntegration.js',
    './core/WorkforceMachineAssignmentIntegration.js',
    './core/WorkforceAssignmentStatusIntegration.js',
    './core/ProductionReadinessChecklistView.js',
    './core/DashboardSummaryNavigationIntegration.js',
    './core/DashboardFinishedGoodsSummaryIntegration.js',
    './core/DashboardMainNavigationIntegration.js',
    './core/OperationalDialogSectionPersistenceIntegration.js',
    './core/OperationalDialogCloseGuardIntegration.js',
    './core/MachinePurchaseTabIntegration.js',
    './core/WarehouseClearanceSaleIntegration.js',
    './core/CommercialFulfillmentGameplayBridge.js',
    './core/DashboardUsabilityIntegration.js',
    './core/DashboardQuickActionsIntegration.js',
    './core/DashboardPriorityHintsIntegration.js',
    './core/DashboardFinanceLedgerIntegration.js',
    './core/LongDialogUsabilityIntegration.js',
    './core/WarehouseSpaceRuntimeGuard.js',
    './core/OperationalConsistencyGuard.js',
    './core/GameActionFeedbackIntegration.js',
    './core/OperationalAttentionFeedbackIntegration.js',
    './core/GameActionFeedbackBridge.js',
    './core/GameSaveStatusIntegration.js',
    './core/ActiveOperationsOverviewUI.js',
    './core/GameResumeRefreshIntegration.js',
    './core/GameRuntimeErrorBoundary.js'
  ];
  for(const path of modules){
    try{await import(path);}catch(error){console.warn('CrazyGames Modul übersprungen',path,error);}
    await yieldFrame();
  }
  window.dispatchEvent(new CustomEvent('orvuno:full-runtime-ready'));
  window.worldHomeOperationsDashboard?.render?.();
}

async function start(){
  if(crazyGames)await import('./core/CrazyGamesBasicLaunchIntegration.js');

  const api=new AuthApiClient();
  // CompanySetup/main only require the canonical API immediately. Heavy account systems are
  // deliberately excluded from CrazyGames startup.
  window.worldAccounts={...(window.worldAccounts||{}),authApi:api};
  const gate=new GameAccessGate({api});
  window.worldAccounts.gameAccessGate=gate;
  await gate.ensureAccess();
  window.orvunoAccessPrechecked=true;

  if(crazyGames){
    await import('./main.js');
    window.orvunoBootComplete=true;
    window.dispatchEvent(new CustomEvent('orvuno:boot-complete'));
    // First paint and company screen are available before the rest is hydrated.
    setTimeout(()=>loadCrazyGamesRuntime(),50);
    return;
  }

  await import('./bootstrap.js');
}

start().catch(error=>{
  console.error('ORVUNO VORSTART FEHLGESCHLAGEN',error);
  window.orvunoShowBootError?.(error?.message||String(error));
});
