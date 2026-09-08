// WorldProject - Aufgaben/Missionen mit Teillieferungen und skalierter Schwierigkeit
import { worldContentRegistry } from "./ContentRegistry.js";
import { getIndustryProfile } from "./IndustryCatalog.js";

const BRANCH_MISSION_TITLES={
    brewery:"Brauerei-Auftrag", beverage:"Getränkeauftrag", mineral_water:"Mineralwasser-Auftrag",
    carpentry:"Schreinerei-Auftrag", joinery:"Tischlerei-Auftrag", farm:"Landwirtschaftsauftrag",
    livestock:"Tierhaltungsauftrag", orchard:"Obstbau-Auftrag", bakery:"Bäckerei-Auftrag",
    butcher:"Metzgerei-Auftrag", food:"Lebensmittelauftrag", mechanical:"Maschinenbau-Auftrag",
    metal:"Metallauftrag", plastic:"Kunststoffauftrag", retail:"Einzelhandelsauftrag",
    wholesale:"Großhandelsauftrag", online_retail:"Onlinehandelsauftrag", forestry:"Forstauftrag",
    sawmill:"Sägewerksauftrag", mill:"Mühlenauftrag", maltster:"Mälzerei-Auftrag", hops_farm:"Hopfenbau-Auftrag",
    sugar_factory:"Zuckerfabrik-Auftrag", feed_mill:"Futtermühlenauftrag", dairy:"Molkerei-Auftrag",
    slaughterhouse:"Schlachthof-Auftrag", glassworks:"Glaswerk-Auftrag", closures:"Verschluss-Auftrag",
    paper_mill:"Papierfabrik-Auftrag", label_print:"Druckauftrag", packaging_maker:"Verpackungsauftrag",
    steelworks:"Stahlwerksauftrag", polymer:"Kunststoffrohstoff-Auftrag", food_chemicals:"Lebensmittelchemie-Auftrag",
    agri_chemicals:"Agrarchemie-Auftrag"
};

export class MissionSystem {
    ensureCompany(company) {
        company.missions ??= [];
        company.completedMissions ??= [];
        company.coins ??= 0;
        company.money ??= 0;
        return company;
    }

    resolveBranchKey(company) {
        const direct=company?.branchKey||company?.branch_key;
        if(direct) return direct;
        return getIndustryProfile(company)?.branchKey||null;
    }

    getBranchMissionCandidates(company) {
        const branchKey=this.resolveBranchKey(company);
        if(!branchKey) return [];
        const products=new Map(worldContentRegistry.list("products").map(p=>[p.id,p]));
        const recipes=worldContentRegistry.list("recipes",{filter:r=>(r.industries||[]).includes(branchKey)&&!r.deprecated&&r.product});
        const recipeCandidates=recipes
            .map(r=>({recipe:r,product:products.get(r.product)||null}))
            .filter(x=>x.product?.sellable!==false)
            .map(x=>({
                branchKey,
                productId:x.recipe.product,
                productName:x.product?.label||x.recipe.label||x.recipe.product,
                title:x.recipe.label||BRANCH_MISSION_TITLES[branchKey]||"Betriebsauftrag"
            }));
        if(recipeCandidates.length) return recipeCandidates;
        return worldContentRegistry.list("products",{filter:p=>(p.industries||[]).includes(branchKey)&&p.sellable!==false}).map(p=>({
            branchKey,
            productId:p.id,
            productName:p.label||p.id,
            title:BRANCH_MISSION_TITLES[branchKey]||"Betriebsauftrag"
        }));
    }

    chooseBranchMission(company) {
        const candidates=this.getBranchMissionCandidates(company);
        if(!candidates.length) return null;
        const completed=this.ensureCompany(company).completedMissions.length;
        return candidates[completed % candidates.length];
    }

    estimateCompanyScale(company) {
        const vehicles = Array.isArray(company?.vehicles) ? company.vehicles.length : 0;
        const productionCapacity = Number(company?.production?.capacity) || 0;
        const money = Number(company?.money) || 0;
        const score = vehicles * 2 + productionCapacity / 1000 + money / 50000;
        if (score < 3) return "small";
        if (score < 10) return "medium";
        return "large";
    }

    createDeliveryMission(company, options = {}) {
        this.ensureCompany(company);
        const scale = this.estimateCompanyScale(company);
        const defaults = scale === "small"
            ? { targetAmount:1500, money:250, coins:0, boosterMinutes:20 }
            : scale === "medium"
                ? { targetAmount:15000, money:700, coins:1, boosterMinutes:45 }
                : { targetAmount:75000, money:1800, coins:2, boosterMinutes:60 };
        const branchMission=this.chooseBranchMission(company);
        const productId=options.productId??branchMission?.productId;
        const productName=options.productName??branchMission?.productName;
        if(!productId||!productName) throw new Error(`Keine branchenspezifische Mission für ${this.resolveBranchKey(company)||"unbekannten Betriebszweig"} verfügbar`);

        const mission = {
            id: Date.now() + Math.random(),
            type: "delivery",
            branchKey:this.resolveBranchKey(company),
            title: options.title ?? branchMission?.title ?? "Betriebsauftrag",
            productId,
            productName,
            targetAmount: Math.max(Number(options.targetAmount ?? defaults.targetAmount) || 0, 1),
            deliveredAmount: 0,
            status: "active",
            createdAt: new Date(),
            reward: {
                money: Number(options.moneyReward ?? defaults.money) || 0,
                coins: Number(options.coinReward ?? defaults.coins) || 0,
                boosterMinutes: Number(options.boosterMinutes ?? defaults.boosterMinutes) || 0
            },
            companyScale: scale
        };
        company.missions.push(mission);
        return mission;
    }

    getActiveMission(company) {
        this.ensureCompany(company);
        return company.missions.find(m => m.status === "active") ?? null;
    }

    deliver(company, missionId, amount) {
        this.ensureCompany(company);
        const mission = company.missions.find(m => m.id === missionId);
        if (!mission || mission.status !== "active") return { success:false, reason:"Aufgabe nicht aktiv" };
        const remaining = Math.max(mission.targetAmount - mission.deliveredAmount, 0);
        const accepted = Math.min(Math.max(Number(amount) || 0, 0), remaining);
        if (accepted <= 0) return { success:false, reason:"Keine lieferbare Menge" };
        mission.deliveredAmount += accepted;
        mission.progressPercent = mission.deliveredAmount / mission.targetAmount * 100;

        if (mission.deliveredAmount >= mission.targetAmount) {
            mission.status = "completed";
            mission.completedAt = new Date();
            company.money += mission.reward.money;
            company.coins += mission.reward.coins;
            company.activeBoosterMinutes = (Number(company.activeBoosterMinutes) || 0) + mission.reward.boosterMinutes;
            company.completedMissions.push(mission);
        }
        return { success:true, accepted, mission, completed:mission.status === "completed" };
    }

    createNextMission(company) {
        const current = this.getActiveMission(company);
        if (current) return current;
        const completed = this.ensureCompany(company).completedMissions.length;
        const factor = 1 + Math.min(completed * 0.08, 1.5);
        const branchMission=this.chooseBranchMission(company);
        if(!branchMission) throw new Error(`Keine branchenspezifische Mission für ${this.resolveBranchKey(company)||"unbekannten Betriebszweig"} verfügbar`);
        const base = this.createDeliveryMission(company,branchMission);
        base.targetAmount = Math.round(base.targetAmount * factor);
        base.reward.money = Math.round(base.reward.money * (1 + Math.min(completed * 0.04, 0.75)));
        return base;
    }
}

export function runMissionSystemTest() {
    const company = { type:"Einzelhandel", branchKey:"retail", money:50000, coins:0, vehicles:[{}], production:{capacity:1000} };
    const system = new MissionSystem();
    const mission = system.createDeliveryMission(company,{productId:"retail_sale",productName:"Einzelhandelsverkauf",targetAmount:15000,moneyReward:300,coinReward:1,boosterMinutes:60});
    const first = system.deliver(company,mission.id,500);
    const second = system.deliver(company,mission.id,14500);
    const success = first.success && mission.deliveredAmount === 15000 && second.completed && company.coins === 1 && company.money === 50300 && mission.productId!=="lager033_bottle";
    console[success ? "log" : "error"](
        success ? "✅ MISSIONS-TEST ERFOLGREICH" : "❌ MISSIONS-TEST FEHLGESCHLAGEN",
        { mission, company }
    );
    return { success, mission };
}
