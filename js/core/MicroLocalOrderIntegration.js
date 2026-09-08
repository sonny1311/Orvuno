// WorldProject – verbindet Mikro-Unternehmensstart und lokale Kundenaufträge mit dem aktiven Betrieb.
import { microStarterProfile, starterOrderScale, ensureMicroBusiness } from './MicroBusinessStarterSystem.js';
import { getIndustryProfile } from './IndustryCatalog.js';
import { chooseCustomerOrderProduct } from './CustomerOrderVarietyIntegration.js';
import { worldContentRegistry } from './ContentRegistry.js';

const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const now = () => window.worldTime?.now?.() || Date.now();

function branchKeyFor(company) {
  const profile = getIndustryProfile(company) || {};
  return String(company?.branchKey || profile.branchKey || '').trim();
}

function allowedProducts(company) {
  const profile = getIndustryProfile(company) || {};
  const branchKey = branchKeyFor(company);
  const ids = new Set((profile.products || []).filter(Boolean));

  if (branchKey) {
    for (const product of worldContentRegistry.list('products', {
      filter: p => p?.sellable !== false && Array.isArray(p?.industries) && p.industries.includes(branchKey)
    })) {
      if (product?.id) ids.add(product.id);
    }
  }

  // Alte Brauerei-Fallbacks dürfen niemals in fremde Gewerbe durchsickern.
  if (branchKey !== 'brewery') {
    ids.delete('lager033_bottle');
    ids.delete('pils033_bottle');
    ids.delete('weizen033_bottle');
  }
  return ids;
}

function productLabel(productId) {
  return worldContentRegistry.get('products', productId)?.label || productId;
}

function productCandidates(company) {
  const allowed = allowedProducts(company);
  if (!allowed.size) return [];
  const ids = [];
  const push = id => {
    if (id && id !== 'undefined' && allowed.has(id) && !ids.includes(id)) ids.push(id);
  };

  // Zuerst tatsächlich vorhandene/benutzte Ware, aber ausschließlich aus dem eigenen Gewerbe.
  for (const o of [...(company.completedCustomerOrders || []), ...(company.customerOrders || [])].reverse()) {
    push(o?.productId || o?.product);
  }
  for (const [id, value] of Object.entries(company.operationalSupplyState?.warehouseStock?.finished || {})) {
    if (num(value) > 0) push(id);
  }
  for (const [id, value] of Object.entries(company.finishedGoods || {})) {
    if (num(value) > 0) push(id);
  }
  for (const id of Object.keys(company.salesPrices || {})) push(id);
  for (const id of allowed) push(id);
  return ids;
}

function chooseProduct(company, index = 0) {
  const allowed = allowedProducts(company);
  const preferred = chooseCustomerOrderProduct(company, index)?.productId;
  if (preferred && allowed.has(preferred)) return preferred;
  const candidates = productCandidates(company);
  return candidates.length ? candidates[Math.abs(Number(index) || 0) % candidates.length] : null;
}

function priceFor(company, productId) {
  return Math.max(.01, num(company.salesPrices?.[productId], num(company.productPrices?.[productId], 1)));
}

function createLegacyOrder(company, opts) {
  if (typeof company.createCustomerOrder === 'function') return company.createCustomerOrder(opts);

  const order = {
    id: `micro-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'open',
    createdAt: now(),
    customer: opts.customer,
    customerName: opts.customer?.name || 'Lokaler Kunde',
    productId: opts.productId,
    product: opts.productId,
    productLabel: productLabel(opts.productId),
    amount: opts.amount,
    quantity: opts.amount,
    unitPrice: opts.unitPrice,
    total: opts.amount * opts.unitPrice,
    dueAt: now() + opts.dueHours * 3600000,
    source: 'micro_local'
  };

  company.customerOrders = Array.isArray(company.customerOrders) ? company.customerOrders : [];
  company.customerOrders.push(order);
  return order;
}

function cancelForeignOpenOrders(company) {
  const allowed = allowedProducts(company);
  if (!allowed.size) return 0;
  let cancelled = 0;
  for (const order of company.customerOrders || []) {
    if (!order || order.status !== 'open') continue;
    const productId = order.productId || order.product;
    if (!productId || allowed.has(productId)) continue;
    // Nur automatisch erzeugte/alte lokale Aufträge bereinigen. Echte historische Aufträge bleiben erhalten.
    if (order.source && order.source !== 'micro_local' && !order.microStarter) continue;
    order.status = 'cancelled';
    order.cancelReason = 'branch_mismatch';
    order.cancelledAt = now();
    cancelled++;
  }
  return cancelled;
}

export function ensureMicroLocalOrders(game, company, { targetOpen = 4 } = {}) {
  if (!company) return [];

  ensureMicroBusiness(company, now());
  const profile = microStarterProfile(company);
  company.customerOrders = Array.isArray(company.customerOrders) ? company.customerOrders : [];
  cancelForeignOpenOrders(company);
  const open = company.customerOrders.filter(o => o?.status === 'open');

  let guard = 0;
  while (open.length < targetOpen && guard < Math.max(8, targetOpen * 3)) {
    const completedStarterOrders = num(company.microBusiness?.completedStarterOrders, 0);
    const sequence = completedStarterOrders + open.length + guard;
    const productId = chooseProduct(company, sequence);
    if (!productId) break;

    const scale = starterOrderScale(company);
    const maxQuantity = Math.max(1, num(scale.maxQuantity, 100));
    const amount = Math.max(1, Math.round(maxQuantity * (.35 + Math.random() * .45)));
    const unitPrice = priceFor(company, productId);
    const customerTypes = Array.isArray(profile.customers) && profile.customers.length ? profile.customers : ['Lokaler Kunde'];
    const customerType = customerTypes[sequence % customerTypes.length];
    const industryKey = String(profile.type || company.type || company.company_type || 'business').toLowerCase().replace(/\s+/g, '-');
    const customer = {
      id: `local-${industryKey}-${sequence}`,
      name: `${customerType} ${sequence + 1}`,
      type: 'local_micro',
      starter: true
    };
    const baseDueHours = scale.tier === 1 ? 24 : scale.tier === 2 ? 48 : 72;
    const options = {
      customer,
      productId,
      productLabel: productLabel(productId),
      amount,
      unitPrice,
      dueHours: Math.max(2, Math.round(baseDueHours * (.8 + Math.random() * .4)))
    };

    let order = null;
    try {
      order = game?.customerOrderLifecycle?.createCustomerOrder?.(company, options) || createLegacyOrder(company, options);
    } catch (error) {
      console.warn('Lokaler Mikroauftrag konnte nicht über Lifecycle erzeugt werden', error);
      order = createLegacyOrder(company, options);
    }

    if (order) {
      order.source = order.source || 'micro_local';
      order.microStarter = true;
      order.productLabel = order.productLabel || productLabel(productId);
      open.push(order);
    }
    guard++;
  }
  return open;
}

export function runMicroLocalOrderTest() {
  const company = {
    type: 'Brauerei',
    branchKey: 'brewery',
    customerOrders: [],
    completedCustomerOrders: [],
    salesPrices: {
      lager033_bottle: 0.95,
      pils033_bottle: 0.99
    },
    unlockedRecipes: ['lager033']
  };

  const orders = ensureMicroLocalOrders(null, company, { targetOpen: 2 });
  const products = orders.map(order => order.productId || order.product).filter(Boolean);

  const foreignCompany = {
    type: 'Mühle',
    branchKey: 'mill',
    customerOrders: [{id:'bad-old-order',status:'open',source:'micro_local',productId:'lager033_bottle',product:'lager033_bottle'}],
    completedCustomerOrders: [],
    salesPrices: { lager033_bottle: 0.95 }
  };
  const foreignOrders = ensureMicroLocalOrders(null, foreignCompany, { targetOpen: 2 });
  const branchSafe = foreignOrders.every(order => !['lager033_bottle','pils033_bottle','weizen033_bottle'].includes(order.productId || order.product))
    && foreignCompany.customerOrders.find(o => o.id === 'bad-old-order')?.status === 'cancelled';

  const success = orders.length === 2 && new Set(products).size >= 1 && orders.every(order =>
    Number.isFinite(Number(order.amount)) && Number(order.amount) > 0 &&
    Number.isFinite(Number(order.dueAt)) && Number(order.dueAt) > Number(order.createdAt)
  ) && branchSafe;

  console[success ? 'log' : 'error'](
    success ? '✅ MIKRO-KUNDENAUFTRAGS-TEST ERFOLGREICH' : '❌ MIKRO-KUNDENAUFTRAGS-TEST FEHLGESCHLAGEN',
    { orders, products, foreignOrders, branchSafe }
  );
  return { success, orders, products, foreignOrders, branchSafe };
}

export function installMicroLocalOrders({ targetOpen = 4 } = {}) {
  if (typeof window === 'undefined') return false;

  const run = () => {
    const company = window.worldPlayerCompany;
    const game = window.worldEngine;
    if (!company) return;
    try {
      ensureMicroLocalOrders(game, company, { targetOpen });
    } catch (error) {
      console.warn('Mikro-Kundenaufträge konnten nicht vorbereitet werden', error);
    }
  };

  for (const event of [
    'worldproject:company-founded',
    'worldproject:company-loaded',
    'worldproject:company-switched',
    'worldproject:company-activated',
    'world:customer-order-completed'
  ]) {
    window.addEventListener(event, () => setTimeout(run, 40));
  }

  setTimeout(run, 120);
  return true;
}

if (typeof window !== 'undefined') {
  window.worldMicroLocalOrders = {
    ensure: ensureMicroLocalOrders,
    install: installMicroLocalOrders,
    test: runMicroLocalOrderTest
  };
  installMicroLocalOrders();
}
