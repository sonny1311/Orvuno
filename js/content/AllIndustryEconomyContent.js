// WorldProject – zusätzliche Wirtschaftsinhalte für ALLE angebotenen Gewerbe.
import { registerWorldContent } from "../core/ContentRegistry.js";
const mat=(id,label,unit="kg",storageZone="raw")=>({id,label,unit,storageZone});
const sup=(id,industries,label,materials,prices,distanceKm,deliveryHours)=>({id,industries,label,materials,prices,distanceKm,deliveryBase:35,deliveryPerKm:.48,deliveryHours,quality:.95,reliability:.97});
const rec=(id,industries,label,materials,machineType,durationMinutes,output,product,variableCost,outputUnit="Stk")=>({id,industries,label,materials,machineType,durationMinutes,output,product,variableCost,outputUnit});
const prod=(id,industries,label,unit="Stk",sellable=true)=>({id,industries,label,unit,sellable});
export const AllIndustryEconomyContent={
 materials:[mat("sugar","Zucker"),mat("citric_acid","Zitronensäure"),mat("beverage_flavour","Getränkearoma","l"),mat("co2","CO₂","kg","cold"),mat("flour_wheat","Weizenmehl"),mat("baker_yeast","Backhefe"),mat("salt","Salz"),mat("butter","Butter","kg","cold"),mat("eggs","Eier","Stk","cold"),mat("bakery_bag","Bäckertüte","Stk","packaging"),mat("pork","Schweinefleisch","kg","cold"),mat("beef","Rindfleisch","kg","cold"),mat("spice_mix","Gewürzmischung"),mat("sausage_casing","Wurstdarm","m","cold"),mat("meat_packaging","Fleischverpackung","Stk","packaging"),mat("food_base","Lebensmittelgrundstoff"),mat("food_spice","Lebensmittelgewürz"),mat("food_pack","Lebensmittelverpackung","Stk","packaging"),mat("livestock_medicine","Tierarznei","Stk","cold"),mat("orchard_fertilizer","Obstdünger"),mat("fruit_crate","Obstkiste","Stk","packaging"),mat("steel_sheet","Stahlblech"),mat("steel_bar","Stahlprofil"),mat("welding_wire","Schweißdraht"),mat("machine_parts","Maschinenbauteile","Set"),mat("plastic_granulate","Kunststoffgranulat"),mat("plastic_pack","Industrieverpackung","Stk","packaging"),mat("retail_goods","Handelsware","Stk","finished"),mat("wholesale_goods","Großhandelsware","Stk","finished"),mat("online_goods","Online-Handelsware","Stk","finished"),mat("shipping_box","Versandkarton","Stk","packaging"),mat("shipping_label","Versandetikett","Stk","packaging")],
 suppliers:[
  sup("bev_ingredients",["beverage"],"Getränkerohstoffe Mitte",["sugar","citric_acid","beverage_flavour","co2","water","bottles","caps","labels"],{sugar:.85,citric_acid:3.4,beverage_flavour:12,co2:2.1,water:.01,bottles:.17,caps:.025,labels:.09},55,8),
  sup("mineral_water_supply",["mineral_water"],"Mineralbrunnen Verpackung & Wassertechnik",["water","bottles","caps","labels"],{water:.008,bottles:.17,caps:.025,labels:.09},42,6),
  sup("joinery_supply",["joinery"],"Tischlerbedarf Regional",["softwood","hardwood","plywood","glue","screws","varnish","packaging"],{softwood:520,hardwood:1180,plywood:14.5,glue:4.5,screws:5.8,varnish:8.4,packaging:1.1},48,8),
  sup("bakery_mill",["bakery"],"Mühle & Backbedarf",["flour_wheat","baker_yeast","salt","butter","eggs","bakery_bag","water"],{flour_wheat:.62,baker_yeast:3.2,salt:.35,butter:6.2,eggs:.22,bakery_bag:.035,water:.01},34,6),
  sup("butcher_supply",["butcher"],"Fleisch & Metzgereibedarf",["pork","beef","spice_mix","sausage_casing","meat_packaging"],{pork:4.8,beef:8.9,spice_mix:5.2,sausage_casing:.48,meat_packaging:.12},46,7),
  sup("food_supply",["food"],"Lebensmittel-Rohstoffhandel",["food_base","food_spice","food_pack"],{food_base:1.6,food_spice:4.2,food_pack:.15},63,9),
  sup("livestock_supply",["livestock"],"Tierbedarf Landhandel",["animal_feed","straw","water","livestock_medicine"],{animal_feed:.42,straw:.18,water:.01,livestock_medicine:12},29,5),
  sup("orchard_supply",["orchard"],"Obstbau Fachhandel",["orchard_fertilizer","diesel","fruit_crate"],{orchard_fertilizer:.65,diesel:1.45,fruit_crate:1.2},38,6),
  sup("metal_supply",["metal","mechanical"],"Stahlhandel Industrie",["steel_sheet","steel_bar","welding_wire","machine_parts"],{steel_sheet:1.35,steel_bar:1.25,welding_wire:3.2,machine_parts:28},72,11),
  sup("plastic_supply",["plastic"],"Polymerhandel",["plastic_granulate","plastic_pack"],{plastic_granulate:1.8,plastic_pack:.35},84,12),
  sup("retail_supply",["retail"],"Zentrallager Einzelhandel",["retail_goods"],{retail_goods:4.2},65,10),
  sup("wholesale_supply",["wholesale"],"Industrie-Großsortiment",["wholesale_goods"],{wholesale_goods:18},91,13),
  sup("online_supply",["online_retail"],"Online-Sortiment & Verpackung",["online_goods","shipping_box","shipping_label"],{online_goods:7.5,shipping_box:.45,shipping_label:.06},57,8)
 ],
 recipes:[
  rec("softdrink_basic",["beverage"],"Erfrischungsgetränk herstellen",{water:850,sugar:95,citric_acid:2,beverage_flavour:2,co2:3,bottles:1000,caps:1000,labels:1000},"mixing_tank",120,1000,"softdrink_033",85,"Flaschen"),
  rec("mineral_water_033",["mineral_water"],"Mineralwasser 0,33 l aufbereiten und abfüllen",{water:330,bottles:1000,caps:1000,labels:1000},"water_treatment",90,1000,"mineral_water_033",32,"Flaschen"),
  rec("cabinet_joinery",["joinery"],"Schrank fertigen",{softwood:.10,hardwood:.03,plywood:3.2,glue:.45,screws:2,varnish:.35,packaging:1},"panel_saw",150,1,"cabinet_joinery",46),
  rec("bread_basic",["bakery"],"Brot backen",{flour_wheat:60,baker_yeast:1.5,salt:1.2,water:38,bakery_bag:100},"bakery_oven",90,100,"bread_basic",22),
  rec("roll_basic",["bakery"],"Brötchen backen",{flour_wheat:35,baker_yeast:1,salt:.7,water:21,bakery_bag:200},"bakery_oven",55,200,"roll_basic",16),
  rec("sausage_basic",["butcher"],"Bratwurst herstellen",{pork:80,spice_mix:2,sausage_casing:120,meat_packaging:100},"meat_cutter",100,100,"sausage_basic",38),
  rec("food_product_basic",["food"],"Lebensmittel produzieren",{food_base:100,food_spice:3,food_pack:200},"food_mixer",120,200,"food_product_basic",42),
  rec("milk_cycle",["livestock"],"Milch erzeugen",{animal_feed:250,straw:80,water:700},"animal_barn",480,500,"milk",55,"l"),
  rec("egg_cycle",["livestock"],"Eier erzeugen",{animal_feed:120,straw:30,water:250},"animal_barn",480,600,"eggs_product",28),
  rec("grow_apples",["orchard"],"Äpfel erzeugen",{orchard_fertilizer:80,diesel:35,fruit_crate:100},"orchard_tractor",600,2000,"apples",95,"kg"),
  rec("machine_component",["mechanical"],"Maschinenkomponente fertigen",{steel_sheet:120,steel_bar:80,machine_parts:8,welding_wire:4},"cnc_mill",180,10,"machine_component",210),
  rec("metal_frame",["metal"],"Metallrahmen fertigen",{steel_bar:100,steel_sheet:45,welding_wire:5},"welder",130,20,"metal_frame",125),
  rec("plastic_part",["plastic"],"Kunststoffteil fertigen",{plastic_granulate:80,plastic_pack:200},"injection_machine",100,200,"plastic_part",70),
  rec("retail_sale",["retail"],"Handelsware verkaufen",{retail_goods:100},"pos_system",60,100,"retail_sale",10),
  rec("wholesale_order",["wholesale"],"Großhandelsauftrag kommissionieren",{wholesale_goods:100},"forklift",80,100,"wholesale_order",18),
  rec("online_order",["online_retail"],"Onlinebestellung versenden",{online_goods:100,shipping_box:100,shipping_label:100},"packing_stations",90,100,"online_order",22)
 ],
 products:[
  prod("softdrink_033",["beverage"],"Erfrischungsgetränk 0,33 l","Flaschen"),
  prod("mineral_water_033",["mineral_water"],"Mineralwasser 0,33 l","Flaschen"),
  prod("cabinet_joinery",["joinery"],"Tischlerei-Schrank","Stk"),
  prod("bread_basic",["bakery"],"Brot"),prod("roll_basic",["bakery"],"Brötchen"),prod("sausage_basic",["butcher"],"Bratwurst"),prod("food_product_basic",["food"],"Lebensmittelprodukt"),prod("milk",["livestock"],"Milch","l"),prod("eggs_product",["livestock"],"Eier"),prod("apples",["orchard"],"Äpfel","kg"),prod("machine_component",["mechanical"],"Maschinenkomponente"),prod("metal_frame",["metal"],"Metallrahmen"),prod("plastic_part",["plastic"],"Kunststoffteil"),prod("retail_sale",["retail"],"Einzelhandelsverkauf"),prod("wholesale_order",["wholesale"],"Großhandelsauftrag"),prod("online_order",["online_retail"],"Onlinebestellung")
 ]
};
registerWorldContent(AllIndustryEconomyContent);
