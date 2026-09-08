// ============================================
// main.js
// ORVUNO – eine einzige kanonische Betriebsruntime
// ============================================

import "./content/ContentBootstrap.js";
import "./core/CanonicalIndustryGoodsIntegration.js";
import "./core/OperationalInventoryBridge.js";
import "./core/CurrencyPresentationBridge.js";
import "./core/SharedBusinessFinanceUIIntegration.js";
import "./core/CoinStoreVisualPolishIntegration.js";
import { Company } from "./core/Company.js";
import { CompanySetup } from "./core/CompanySetup.js";

window.orvunoBootComplete = true;
window.dispatchEvent(new CustomEvent("orvuno:boot-complete"));

const runtimeCompany = new Company();
const portfolio = window.worldAccounts?.businessPortfolio;
const initialOverview = window.worldServerAccountOverview || null;
const initialCompanies = Array.isArray(initialOverview?.companies) ? initialOverview.companies.filter(Boolean) : [];
const initialServerCompany = initialCompanies.find(c => c?.is_primary)
    || initialCompanies.find(c => Number(c?.slot_no) === 1)
    || initialCompanies[0]
    || null;

window.worldCanonicalRuntimeCompany = runtimeCompany;

function companies() {
    const rows = Array.isArray(window.worldServerAccountOverview?.companies)
        ? window.worldServerAccountOverview.companies
        : initialCompanies;
    return rows.filter(Boolean);
}

function serverCompanyFor(value = null) {
    const id = value?.serverCompanyId ?? value?.id ?? window.worldActiveServerCompany?.id ?? null;
    if (id != null) {
        const found = companies().find(c => String(c?.id) === String(id));
        if (found) return found;
    }
    return window.worldActiveServerCompany || initialServerCompany || companies()[0] || null;
}

// Das Live-Firmenkonto besitzt genau einen Runtime-Wert. Historische Module duerfen
// weiterhin normale Einnahmen/Ausgaben buchen, aber ein veralteter 0-EUR-Fallback darf
// einen positiven, serverseitig bestaetigten Kontostand niemals mehr vernichten.
let runtimeMoney = Number(runtimeCompany.money);
if (!Number.isFinite(runtimeMoney)) runtimeMoney = 0;
Object.defineProperty(runtimeCompany, "money", {
    configurable: false,
    enumerable: true,
    get() {
        return runtimeMoney;
    },
    set(nextValue) {
        const parsed = Number(nextValue);
        const next = Number.isFinite(parsed) ? parsed : 0;
        const server = serverCompanyFor(runtimeCompany);
        const serverMoney = Number(server?.money ?? server?.game_state?.money);
        const sameCompany = !server?.id
            || !runtimeCompany.serverCompanyId
            || String(server.id) === String(runtimeCompany.serverCompanyId);

        if (next === 0 && runtimeMoney > 0 && sameCompany && Number.isFinite(serverMoney) && serverMoney > 0) {
            console.error("🚨 ORVUNO: VERALTETER 0-EUR-KONTORESET BLOCKIERT", {
                companyId: runtimeCompany.serverCompanyId,
                previous: runtimeMoney,
                serverMoney,
                stack: new Error("ORVUNO stale zero money reset").stack
            });
            return;
        }

        runtimeMoney = next;
    }
});

function hydrateCanonical(serverCompany) {
    if (!serverCompany || typeof serverCompany !== "object") return runtimeCompany;
    const wallet = window.worldServerAccountOverview?.wallet || initialOverview?.wallet || {};

    if (portfolio?.hydrateCompany) {
        portfolio.hydrateCompany(runtimeCompany, serverCompany, wallet);
    } else {
        const state = serverCompany.game_state || {};
        runtimeCompany.serverCompanyId = serverCompany.id ?? null;
        runtimeCompany.slotNo = Number(serverCompany.slot_no || 1);
        runtimeCompany.name = serverCompany.name || "";
        runtimeCompany.industry = serverCompany.industry || "";
        runtimeCompany.type = serverCompany.company_type || "";
        runtimeCompany.money = Number(serverCompany.money ?? state.money ?? 0);
        runtimeCompany.moneyRevision = Number(serverCompany.money_revision ?? state.moneyRevision ?? 0);
        runtimeCompany.coins = Number(wallet?.balance || 0);
        runtimeCompany.setupPhase = serverCompany.setup_phase || runtimeCompany.setupPhase;
        runtimeCompany.buildingState = serverCompany.building_state || runtimeCompany.buildingState;
    }

    const serverMoney = Number(serverCompany.money ?? serverCompany.game_state?.money);
    if (Number.isFinite(serverMoney)) runtimeCompany.money = serverMoney;
    runtimeCompany.moneyRevision = Number(
        serverCompany.money_revision
        ?? serverCompany.game_state?.moneyRevision
        ?? runtimeCompany.moneyRevision
        ?? 0
    );

    window.worldActiveServerCompany = serverCompany;
    return runtimeCompany;
}

// worldPlayerCompany ist ab jetzt KEINE frei austauschbare globale Referenz mehr.
// Jeder Leser bekommt immer dieselbe runtimeCompany. Ein Altmodul darf zwar versuchen,
// eine andere Firma zu setzen; dann wird lediglich deren echte Server-ID in DIESE Instanz
// hydriert. Dadurch koennen Demo-/Fallback-Objekte nie wieder Dashboard oder Kaufpruefungen
// uebernehmen.
Object.defineProperty(window, "worldPlayerCompany", {
    configurable: false,
    enumerable: true,
    get() {
        return runtimeCompany;
    },
    set(next) {
        if (!next || next === runtimeCompany) return;
        const id = next?.serverCompanyId ?? next?.id ?? null;
        if (id == null) {
            console.warn("🛡️ ORVUNO: FALLBACK-COMPANY VERWORFEN", { money: Number(next?.money) });
            return;
        }
        const server = companies().find(c => String(c?.id) === String(id));
        if (!server) {
            console.warn("🛡️ ORVUNO: UNBEKANNTE COMPANY VERWORFEN", { companyId: id, money: Number(next?.money) });
            return;
        }
        hydrateCanonical(server);
    }
});

function bindCanonical(serverCompany = null) {
    const server = serverCompany || serverCompanyFor(runtimeCompany);
    if (server) hydrateCanonical(server);

    if (!window.worldEngine) window.worldEngine = { legacyRendererDisabled: true };
    window.worldEngine.company = runtimeCompany;
    if (window.worldEconomyGameplay) window.worldEconomyGameplay.company = runtimeCompany;
    if (portfolio) portfolio.activeCompany = runtimeCompany;
    return runtimeCompany;
}

window.worldGetCanonicalCompany = () => {
    const server = serverCompanyFor(runtimeCompany);
    if (server) {
        const serverMoney = Number(server.money ?? server.game_state?.money);
        if (String(runtimeCompany.serverCompanyId ?? "") !== String(server?.id ?? "")) {
            hydrateCanonical(server);
        } else if (Number(runtimeCompany.money) === 0 && Number.isFinite(serverMoney) && serverMoney > 0) {
            runtimeCompany.money = serverMoney;
            runtimeCompany.moneyRevision = Number(server.money_revision ?? server.game_state?.moneyRevision ?? runtimeCompany.moneyRevision ?? 0);
        }
    }
    return runtimeCompany;
};

if (initialServerCompany) bindCanonical(initialServerCompany);
else bindCanonical();

for (const eventName of [
    "worldproject:company-loaded",
    "worldproject:company-activated",
    "worldproject:company-switched",
    "world:active-business-changed"
]) {
    window.addEventListener(eventName, event => {
        const requested = event?.detail?.serverCompany || serverCompanyFor(event?.detail?.company);
        bindCanonical(requested);
        window.worldHomeOperationsDashboard?.render?.();
    });
}

const companySetup = new CompanySetup(runtimeCompany, company => {
    const server = serverCompanyFor(company);
    bindCanonical(server);
    console.log("ORVUNO Betrieb geladen:", runtimeCompany);
    window.dispatchEvent(new CustomEvent("worldproject:company-activated", {
        detail: { company: runtimeCompany, serverCompany: server }
    }));
    window.worldHomeOperationsDashboard?.render?.();
});

companySetup.show();

for (const delay of [0, 100, 300, 750, 1500, 3000, 5000, 8000, 12000, 15000, 20000, 30000]) {
    setTimeout(() => {
        const server = serverCompanyFor(runtimeCompany);
        if (server) {
            const serverMoney = Number(server.money ?? server.game_state?.money);
            if (Number(runtimeCompany.money) === 0 && Number.isFinite(serverMoney) && serverMoney > 0) {
                runtimeCompany.money = serverMoney;
                runtimeCompany.moneyRevision = Number(server.money_revision ?? server.game_state?.moneyRevision ?? runtimeCompany.moneyRevision ?? 0);
            }
        }
        if (window.worldEngine) window.worldEngine.company = runtimeCompany;
        if (window.worldEconomyGameplay) window.worldEconomyGameplay.company = runtimeCompany;
        if (portfolio) portfolio.activeCompany = runtimeCompany;
        window.worldHomeOperationsDashboard?.render?.();
    }, delay);
}
