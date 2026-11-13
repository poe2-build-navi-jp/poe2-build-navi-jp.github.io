/** Generate the English UI from the same source as the Japanese simulator.
 * Only reviewed source-language text is replaced; identifiers, save keys and engine inputs stay shared.
 * Unknown Japanese fragments fail generation so new UI cannot silently ship untranslated.
 */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
// The browser also caches module workers. Update their source-language URLs before
// deriving English files, so a new catalog policy cannot reuse an older worker.
for(const file of ['simulator-worker.js','simulator.js']) {
 let body=read('assets/'+file);
 body=body.replace(/(\.\/simulator-(?:model|worker)\.js)(?:\?v=[a-f0-9]+)?/g,(_,reference)=>{
  const hash=createHash('sha256').update(read('assets/'+reference.slice(2))).digest('hex').slice(0,10);
  return reference+'?v='+hash;
 });
 fs.writeFileSync(path.join(root,'assets',file),body);
}
const overrides=JSON.parse(read('data/simulator-ui-en-overrides.json'));
const dictionary=JSON.parse(read('data/simulator-ui-en.json'));
const errorsModule="// Generated error translations; does not alter user-authored text.\nconst dictionary = "+JSON.stringify(dictionary)+";\nexport const translateRuntimeError = value => String(value).replace(/[^\\x00-\\x7f]+/g,term=>dictionary[term] ?? term);\n";
fs.writeFileSync(path.join(root,'assets/simulator-i18n-en.js'),errorsModule);
const jp=/[ぁ-んァ-ヶ一-龥]/;
const translate=(text,{source=false}={})=>text.replace(/[^\x00-\x7f]+/g,term=>{
 if(!jp.test(term))return term;
 if(!(term in dictionary))throw Error(`Missing English simulator text: ${term}`);
 // Curly quotes avoid changing the surrounding source literal delimiter.
 return source?dictionary[term].replaceAll("'",'’').replaceAll('"','”'):dictionary[term];
});
for(const kind of ['', '-model','-worker']){
 let input=read(`assets/simulator${kind}.js`);
 // Character classes are parsers, not display copy. Preserve them byte-for-byte.
 const patterns=['/[ぁ-んァ-ヶ一-龥]/'];input=input.replaceAll(patterns[0],'__SIM_PATTERN_0__');
 let output=translate(input,{source:true});
 output=output.replace(/__SIM_PATTERN_(\d+)__/g,(_,i)=>patterns[+i]);
 output=output.replace(/simulator-model\.js(?:\?[^'"`]+)?/g,'simulator-model-en.js').replace(/simulator-worker\.js(?:\?[^'"`]+)?/g,'simulator-worker-en.js');
 output=output.replaceAll("'ja-JP'","'en-US'").replaceAll("'/simulator/'","'/en/simulator/'").replaceAll('`/simulator/?','`/en/simulator/?').replaceAll('href="/simulator/', 'href="/en/simulator/');
 if(!kind){
  output=output.replace(/simulator-presets\.json(?:\?[^'"`]+)?/g,'simulator-presets-en.json').replace(/simulator-examples\.json(?:\?[^'"`]+)?/g,'simulator-examples-en.json').replace(/simulator-equipment\.json(?:\?[^'"`]+)?/g,'simulator-equipment-en.json').replace(/simulator-routes\.json(?:\?[^'"`]+)?/g,'simulator-routes-en.json');
  output=output.replace("const label=name=>","const label=name=>").replace(":names[name] || name;",":name;");
  output=output.replace('const nodeStats=node=>passiveDescriptions(node,localization,plan?.request.attribute_choices || {},!plan?.request.tree_version||plan.request.tree_version===\'0_5\');','const nodeStats=node=>passiveDescriptions(node,localization,plan?.request.attribute_choices || {},false);');
 }
 if(kind==='-model'){
  output="import {restoreItemText as restoreOriginalItemText, parseJapaneseModifiers as parseOriginalModifiers} from './simulator-model.js';\nimport {translateRuntimeError} from './simulator-i18n-en.js';\n"+output;
  const replaceSection=(start,end,replacement)=>{const a=output.indexOf(start),b=output.indexOf(end,a);if(a<0||b<0)throw Error('English override anchor missing: '+start);output=output.slice(0,a)+replacement+'\n'+output.slice(b);};
  replaceSection('export function localizeItemText(', 'export function restoreItemText(', 'export function localizeItemText(text,names){return text;}');
  replaceSection('export function restoreItemText(', 'const rareSlotClasses=', "export function restoreItemText(text,names,original=''){return restoreOriginalItemText(text,names,original);}");
  replaceSection('export function modifierJapanese(', 'export function localizeModifiers(', "export function modifierJapanese(definition,values){return definition.template.replace(/\\{(\\d+)\\}/g,(_,i)=>String(values[+i]));}");
  replaceSection('export function localizeModifiers(', 'export function parseJapaneseModifiers(', 'export function localizeModifiers(lines,catalog,names){return lines.join("\\n");}');
  replaceSection('export function parseJapaneseModifiers(', 'export function passiveComparison(', 'export function parseJapaneseModifiers(text,catalog,names,original=[]){try{return parseOriginalModifiers(text,catalog,names,original);}catch(error){throw Error(translateRuntimeError(error.message));}}');
 }
 for(const rule of overrides.filter(rule=>rule.module===kind)){if(!output.includes(rule.from))throw Error('English sentence override needs review: '+rule.from);output=output.replaceAll(rule.from,rule.to);}
 fs.writeFileSync(path.join(root,`assets/simulator${kind}-en.js`),'// Generated by tools/generate-simulator-runtime-en.mjs; edit source and dictionary.\n'+output);
}
const equipment=JSON.parse(read('data/simulator-equipment.json'));
for(const base of equipment.bases)base.label=base.name;
for(const mod of equipment.modifiers){mod.label=mod.template.replace(/\{\d+\}/g,'#');mod.group=({'スキル':'Skills','回復':'Recovery','生存・防御':'Survival and defence','耐性':'Resistances','能力値':'Attributes','追加ダメージ':'Added damage','速度・火力':'Speed and damage'})[mod.group]||mod.group;}
fs.writeFileSync(path.join(root,'data/simulator-equipment-en.json'),JSON.stringify(equipment,null,2)+'\n');
const routes=JSON.parse(read('data/simulator-routes.json'));
function englishRoute(value){
 if(typeof value==='string')return translate(value);
 if(Array.isArray(value))return value.map(englishRoute);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,englishRoute(v)]));
 return value;
}
for(const template of Object.values(routes.templates)){for(const step of template.steps||[])step.label=translate(step.label);}
fs.writeFileSync(path.join(root,'data/simulator-routes-en.json'),JSON.stringify(routes,null,2)+'\n');
// Fingerprint dependencies in dependency order to avoid stale imports after publication.
for(const file of ['simulator-model-en.js','simulator-worker-en.js','simulator-en.js']){
 let body=read('assets/'+file);
 body=body.replace(/((?:\.\/|\/data\/)[-\w]+(?:-en)?\.(?:json|js))(?:\?v=[^'"`]+)?/g,(all,p)=>{
 const target=p.startsWith('./')?'assets/'+p.slice(2):p.slice(1);
 if(!fs.existsSync(path.join(root,target)))return p;
 return p+'?v='+createHash('sha256').update(read(target)).digest('hex').slice(0,10);
 });
 fs.writeFileSync(path.join(root,'assets',file),body);
}
console.log('Generated English simulator runtime, model, worker and display catalogs.');
