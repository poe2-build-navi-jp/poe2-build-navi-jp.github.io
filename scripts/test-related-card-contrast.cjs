const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');const css=fs.readFileSync(path.join(root,'assets/styles.css'),'utf8');
const ink=css.match(/--ink:(#[0-9a-f]{6})/i)[1];
assert.match(css,/\.next-box \.related-links a\{color:var\(--ink\)\}/);
assert.match(css,/\.next-box \.related-links a:hover,\.next-box \.related-links a:focus-visible\{text-decoration:underline\}/);
const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
const lum=h=>rgb(h).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const ratio=(lum('#ffffff')+.05)/(lum(ink)+.05);assert(ratio>=4.5);
let cards=0;for(const g of fs.readdirSync(path.join(root,'guides'),{withFileTypes:true}).filter(g=>g.isDirectory())){
 const file=path.join(root,'guides',g.name,'index.html');if(!fs.existsSync(file))continue;
 const doc=new JSDOM(fs.readFileSync(file,'utf8')).window.document;
 for(const a of doc.querySelectorAll('.next-box .related-links a')){assert(a.textContent.trim());assert(a.getAttribute('href'));cards++;}
}
assert(cards>0);console.log(`PASS: ${cards} related cards retain link labels; dark ink on white ${ratio.toFixed(2)}:1, with hover/focus underline`);
