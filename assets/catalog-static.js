const cards = [...document.querySelectorAll('.catalog-card')];
const select = document.getElementById('class-filter');
const search = document.getElementById('build-search');
const names = [...new Set(cards.map(card => card.dataset.class))];
names.forEach(name => select.append(new Option(name, name)));
function render() {
 let count=0; const query=search.value.trim().toLocaleLowerCase('ja');
 cards.forEach(card=>{card.hidden=Boolean((select.value && card.dataset.class!==select.value)||(query && !card.textContent.toLocaleLowerCase('ja').includes(query)));if(!card.hidden)count++;});
 document.getElementById('result-count').textContent=`${count}件`;
 document.querySelectorAll('[data-class-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.classChoice===select.value)));
}
['',...names].forEach(name=>{const b=document.createElement('button');b.type='button';b.dataset.classChoice=name;b.textContent=name||'すべて';b.addEventListener('click',()=>{select.value=name;render();});document.getElementById('class-choices').append(b);});
search.addEventListener('input',render);select.addEventListener('change',render);render();
