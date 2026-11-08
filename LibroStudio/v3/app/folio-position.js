'use strict';

const folioMetric = document.createElement('canvas').getContext('2d');
extend.result('autoElement',function(element,index,type,px,printing=false){
  if (!element || type !== 'folio') return element;
  const cfg = M.auto(book,index,type), margins = M.margins(book,index);
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const fontSize = cfg.size*25.4/72, height = fontSize*1.3;
  const outer = index%2===0?'left':'right', inner = outer==='left'?'right':'left';
  const pos = cfg.pos;
  const side = pos==='outer'?outer:pos==='inner'?inner:pos;
  const lateral = ['left','right'].includes(side);
  const font = element.style.fontFamily || 'Georgia';
  folioMetric.font = `${element.style.fontStyle||'normal'} ${element.style.fontWeight||'400'} ${fontSize*4}px ${font}`;
  const width = Math.max(fontSize,folioMetric.measureText(element.textContent).width/4)+0.6;
  const rotate = !!cfg.vertical;
  const halfX = (rotate?height:width)/2, halfY = (rotate?width:height)/2;
  let x,y;
  if (lateral) {
    const left = side==='left', margin = left?margins.left:margins.right;
    const inset = clamp(cfg.distance,halfX,Math.max(halfX,margin-halfX));
    const min = left?0:book.width-margin, max = left?margin:book.width;
    x = margin<halfX*2 ? (min+max)/2 : clamp((left?inset:book.width-inset)+cfg.offsetX,min+halfX,max-halfX);
    y = clamp(book.height/2+cfg.offsetY,halfY,book.height-halfY);
    // Clip to the physical margin when the chosen type is wider than the margin.
    element.style.clipPath = rotate ? `inset(${Math.max(0,(height-margin)/2)*px}px 0)`
      : `inset(0 ${Math.max(0,(width-margin)/2)*px}px)`;
    element.dataset.sideMargin = side;
  } else {
    const [edge,anchor] = pos.split('-');
    const horizontal = anchor==='outer'?outer:anchor==='inner'?inner:'center';
    const top = edge==='top', margin = top?book.margins.top:book.margins.bottom;
    const inset = clamp(cfg.distance+halfY,halfY,Math.max(halfY,margin-halfY));
    const min = top?0:book.height-margin, max = top?margin:book.height;
    y = margin<halfY*2 ? (min+max)/2 : clamp((top?inset:book.height-inset)+cfg.offsetY,min+halfY,max-halfY);
    const defaultX = horizontal==='left'?cfg.distance+halfX:horizontal==='right'?book.width-cfg.distance-halfX:book.width/2;
    x = clamp(defaultX+cfg.offsetX,halfX,book.width-halfX);
  }
  Object.assign(element.style,{
    left:x*px+'px',top:y*px+'px',width:width*px+'px',height:height*px+'px',
    lineHeight:height*px+'px',whiteSpace:'nowrap',textAlign:'center',
    transform:`translate(-50%,-50%)${rotate?' rotate(-90deg)':''}`,transformOrigin:'center'
  });
  return element;
},'folio-position');

decorateInspector(()=>{
  const section = $('[data-bind="folio.pos"]')?.closest('.section');
  if (!section || section.querySelector('.folio-placement')) return;
  const group = document.createElement('div');
  group.className = 'folio-placement';
  group.innerHTML = `<strong>${bw('Ajuste fino de posición','Fine position','Ajuste fino de posição')}</strong>
    <p class="help">${bw('Mové el folio con los deslizadores o escribí la medida exacta. El eje del margen queda protegido.',
      'Drag the sliders or type an exact value. The margin boundary is protected.',
      'Arraste os controles ou digite a medida exata. O limite da margem é protegido.')}</p>`;
  for (const [key,label] of [['offsetX',bw('Horizontal','Horizontal','Horizontal')],['offsetY',bw('Vertical','Vertical','Vertical')]]) {
    const numeric = section.querySelector(`[data-bind="folio.${key}"]`);
    const field = numeric?.closest('.field-row');
    if (!field) continue;
    field.querySelector('label').textContent = label;
    numeric.setAttribute('aria-label',label);
    group.append(field);
    const slider = document.createElement('input');
    slider.type = 'range';
    const limits = value => {
      const span = Math.max(key==='offsetX'?30:60,Math.abs(Number(value)));
      slider.min = -span;
      slider.max = span;
      slider.value = value;
    };
    slider.step = '.5';
    limits(book.folio[key]);
    slider.setAttribute('aria-label',label+' · '+bw('desplazamiento','offset','deslocamento'));
    slider.oninput = () => {
      const previous = book.folio[key];
      numeric.value = slider.value;
      book.folio[key] = Number(slider.value);
      try { renderPages(); } finally { book.folio[key] = previous; }
    };
    slider.onchange = () => numeric.dispatchEvent(new Event('change',{bubbles:true}));
    numeric.addEventListener('change',()=>limits(book.folio[key]));
    field.append(slider);
  }
  const details = section.querySelector('details');
  if (details) details.before(group);
  else section.append(group);
},'folio-position');
