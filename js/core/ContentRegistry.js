// WorldProject - zentrale erweiterbare Inhalts-Registry
// Neue Branchen, Rohstoffe, Maschinen, Produkte, Rezepte, Lieferanten usw. werden hier registriert,
// ohne Kernsysteme anpassen zu muessen.

export class ContentRegistry {
  constructor(){
    this.collections=new Map();
  }

  ensure(type){
    if(!this.collections.has(type)) this.collections.set(type,new Map());
    return this.collections.get(type);
  }

  register(type,id,data,{overwrite=false}={}){
    if(!type||!id) throw new Error("ContentRegistry: type und id sind Pflicht");
    const col=this.ensure(type);
    if(col.has(id)&&!overwrite) throw new Error(`ContentRegistry: ${type}/${id} existiert bereits`);
    const record=Object.freeze({id,...data});
    col.set(id,record);
    return record;
  }

  registerMany(type,records=[],options={}){
    const valid=Array.isArray(records)?records.filter(record=>record&&typeof record==="object"&&record.id):[];
    if(valid.length!==(Array.isArray(records)?records.length:0))console.warn(`ORVUNO ContentRegistry: ungültige ${type}-Einträge wurden übersprungen`);
    return valid.map(r=>this.register(type,r.id,r,options));
  }

  get(type,id){return this.ensure(type).get(id)||null;}
  has(type,id){return this.ensure(type).has(id);}
  list(type,{filter=null}={}){
    const arr=[...this.ensure(type).values()];
    return typeof filter==="function"?arr.filter(filter):arr;
  }
  ids(type){return [...this.ensure(type).keys()];}
  remove(type,id){return this.ensure(type).delete(id);}
  clear(type){if(type)this.ensure(type).clear();else this.collections.clear();}
  snapshot(){return Object.fromEntries([...this.collections.entries()].map(([k,v])=>[k,[...v.values()]]));}
}

export const worldContentRegistry=new ContentRegistry();

// Erweiterungspunkt fuer spaetere Mods, Admin-Inhalte oder neue Branchenmodule.
// Ein einzelner defekter/sparsamer Datensatz darf niemals den kompletten Spielstart abbrechen.
export function registerWorldContent(bundle={}){
  if(!bundle||typeof bundle!=="object")return worldContentRegistry;
  for(const[type,records]of Object.entries(bundle)){
    if(!Array.isArray(records))continue;
    for(const record of records){
      if(!record||typeof record!=="object"||!record.id){
        console.warn(`ORVUNO ContentRegistry: ungültiger Eintrag in ${type} übersprungen`,record);
        continue;
      }
      worldContentRegistry.register(type,record.id,record,{overwrite:true});
    }
  }
  return worldContentRegistry;
}

if(typeof window!=="undefined") window.worldContentRegistry=worldContentRegistry;
