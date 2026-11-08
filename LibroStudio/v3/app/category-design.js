'use strict';

Object.assign(paths,{
  folio:'M5 3.5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M7 8h10 M7 11.5h6 M13.5 16l2-1.5V19 M13.5 19h4',
  header:'M5 3.5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M3 9h18 M7 6.5h6 M7 13h10 M7 16.5h7',
  grid:'M5 3.5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M9 3.5v17 M15 3.5v17 M3 9h18 M3 15h18',
  book:'M12 6c-3-2.5-6-3-10-2v14c4-1 7-.5 10 2 3-2.5 6-3 10-2V4c-4-1-7-.5-10 2v14 M5.5 8l3 .5 M15.5 8.5l3-.5 M5.5 12l3 .5 M15.5 12.5l3-.5',
  index:'M5 3h13v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 7h7 M7 11h7 M7 15h4 M18 6h3v4h-3 M18 13h3v4h-3',
  layers:'M12 3l9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  objects:'M8 4h12v12H8z M4 9v11h11 M8 4h2v2H8z M18 14h2v2h-2z',
  pages:'M5 5h11a2 2 0 0 1 2 2v13H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 2h12a2 2 0 0 1 2 2v13 M7 10h7 M7 14h5',
  more:'M6 9l6 6 6-6'
});
const categoryIcons = {structure:'book',design:'grid',text:'text',object:'objects',pages:'pages',index:'index',layers:'layers'};
const categoryTabs = $('.tabs');
const moreCategories = document.createElement('button');
moreCategories.type = 'button';
moreCategories.id = 'moreCategories';
moreCategories.setAttribute('aria-haspopup','true');
moreCategories.setAttribute('aria-expanded','false');
moreCategories.innerHTML = icon('more');
categoryTabs.append(moreCategories);
const categoryMenu = document.createElement('div');
categoryMenu.id = 'categoryMenu';
categoryMenu.hidden = true;
document.body.append(categoryMenu);

function closeCategoryMenu() {
  categoryMenu.hidden = true;
  moreCategories.setAttribute('aria-expanded','false');
}
function categoryName(button) { return button.textContent.trim(); }
function refreshCategoryTabs() {
  const tabs = [...categoryTabs.querySelectorAll('.tab')];
  for (const button of tabs) {
    button.hidden = false;
    if (!button.querySelector('svg')) button.insertAdjacentHTML('afterbegin',icon(categoryIcons[button.dataset.tab]||'pages'));
  }
  const space = categoryTabs.clientWidth;
  const widths = tabs.map(button=>button.getBoundingClientRect().width);
  const overflows = widths.reduce((sum,width)=>sum+width,0)>space;
  let remaining = space-(overflows?37:0);
  for (const [index,button] of tabs.entries()) {
    remaining -= widths[index];
    button.hidden = remaining < -.5;
  }
  moreCategories.hidden = !overflows;
  const hiddenActive = tabs.find(button=>button.hidden && button.dataset.tab===tab);
  moreCategories.classList.toggle('active',!!hiddenActive);
  moreCategories.title = bw('Más categorías','More categories','Mais categorias')+(hiddenActive?' · '+categoryName(hiddenActive):'');
  moreCategories.setAttribute('aria-label',moreCategories.title);
  if (!overflows) closeCategoryMenu();
}
moreCategories.onclick = () => {
  if (!categoryMenu.hidden) { closeCategoryMenu();return; }
  categoryMenu.replaceChildren();
  for (const button of categoryTabs.querySelectorAll('.tab[hidden]')) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = button.dataset.tab===tab?'active':'';
    option.innerHTML = icon(categoryIcons[button.dataset.tab]||'pages')+`<span>${esc(categoryName(button))}</span>`;
    option.onclick = ()=>{closeCategoryMenu();showTab(button.dataset.tab);moreCategories.focus();};
    categoryMenu.append(option);
  }
  const rect = moreCategories.getBoundingClientRect();
  Object.assign(categoryMenu.style,{right:Math.max(8,innerWidth-rect.right)+'px',top:rect.bottom+5+'px'});
  categoryMenu.hidden = false;
  moreCategories.setAttribute('aria-expanded','true');
  categoryMenu.querySelector('button')?.focus();
};
document.addEventListener('pointerdown',event=>{
  if (!categoryMenu.hidden && !categoryMenu.contains(event.target) && !moreCategories.contains(event.target)) closeCategoryMenu();
},true);
document.addEventListener('keydown',event=>{
  if (!categoryMenu.hidden && event.key==='Escape') {
    event.stopImmediatePropagation();
    closeCategoryMenu();
    moreCategories.focus();
  }
},true);
new ResizeObserver(()=>{closeCategoryMenu();refreshCategoryTabs();}).observe(categoryTabs);
extend.after('showTab',function(name){refreshCategoryTabs(); },'category-design');
extend.after('render',function(full=true){refreshCategoryTabs(); },'category-design');
document.addEventListener('maquetario:language',()=>{refreshCategoryTabs();});
for (const [selector,name] of [['[data-tool="folio"]','folio'],['[data-tool="header"]','header'],
  ['[data-tool="grid"]','grid'],['#coverTool','book'],['#indexTool','index'],['#layersTool','layers']]) {
  const previous = $(selector)?.querySelector('svg');
  if (previous) {
    previous.insertAdjacentHTML('afterend',icon(name));
    previous.remove();
  }
}
refreshCategoryTabs();
