import assert from 'node:assert/strict';
import '../js/content/GameContentData.js';
import '../js/content/AllIndustryEconomyContent.js';
import '../js/content/AgricultureCropContent.js';
import '../js/content/BrewerySupplySupplement.js';
import '../js/content/ConnectedIndustryChainsContent.js';
import '../js/content/SupplyChainClosureSupplement.js';
import '../js/core/IndustryChainCatalogSupplement.js';
import { worldContentRegistry } from '../js/core/ContentRegistry.js';
import { IndustryProfiles } from '../js/core/IndustryCatalog.js';
import { MissionSystem } from '../js/core/MissionSystem.js';

const entries=Object.entries(IndustryProfiles);
assert.equal(entries.length,35,`Expected 35 playable industries, got ${entries.length}`);
const branchKeys=entries.map(([,p])=>p.branchKey);
assert.equal(new Set(branchKeys).size,entries.length,'Every visible industry must have its own branchKey');

const recipesFor=branch=>worldContentRegistry.list('recipes',{filter:r=>(r.industries||[]).includes(branch)&&!r.deprecated});
const productsFor=branch=>worldContentRegistry.list('products',{filter:p=>(p.industries||[]).includes(branch)&&p.sellable!==false});
const suppliersFor=(branch,item)=>worldContentRegistry.list('suppliers',{filter:s=>(s.industries||[]).includes(branch)&&(s.materials||[]).includes(item)});
const producersFor=item=>worldContentRegistry.list('recipes',{filter:r=>r.product===item&&!r.deprecated});

for(const [type,profile] of entries){
  const branch=profile.branchKey;
  const recipes=recipesFor(branch);
  assert(recipes.length>0,`${type}/${branch} has no own recipe`);
  const products=productsFor(branch);
  assert(products.length>0,`${type}/${branch} has no own sellable product`);
  const sellableRecipe=recipes.find(r=>{
    const product=worldContentRegistry.get('products',r.product);
    return product&&product.sellable!==false&&(product.industries||[]).includes(branch);
  });
  assert(sellableRecipe,`${type}/${branch} has no recipe producing an own sellable product`);

  for(const recipe of recipes){
    for(const item of Object.keys(recipe.materials||{})){
      const covered=producersFor(item).length>0||suppliersFor(branch,item).length>0;
      assert(covered,`${type}/${branch}: input ${item} for ${recipe.id} has no producer or supplier`);
    }
  }

  const company={type,branchKey:branch,money:10000,coins:0,vehicles:[],production:{capacity:0},missions:[],completedMissions:[]};
  const mission=new MissionSystem().createNextMission(company);
  assert.equal(mission.branchKey,branch,`${type}: mission branch mismatch`);
  const missionProduct=worldContentRegistry.get('products',mission.productId);
  assert(missionProduct,`${type}: mission product ${mission.productId} does not exist`);
  assert((missionProduct.industries||[]).includes(branch),`${type}: foreign mission product ${mission.productId}`);
  if(branch!=='brewery') assert(!/lagerbier|pils/i.test(mission.productName),`${type}: brewery product leaked into mission`);
}

const retail=new MissionSystem().createNextMission({type:'Einzelhandel',branchKey:'retail',money:5000,coins:0,vehicles:[],production:{capacity:0},missions:[],completedMissions:[]});
assert.equal(retail.productId,'retail_sale');
assert.match(retail.productName,/Einzelhandel/i);
assert(!/lagerbier|pils/i.test(retail.productName));

console.log(`PASS: ${entries.length} industries have isolated recipes, products, supply coverage and missions`);
