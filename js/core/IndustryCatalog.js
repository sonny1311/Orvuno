// WorldProject - Branchenkatalog
// Bestimmt, welche Rohstoffe, Maschinen und Produkte ein Betrieb verwenden darf.

const profile=(branchKey,label,equipment,rooms=[{id:"production",name:"Arbeits-/Produktionsbereich",areaM2:170},{id:"storage",name:"Lager",areaM2:70},{id:"office",name:"Büro",areaM2:20}],allowedItems=[],products=[],recipes=[])=>({
    branchKey,label,starterBuilding:{name:`Leerer Betrieb – ${label}`,areaM2:rooms.reduce((s,r)=>s+r.areaM2,0),rooms},equipment,requiredEquipment:equipment.filter(x=>x.required!==false).map(x=>x.id),allowedItems,products,recipes
});

export const IndustryProfiles={
    "Brauerei":profile("brewery","Brauerei",[
        {id:"brew_kettle",name:"Sudwerk",price:14500,required:true,room:"production"},{id:"fermenter",name:"Gär-/Lagertank",price:9500,required:true,room:"production"},{id:"filling_line",name:"Abfüllanlage",price:12000,required:true,room:"production"},{id:"cold_storage",name:"Kühltechnik",price:6500,required:false,room:"storage"}
    ],[{id:"production",name:"Produktionshalle",areaM2:190},{id:"storage",name:"Lager",areaM2:80},{id:"office",name:"Büro",areaM2:30}],["malt","hops","yeast","water","bottles","bottles_050","caps","labels","labels_050"],["beer_pils_033","beer_lager_033","beer_pils_050","beer_lager_050"],["brew_pils","brew_lager","fill_pils_033","fill_lager_033","fill_pils_050","fill_lager_050"]),

    "Getränkehersteller":profile("beverage","Getränkehersteller",[
        {id:"mixing_tank",name:"Mischtank",price:10000,required:true,room:"production"},{id:"filling_line",name:"Abfüllanlage",price:12000,required:true,room:"production"},{id:"cold_storage",name:"Kühltechnik",price:6500,required:false,room:"storage"}
    ],undefined,["water","sugar","citric_acid","beverage_flavour","co2","bottles","caps","labels"],["softdrink_033"],["softdrink_basic"]),

    "Mineralbrunnen":profile("mineral_water","Mineralbrunnen",[
        {id:"water_treatment",name:"Wasseraufbereitung",price:15000,required:true,room:"production"},{id:"filling_line",name:"Abfüllanlage",price:12000,required:true,room:"production"}
    ],undefined,["water","bottles","caps","labels"],["mineral_water_033"],["mineral_water_033"]),

    "Schreinerei":profile("carpentry","Schreinerei",[
        {id:"panel_saw",name:"Formatkreissäge",price:9000,required:true,room:"workshop"},{id:"planer",name:"Abricht-/Dickenhobel",price:7500,required:true,room:"workshop"},{id:"workbench",name:"Werkbank",price:1800,required:true,room:"workshop"},{id:"dust_extractor",name:"Absauganlage",price:4200,required:true,room:"workshop"},{id:"edge_bander",name:"Kantenanleimmaschine",price:11000,required:false,room:"workshop"}
    ],[{id:"workshop",name:"Werkstatt",areaM2:170},{id:"wood_storage",name:"Holzlager",areaM2:70},{id:"office",name:"Büro",areaM2:20}],["softwood","hardwood","plywood","glue","screws","varnish","packaging"],["table_basic"],["table_basic"]),

    "Tischlerei":profile("joinery","Tischlerei",[
        {id:"panel_saw",name:"Formatkreissäge",price:9000,required:true,room:"workshop"},{id:"planer",name:"Abricht-/Dickenhobel",price:7500,required:true,room:"workshop"},{id:"workbench",name:"Werkbank",price:1800,required:true,room:"workshop"},{id:"edge_bander",name:"Kantenanleimmaschine",price:11000,required:true,room:"workshop"}
    ],[{id:"workshop",name:"Werkstatt",areaM2:180},{id:"wood_storage",name:"Holzlager",areaM2:80},{id:"office",name:"Büro",areaM2:20}],["softwood","hardwood","plywood","glue","screws","varnish","packaging"],["cabinet_joinery"],["cabinet_joinery"]),

    "Bäckerei":profile("bakery","Bäckerei",[
        {id:"bakery_oven",name:"Backofen",price:10500,required:true,room:"production"},{id:"dough_mixer",name:"Teigmaschine",price:5200,required:true,room:"production"},{id:"bakery_worktable",name:"Arbeitstisch",price:1600,required:true,room:"production"}
    ],undefined,["flour_wheat","baker_yeast","salt","butter","eggs","bakery_bag","water"],["bread_basic","roll_basic"],["bread_basic","roll_basic"]),
    "Metzgerei":profile("butcher","Metzgerei",[
        {id:"cold_room",name:"Kühlraum",price:9500,required:true,room:"storage"},{id:"meat_cutter",name:"Fleischkutter",price:7200,required:true,room:"production"},{id:"butcher_table",name:"Edelstahl-Arbeitstisch",price:1900,required:true,room:"production"}
    ],undefined,["pork","beef","spice_mix","sausage_casing","meat_packaging"],["sausage_basic"],["sausage_basic"]),
    "Lebensmittelhersteller":profile("food","Lebensmittelhersteller",[
        {id:"food_mixer",name:"Produktionsmischer",price:9500,required:true,room:"production"},{id:"food_packaging",name:"Verpackungsanlage",price:11500,required:true,room:"production"}
    ],undefined,["food_base","food_spice","food_pack"],["food_product_basic"],["food_product_basic"]),
    "Landwirtschaftsbetrieb":profile("farm","Landwirtschaft / Ackerbau",[
        {id:"tractor",name:"Traktor",price:18000,required:true,room:"yard"},{id:"cultivator",name:"Bodenbearbeitungsgerät",price:8500,required:true,room:"yard"},{id:"seeder",name:"Sämaschine",price:10500,required:true,room:"yard"},{id:"combine_harvester",name:"Mähdrescher",price:42000,required:false,room:"yard"},{id:"farm_storage",name:"Landwirtschaftliches Lager",price:6500,required:true,room:"storage"},{id:"grain_silo",name:"Getreidesilo",price:12500,required:false,room:"storage"}
    ],[{id:"yard",name:"Betriebshof",areaM2:250},{id:"fields",name:"Ackerflächen",areaM2:1000},{id:"storage",name:"Lager/Scheune",areaM2:180},{id:"office",name:"Büro",areaM2:20}],
    ["seed_wheat","seed_barley","seed_corn","seed_rapeseed","seed_potato","fertilizer","diesel"],
    ["wheat","barley","corn","rapeseed","potatoes","straw"],
    ["grow_wheat","grow_barley","grow_corn","grow_rapeseed","grow_potatoes"]),
    "Tierhaltung":profile("livestock","Tierhaltung",[
        {id:"animal_barn",name:"Stalleinrichtung",price:14000,required:true,room:"production"},{id:"feed_storage",name:"Futterlager",price:6000,required:true,room:"storage"}
    ],undefined,["animal_feed","straw","water","livestock_medicine"],["milk","cattle","pigs","eggs_product"],["milk_cycle","egg_cycle","raise_cattle","raise_pigs"]),
    "Obstbau":profile("orchard","Obstbau",[
        {id:"orchard_tractor",name:"Schmalspurtraktor",price:16000,required:true,room:"yard"},{id:"fruit_storage",name:"Obstlager",price:7500,required:true,room:"storage"}
    ],[{id:"yard",name:"Betriebshof",areaM2:220},{id:"storage",name:"Obstlager",areaM2:120},{id:"office",name:"Büro",areaM2:20}],["orchard_fertilizer","diesel","fruit_crate"],["apples"],["grow_apples"]),
    "Maschinenbau":profile("mechanical","Maschinenbau",[
        {id:"cnc_mill",name:"CNC-Fräse",price:19000,required:true,room:"production"},{id:"assembly_station",name:"Montageplatz",price:5500,required:true,room:"production"},{id:"workshop_crane",name:"Werkstattkran",price:4800,required:true,room:"production"}
    ],undefined,["steel_sheet","steel_bar","welding_wire","machine_parts"],["machine_component"],["machine_component"]),
    "Metallverarbeitung":profile("metal","Metallverarbeitung",[
        {id:"metal_saw",name:"Metallbandsäge",price:7500,required:true,room:"production"},{id:"welder",name:"Schweißplatz",price:5800,required:true,room:"production"},{id:"press_brake",name:"Abkantpresse",price:13500,required:true,room:"production"}
    ],undefined,["steel_sheet","steel_bar","welding_wire"],["metal_frame"],["metal_frame"]),
    "Kunststoffverarbeitung":profile("plastic","Kunststoffverarbeitung",[
        {id:"injection_machine",name:"Spritzgießmaschine",price:20000,required:true,room:"production"},{id:"material_dryer",name:"Granulattrockner",price:5200,required:true,room:"production"}
    ],undefined,["plastic_granulate","plastic_pack"],["plastic_part"],["plastic_part"]),
    "Einzelhandel":profile("retail","Einzelhandel",[
        {id:"shop_shelves",name:"Ladeneinrichtung",price:6500,required:true,room:"sales"},{id:"pos_system",name:"Kassensystem",price:2200,required:true,room:"sales"}
    ],[{id:"sales",name:"Verkaufsfläche",areaM2:140},{id:"storage",name:"Warenlager",areaM2:80},{id:"office",name:"Büro",areaM2:20}],["retail_goods"],["retail_sale"],["retail_sale"]),
    "Großhandel":profile("wholesale","Großhandel",[
        {id:"warehouse_racks",name:"Palettenregale",price:9000,required:true,room:"storage"},{id:"forklift",name:"Gabelstapler",price:12000,required:true,room:"storage"}
    ],[{id:"storage",name:"Großlager",areaM2:300},{id:"office",name:"Büro",areaM2:30}],["wholesale_goods"],["wholesale_order"],["wholesale_order"]),
    "Onlinehandel":profile("online_retail","Onlinehandel",[
        {id:"packing_stations",name:"Packplätze",price:4200,required:true,room:"production"},{id:"warehouse_racks",name:"Lagerregale",price:6500,required:true,room:"storage"},{id:"shop_it",name:"Shop-/IT-Arbeitsplatz",price:2800,required:true,room:"office"}
    ],undefined,["online_goods","shipping_box","shipping_label"],["online_order"],["online_order"])
};

export const IndustryGroups={
    "Getränke":["Brauerei","Getränkehersteller","Mineralbrunnen"],
    "Lebensmittel":["Bäckerei","Metzgerei","Lebensmittelhersteller"],
    "Landwirtschaft":["Landwirtschaftsbetrieb","Tierhaltung","Obstbau"],
    "Industrie":["Maschinenbau","Metallverarbeitung","Kunststoffverarbeitung"],
    "Handwerk":["Schreinerei","Tischlerei"],
    "Handel":["Einzelhandel","Großhandel","Onlinehandel"]
};

const FALLBACK=profile("generic","Betrieb",[{id:"basic_workstation",name:"Grundausstattung",price:5000,required:true,room:"production"}]);
export function getIndustryProfile(companyOrType){const type=typeof companyOrType==="string"?companyOrType:companyOrType?.type||companyOrType?.company_type;return IndustryProfiles[type]||{...FALLBACK,label:type||"Betrieb"};}
export function createStarterBuilding(companyOrType){const p=getIndustryProfile(companyOrType),base=p.starterBuilding;return{kind:"starter_shell",name:base.name,areaM2:base.areaM2,rooms:(base.rooms||[]).map(r=>({...r,equipment:[]})),equipment:[],ready:false};}
export function allowedItem(company,itemId){return(getIndustryProfile(company).allowedItems||[]).includes(itemId);}
export function equipmentFor(company){return[...(getIndustryProfile(company).equipment||[])];}
export function requiredEquipmentFor(company){return[...(getIndustryProfile(company).requiredEquipment||[])];}
export function setupProgress(company){const required=requiredEquipmentFor(company),owned=(company?.buildingState?.equipment||company?.building_state?.equipment||[]).map(x=>typeof x==="string"?x:x.id),missing=required.filter(id=>!owned.includes(id));return{required,owned,missing,complete:required.length>0&&missing.length===0,percent:required.length?Math.round((required.length-missing.length)/required.length*100):0};}
