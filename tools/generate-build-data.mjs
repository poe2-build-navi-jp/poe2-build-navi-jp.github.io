// Writes one JSON file per listed build (data/builds/<classSlug>/<slug>.json) so a build page
// downloads ~20KB instead of the whole data/builds.json. Each file holds the full build plus the
// up-to-three same-class builds the page links as related. Run after editing data/builds.json;
// test-site fails while the files are out of date.
import {mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const builds=JSON.parse(await readFile(resolve(root,'data/builds.json'),'utf8')).filter(b=>b.status!=='draft');
export const buildDataPath=b=>`data/builds/${b.classSlug}/${b.slug}.json`;
const outDir=resolve(root,'data/builds');
await rm(outDir,{recursive:true,force:true});
for(const build of builds){
 const related=builds.filter(item=>item.className===build.className&&item.id!==build.id).slice(0,3).map(({name,classSlug,slug})=>({name,classSlug,slug}));
 const file=resolve(root,buildDataPath(build));
 await mkdir(dirname(file),{recursive:true});
 await writeFile(file,`${JSON.stringify({build,related})}\n`);
}
console.log(`Build data: ${builds.length} files in data/builds/`);
