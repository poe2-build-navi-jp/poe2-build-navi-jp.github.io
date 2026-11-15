export const tables=new Map();
export const fault={before:'',after:''};
const databaseError=code=>Object.assign(Error(code),{code,appDatabase:true});
export const isAppDatabaseError=cause=>cause?.appDatabase===true;
const table=name=>{if(!tables.has(name))tables.set(name,new Map());return tables.get(name);};
const operation=(kind,name,records,options={})=>({kind,name,records,options,
  then(resolve,reject){return transact([this]).then(result=>resolve(result[0]),reject);}});
async function transact(operations){
  if(Buffer.byteLength(JSON.stringify(operations))>1048576)throw databaseError('AppDatabaseRequestTooLarge');
  if(fault.before){const code=fault.before;fault.before='';throw databaseError(code);}
  for(const op of operations)if(op.kind==='update')for(const entry of op.records){
    const current=table(op.name).get(entry.id);
    if(entry.if&&Object.entries(entry.if).some(([key,value])=>current?.[key]!==value))throw databaseError('AppDatabaseConditionFailed');
  }
  const result=operations.map(op=>op.records.map(entry=>{
    const rows=table(op.name),id=typeof entry==='string'?entry:entry.id;
    if(op.kind==='delete')return rows.delete(id);
    if(op.kind==='add'){
      if(rows.has(id))return null;
      const {id:_,...record}=entry;rows.set(id,structuredClone(record));return id;
    }
    rows.set(id,op.options.patch?{...rows.get(id),...structuredClone(entry.record)}:structuredClone(entry.record));return true;
  }));
  if(fault.after){const code=fault.after;fault.after='';throw databaseError(code);}
  return result;
}
export const db={get:async(name,ids)=>ids.map(id=>structuredClone(table(name).get(id)??null)),
  tx:{add:(name,records)=>operation('add',name,records),update:(name,records,options)=>operation('update',name,records,options),delete:(name,ids)=>operation('delete',name,ids)},transact};
export const json=(value,statusCode=200)=>({statusCode,body:JSON.stringify(value)});
export const error=(message,statusCode=400)=>json({message},statusCode);
export const router=routes=>async({operation,body})=>routes['POST /api/v1/'+operation][0]({body,query:{},params:{},event:{}});
