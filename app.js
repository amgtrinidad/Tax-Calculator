/* Tax Calculator (Annual • Quarterly • Persistent)
 * - Months JAN–DEC
 * - Columns 2–9 allow up to 7 entries per month
 * - Column 10 = Remarks
 * - Live quarterly subtotals (2–9)
 * - Quarter tabs; Save Quarter (JSON backup); PNG export; Annual Grand Total
 * - Autosave via localStorage
 * - PWA-ready (service worker registered here)
 */

(function(){
  const STORAGE_KEY = 'taxcalc-v1';
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const CATS = ["DDV IN","DDV OPD","BFD IN","BFD OPD","NGH","TMCP","OTHERS","PROJECTS"]; // columns 2–9
  const QUARTERS = [
    { name:"Q1 • JAN–MAR", months:[0,1,2] },
    { name:"Q2 • APR–JUN", months:[3,4,5] },
    { name:"Q3 • JUL–SEP", months:[6,7,8] },
    { name:"Q4 • OCT–DEC", months:[9,10,11] }
  ];

  // ---------- State ----------
  let data = load() || makeEmptyYear();
  let activeQ = 0;

  // ---------- DOM ----------
  const tabs = document.getElementById('quarterTabs');
  const table = document.getElementById('qTable');
  const btnSaveQuarter = document.getElementById('btnSaveQuarter');
  const btnPNG = document.getElementById('btnPNG');
  const btnGrandTotal = document.getElementById('btnGrandTotal');
  const grandSpan = document.getElementById('grandTotal');

  // Build quarter tabs
  QUARTERS.forEach((q, i)=>{
    const b = document.createElement('button');
    b.className = 'tab' + (i===0?' active':'');
    b.textContent = q.name;
    b.addEventListener('click', ()=>{
      activeQ = i;
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      b.classList.add('active');
      renderQuarter();
    });
    tabs.appendChild(b);
  });

  // Render initial
  renderQuarter();
  updateGrandTotalLabel();

  // ---------- Event handlers ----------
  btnSaveQuarter.addEventListener('click', ()=>{
    save({refresh:true});
    downloadJSON(quarterSnapshot(activeQ), `tax-quarter-${activeQ+1}.json`);
  });

  btnPNG.addEventListener('click', ()=>{
    const png = renderQuarterPNG(activeQ);
    const a = document.createElement('a');
    a.href = png;
    a.download = `tax-quarter-${activeQ+1}.png`;
    a.click();
  });

  btnGrandTotal.addEventListener('click', ()=>{
    const total = annualGrandTotal();
    alert(`Annual Grand Total (Columns 2–9, all months):\n₱ ${fmt(total)}`);
  });

  // ---------- Core render ----------
  function renderQuarter(){
    const q = QUARTERS[activeQ];
    // Table head
    const thead = `
      <thead>
        <tr>
          <th>#</th>
          <th>MONTH</th>
          ${CATS.map(c=>`<th>${c}<br><span class="muted">up to 7 entries</span></th>`).join('')}
          <th>REMARKS</th>
        </tr>
      </thead>`;
    // Rows per month
    const rows = q.months.map((mIdx, rowi)=>{
      const m = MONTHS[mIdx];
      return `
        <tr data-month="${mIdx}">
          <td class="center">${rowi+1}</td>
          <td class="month">${m}</td>
          ${CATS.map(cat=>{
            const inputs = getMonthCatValues(mIdx, cat);
            const cells = Array.from({length:7}).map((_,i)=>{
              const val = inputs[i] ?? '';
              return `<input type="number" inputmode="decimal" step="any" placeholder="S${i+1}" data-cat="${cat}" data-month="${mIdx}" data-slot="${i}" value="${val}">`;
            }).join('');
            return `<td><div class="stack">${cells}</div></td>`;
          }).join('')}
          <td class="remarks">${renderRemarks(mIdx)}</td>
        </tr>`;
    }).join('');

    // Quarter subtotal row for columns 2–9
    const sumRow = `
      <tfoot>
        <tr class="sumrow">
          <td colspan="2">Quarter Totals</td>
          ${CATS.map(cat=>{
            const s = sumQuarterCategory(activeQ, cat);
            return `<td class="sumcell">₱ ${fmt(s)}</td>`;
          }).join('')}
          <td class="sumcell center">—</td>
        </tr>
      </tfoot>`;

    table.innerHTML = `${thead}<tbody>${rows}</tbody>${sumRow}`;

    // Wire inputs
    table.querySelectorAll('input[type="number"]').forEach(inp=>{
      inp.addEventListener('input', onValueEdit);
      inp.addEventListener('change', onValueEdit);
    });
    table.querySelectorAll('textarea[data-remarks]').forEach(ta=>{
      ta.addEventListener('input', onRemarksEdit);
      ta.addEventListener('change', onRemarksEdit);
    });
  }

  function renderRemarks(mIdx){
    const txt = data.months[mIdx].remarks || '';
    return `<textarea data-remarks="${mIdx}" placeholder="Notes / reminders...">${txt}</textarea>`;
  }

  // ---------- Data helpers ----------
  function makeEmptyYear(){
    const months = MONTHS.map(()=> ({
      remarks:"",
      categories: Object.fromEntries(CATS.map(c=>[c, Array(7).fill("")]))
    }));
    return { months };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){
      console.warn('load error', e);
      return null;
    }
  }

  function save(opts={refresh:false}){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      updateGrandTotalLabel();
      updateQuarterTotals(activeQ);
      if (opts.refresh) renderQuarter();
    }catch(e){
      alert('Save failed: ' + e.message);
    }
  }

  function onValueEdit(e){
    const el = e.currentTarget;
    const cat = el.dataset.cat;
    const m = parseInt(el.dataset.month,10);
    const slot = parseInt(el.dataset.slot,10);
    const v = el.value.trim();
    data.months[m].categories[cat][slot] = v;
    autosave();
  }

  function onRemarksEdit(e){
    const el = e.currentTarget;
    const m = parseInt(el.dataset.remarks,10);
    data.months[m].remarks = el.value;
    autosave();
  }

  function autosave(){
    if (autosave._t) cancelAnimationFrame(autosave._t);
    autosave._t = requestAnimationFrame(()=> save({refresh:false}));
  }

  function getMonthCatValues(mIdx, cat){
    return data.months[mIdx].categories[cat] || Array(7).fill("");
  }

  function num(x){
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : 0;
  }

  function sumMonthCategory(mIdx, cat){
    return getMonthCatValues(mIdx, cat).reduce((a,b)=>a+num(b),0);
  }

  function sumQuarterCategory(qIdx, cat){
    const mIdxs = QUARTERS[qIdx].months;
    return mIdxs.reduce((acc, m)=> acc + sumMonthCategory(m, cat), 0);
  }

  
  function updateQuarterTotals(qIdx){
    const foot = table.querySelector('tfoot');
    if (!foot) return;
    const cells = foot.querySelectorAll('.sumcell');
    // First CATS.length cells correspond to categories
    CATS.forEach((cat, i)=>{
      const s = sumQuarterCategory(qIdx, cat);
      const cell = cells[i];
      if (cell) cell.textContent = `₱ ${fmt(s)}`;
    });
  }

  function quarterSnapshot(qIdx){
    const mIdxs = QUARTERS[qIdx].months;
    return {
      quarter: qIdx+1,
      months: mIdxs.map(m=> ({
        month: MONTHS[m],
        remarks: data.months[m].remarks,
        categories: Object.fromEntries(CATS.map(c=>[c, data.months[m].categories[c].map(v=> (v===""? "": +Number(v)))]))
      })),
      quarterTotals: Object.fromEntries(CATS.map(c=>[c, sumQuarterCategory(qIdx,c)])),
      generatedAt: new Date().toISOString()
    };
  }

  function annualGrandTotal(){
    let total = 0;
    for (let m=0;m<12;m++){
      for (const c of CATS){
        total += sumMonthCategory(m,c);
      }
    }
    return total;
  }

  function updateGrandTotalLabel(){
    const t = annualGrandTotal();
    grandSpan.textContent = `₱ ${fmt(t)}`;
  }

  function fmt(n){
    return n.toLocaleString(undefined,{maximumFractionDigits:2});
  }

  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- PNG export ----------
  function renderQuarterPNG(qIdx){
    const pad = 24;
    const cellH = 26;
    const headerH = 44;
    const catCols = CATS.length;
    const stackCols = 7;
    const colW = { idx: 36, month: 70, catSlot: 90, remarks: 260 };
    const catTotalWidth = catCols * (stackCols * colW.catSlot);
    const width = pad*2 + colW.idx + colW.month + catTotalWidth + colW.remarks;
    const rows = 3; // months per quarter
    const height = pad*2 + headerH + rows * cellH + headerH;

    const c = document.createElement('canvas');
    c.width = Math.max(1400, width);
    c.height = height;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.translate(pad,pad);
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillStyle = '#e5e7eb';

    let x = 0, y = 16;
    ctx.fillText(`Quarter ${qIdx+1} Summary — ${["JAN–MAR","APR–JUN","JUL–SEP","OCT–DEC"][qIdx]}`, 0, y);
    y += 12;

    const drawCell = (txt, w, h, align='left', bold=false, bg=null) =>{
      if (bg){ ctx.fillStyle = bg; ctx.fillRect(x,y, w,h); ctx.fillStyle = '#e5e7eb'; }
      ctx.font = (bold?'bold ':'') + '13px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.strokeStyle = '#1b2439';
      ctx.strokeRect(x,y,w,h);
      ctx.save();
      const tx = align==='center' ? x + w/2 : (align==='right' ? x + w - 6 : x + 6);
      const ty = y + h/2 + 1;
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      // trim very long text
      const text = String(txt);
      ctx.fillText(text.length>120? text.slice(0,117)+'…' : text, tx, ty);
      ctx.restore();
      x += w;
    };

    // header
    y += 12; x=0;
    drawCell('#', colW.idx, headerH, 'center', true, '#0d1426');
    drawCell('MONTH', colW.month, headerH, 'center', true, '#0d1426');
    for (const cat of ["DDV IN","DDV OPD","BFD IN","BFD OPD","NGH","TMCP","OTHERS","PROJECTS"]){
      const w = colW.catSlot * 7;
      drawCell(cat+' (7 slots)', w, headerH, 'center', true, '#0d1426');
    }
    drawCell('REMARKS', colW.remarks, headerH, 'center', true, '#0d1426');

    // body rows
    y += headerH; x = 0;
    const QUARTERS_LOCAL = [
      { months:[0,1,2] }, { months:[3,4,5] }, { months:[6,7,8] }, { months:[9,10,11] }
    ];
    QUARTERS_LOCAL[qIdx].months.forEach((mIdx, i)=>{
      x=0;
      drawCell(String(i+1), colW.idx, cellH, 'center');
      drawCell(MONTHS[mIdx], colW.month, cellH, 'center');
      for (const cat of ["DDV IN","DDV OPD","BFD IN","BFD OPD","NGH","TMCP","OTHERS","PROJECTS"]){
        const slots = (data.months[mIdx].categories[cat]||[]).map(v=>v===""?"":Number(v));
        const txt = slots.map(v=> v=== "" ? "" : v).join(', ');
        drawCell(txt, colW.catSlot*7, cellH, 'left');
      }
      const r = data.months[mIdx].remarks || '';
      drawCell(r, colW.remarks, cellH, 'left');
      y += cellH;
    });

    // totals
    x=0;
    drawCell('Quarter Totals', colW.idx+colW.month, headerH, 'left', true, '#0d1426');
    for (const cat of ["DDV IN","DDV OPD","BFD IN","BFD OPD","NGH","TMCP","OTHERS","PROJECTS"]){
      const s = sumQuarterCategory(qIdx, cat);
      drawCell(`₱ ${fmt(s)}`, colW.catSlot*7, headerH, 'right', true, '#0d1426');
    }
    drawCell('—', colW.remarks, headerH, 'center', true, '#0d1426');

    return c.toDataURL('image/png');
  }

  // ---------- PWA ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', ()=> {
      navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
    });
  }
})();
