// WorldProject - durchgaengige Spieler-Wirtschaftsketten fuer Grundversorgung und Verarbeitung.
// Produzenten geben exakt die Material-IDs aus, die nachgelagerte Betriebe direkt verbrauchen.
import { registerWorldContent } from "../core/ContentRegistry.js";

const m=(id,label,unit="kg",storageZone="raw")=>({id,label,unit,storageZone});
const p=(id,industries,label,unit="kg",sellable=true)=>({id,industries,label,unit,sellable});
const r=(id,industries,label,materials,machineType,durationMinutes,output,product,variableCost,outputUnit="kg")=>({id,industries,label,materials,machineType,durationMinutes,output,product,variableCost,outputUnit});
const s=(id,industries,label,materials,prices,distanceKm=60,deliveryHours=8)=>({id,industries,label,materials,prices,distanceKm,deliveryBase:40,deliveryPerKm:.48,deliveryHours,quality:.94,reliability:.96,sourceType:"ai",fallbackOnly:true});

export const ConnectedIndustryChainsContent={
 materials:[
  m("wheat","Weizen"),m("barley","Gerste"),
  m("forest_seedlings","Forstsetzlinge","Stk"),m("roundwood_soft","Nadel-Rundholz","m3"),m("roundwood_hard","Laub-Rundholz","m3"),m("sugar_beet","Zuckerrüben"),m("flour_wheat","Weizenmehl"),
  m("milk","Rohmilch","l","cold"),m("butter","Butter","kg","cold"),m("cream","Sahne","l","cold"),m("cattle","Rinder","Stk","cold"),m("pigs","Schweine","Stk","cold"),m("beef","Rindfleisch","kg","cold"),m("pork","Schweinefleisch","kg","cold"),
  m("feed_grain","Futtergetreide"),m("salt","Salz"),m("spice_mix","Gewürzmischung"),m("silica_sand","Quarzsand"),m("soda_ash","Soda"),m("limestone","Kalkstein"),
  m("steel_coil","Stahlcoil"),m("steel_sheet","Stahlblech"),m("steel_bar","Stahlprofil"),m("wood_pulp","Holzzellstoff"),m("paper_roll","Papierrolle"),m("cardboard","Kartonage","Stk","packaging"),m("printing_ink","Druckfarbe","l"),
  m("plastic_feedstock","Kunststoff-Rohstoff"),m("plastic_granulate","Kunststoffgranulat"),m("bakery_bag","Bäckertüte","Stk","packaging"),m("meat_packaging","Fleischverpackung","Stk","packaging"),m("shipping_box","Versandkarton","Stk","packaging"),m("fruit_crate","Obstkiste","Stk","packaging")
 ],
 recipes:[
  r("forestry_softwood",["forestry"],"Nadelwald bewirtschaften",{forest_seedlings:120,diesel:35},"forestry_harvester",720,90,"roundwood_soft",160,"m3"),
  r("forestry_hardwood",["forestry"],"Laubwald bewirtschaften",{forest_seedlings:100,diesel:40},"forestry_harvester",840,65,"roundwood_hard",190,"m3"),
  r("saw_softwood",["sawmill"],"Nadelholz sägen",{roundwood_soft:20},"sawmill_line",150,15,"softwood",110,"m3"),
  r("saw_hardwood",["sawmill"],"Hartholz sägen",{roundwood_hard:15},"sawmill_line",170,10,"hardwood",135,"m3"),
  r("mill_wheat",["mill"],"Weizen mahlen",{wheat:1000},"grain_mill",90,780,"flour_wheat",62),
  r("malt_barley",["maltster"],"Gerste vermälzen",{barley:1000,water:850},"malting_line",480,800,"malt",145),
  r("grow_hops",["hops_farm"],"Hopfen anbauen",{fertilizer:90,diesel:45},"hop_harvester",900,650,"hops",180),
  r("refine_sugar",["sugar_factory"],"Zuckerrüben raffinieren",{sugar_beet:1000,water:300},"sugar_line",240,150,"sugar",90),
  r("feed_mix",["feed_mill"],"Tierfutter mischen",{feed_grain:700,wheat:150,barley:150},"feed_mixer",120,1000,"animal_feed",75),
  r("raise_cattle",["livestock"],"Rinder aufziehen",{animal_feed:1200,straw:350,water:1800},"animal_barn",720,10,"cattle",210,"Stk"),
  r("raise_pigs",["livestock"],"Schweine aufziehen",{animal_feed:900,straw:220,water:1200},"animal_barn",600,20,"pigs",145,"Stk"),
  r("dairy_butter",["dairy"],"Butter herstellen",{milk:1000},"dairy_line",180,42,"butter",85),
  r("dairy_cream",["dairy"],"Sahne herstellen",{milk:1000},"dairy_line",120,110,"cream",60,"l"),
  r("slaughter_beef",["slaughterhouse"],"Rind verarbeiten",{cattle:10},"slaughter_line",240,2600,"beef",420),
  r("slaughter_pork",["slaughterhouse"],"Schwein verarbeiten",{pigs:20},"slaughter_line",210,1600,"pork",310),
  r("glass_033",["glassworks"],"0,33-l-Flaschen herstellen",{silica_sand:700,soda_ash:180,limestone:120},"glass_furnace",180,3500,"bottles",210,"Stk"),
  r("glass_050",["glassworks"],"0,50-l-Flaschen herstellen",{silica_sand:720,soda_ash:180,limestone:120},"glass_furnace",180,2800,"bottles_050",220,"Stk"),
  r("steel_sheet_make",["steelworks"],"Stahlblech walzen",{steel_coil:1000},"rolling_mill",210,940,"steel_sheet",130),
  r("steel_bar_make",["steelworks"],"Stahlprofile walzen",{steel_coil:1000},"rolling_mill",220,925,"steel_bar",140),
  r("caps_make",["closures"],"Kronkorken fertigen",{steel_sheet:120},"cap_press",120,50000,"caps",180,"Stk"),
  r("paper_make",["paper_mill"],"Papier herstellen",{wood_pulp:1000,water:3500},"paper_machine",240,920,"paper_roll",115),
  r("labels_033_make",["label_print"],"0,33-l-Etiketten drucken",{paper_roll:90,printing_ink:8},"label_press",100,50000,"labels",150,"Stk"),
  r("labels_050_make",["label_print"],"0,50-l-Etiketten drucken",{paper_roll:105,printing_ink:9},"label_press",105,50000,"labels_050",165,"Stk"),
  r("shipping_boxes_make",["packaging_maker"],"Versandkartons herstellen",{cardboard:1000,paper_roll:250},"packaging_line",160,1000,"shipping_box",95,"Stk"),
  r("bakery_bags_make",["packaging_maker"],"Bäckertüten herstellen",{paper_roll:160},"packaging_line",100,5000,"bakery_bag",70,"Stk"),
  r("meat_pack_make",["packaging_maker"],"Fleischverpackungen herstellen",{cardboard:350,plastic_granulate:80},"packaging_line",120,3000,"meat_packaging",85,"Stk"),
  r("fruit_crates_make",["packaging_maker"],"Obstkisten herstellen",{softwood:4},"packaging_line",120,200,"fruit_crate",80,"Stk"),
  r("plastic_granulate_make",["polymer"],"Kunststoffgranulat herstellen",{plastic_feedstock:1000},"polymer_line",220,930,"plastic_granulate",165),
  r("citric_acid_make",["food_chemicals"],"Zitronensäure herstellen",{water:500},"chemical_mixer",180,200,"citric_acid",110),
  r("flavour_make",["food_chemicals"],"Getränkearoma herstellen",{water:350},"chemical_mixer",150,120,"beverage_flavour",95,"l"),
  r("wash_chem_make",["food_chemicals"],"Flaschenwaschmittel herstellen",{water:500},"chemical_mixer",140,400,"bottle_wash_chem",90),
  r("fertilizer_make",["agri_chemicals"],"Dünger herstellen",{water:200},"fertilizer_line",180,1000,"fertilizer",120)
 ],
 products:[
  p("roundwood_soft",["forestry"],"Nadel-Rundholz","m3"),p("roundwood_hard",["forestry"],"Laub-Rundholz","m3"),p("softwood",["sawmill"],"Nadel-Schnittholz","m3"),p("hardwood",["sawmill"],"Hartholz","m3"),
  p("flour_wheat",["mill"],"Weizenmehl"),p("malt",["maltster"],"Malz"),p("hops",["hops_farm"],"Hopfen"),p("sugar",["sugar_factory"],"Zucker"),p("animal_feed",["feed_mill"],"Tierfutter"),p("cattle",["livestock"],"Rinder","Stk"),p("pigs",["livestock"],"Schweine","Stk"),
  p("butter",["dairy"],"Butter"),p("cream",["dairy"],"Sahne","l"),p("beef",["slaughterhouse"],"Rindfleisch"),p("pork",["slaughterhouse"],"Schweinefleisch"),
  p("bottles",["glassworks"],"Neue 0,33-l-Flaschen","Stk"),p("bottles_050",["glassworks"],"Neue 0,50-l-Flaschen","Stk"),p("steel_sheet",["steelworks"],"Stahlblech"),p("steel_bar",["steelworks"],"Stahlprofil"),p("caps",["closures"],"Kronkorken","Stk"),p("paper_roll",["paper_mill"],"Papierrolle"),p("labels",["label_print"],"Etiketten 0,33 l","Stk"),p("labels_050",["label_print"],"Etiketten 0,50 l","Stk"),
  p("shipping_box",["packaging_maker"],"Versandkarton","Stk"),p("bakery_bag",["packaging_maker"],"Bäckertüte","Stk"),p("meat_packaging",["packaging_maker"],"Fleischverpackung","Stk"),p("fruit_crate",["packaging_maker"],"Obstkiste","Stk"),p("plastic_granulate",["polymer"],"Kunststoffgranulat"),p("citric_acid",["food_chemicals"],"Zitronensäure"),p("beverage_flavour",["food_chemicals"],"Getränkearoma","l"),p("bottle_wash_chem",["food_chemicals"],"Flaschenwaschmittel"),p("fertilizer",["agri_chemicals"],"Dünger")
 ],
 suppliers:[
  s("ai_forest_inputs",["forestry"],"KI Forstbedarf",["forest_seedlings","diesel"],{forest_seedlings:.42,diesel:1.45},38,6),
  s("ai_mill_wheat",["mill"],"KI Getreidehandel",["wheat"],{wheat:.31},52,7),s("ai_malt_barley",["maltster"],"KI Getreidehandel",["barley"],{barley:.29},52,7),
  s("ai_hops_inputs",["hops_farm"],"KI Agrarbedarf",["fertilizer","diesel"],{fertilizer:.55,diesel:1.45},41,6),s("ai_sawmill_logs",["sawmill"],"KI Forsthandel",["roundwood_soft","roundwood_hard"],{roundwood_soft:95,roundwood_hard:150},74,9),
  s("ai_dairy_milk",["dairy"],"KI Milchhandel",["milk"],{milk:.39},31,5),s("ai_slaughter_animals",["slaughterhouse"],"KI Viehhandel",["cattle","pigs"],{cattle:980,pigs:145},45,7),
  s("ai_glass_raw",["glassworks"],"KI Glasrohstoffe",["silica_sand","soda_ash","limestone"],{silica_sand:.08,soda_ash:.32,limestone:.06},88,11),s("ai_steel_raw",["steelworks"],"KI Stahlgrundstoff",["steel_coil"],{steel_coil:.84},105,13),
  s("ai_cap_sheet",["closures"],"KI Stahlhandel",["steel_sheet"],{steel_sheet:1.28},78,9),s("ai_print_raw",["label_print"],"KI Druckbedarf",["paper_roll","printing_ink"],{paper_roll:.92,printing_ink:4.8},48,7),s("ai_polymer_raw",["polymer"],"KI Polymergrundstoff",["plastic_feedstock"],{plastic_feedstock:1.12},96,12)
 ]
};
registerWorldContent(ConnectedIndustryChainsContent);
