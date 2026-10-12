export function csvRows(t){return t.split(/\r?\n/).filter(l=>l.trim()).map(l=>{const sep=l.includes('\t')?'\t':(l.includes(';')&&!l.includes(',')?';':',');const o=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===sep&&!q){o.push(c.trim());c=''}else c+=ch}o.push(c.trim());return o})}
export function parseRows(rows){const cl=v=>String(v==null?'':v).trim();rows=rows.filter(r=>r&&r.some(c=>cl(c)));if(!rows.length)return[];
  const h=rows[0].map(x=>cl(x).toLowerCase()),hasH=/student|id|name|nick|position/.test(h.join(' '));let si=0,ni=1,ki=2,pi=3;
  if(hasH){const f=(re,not)=>h.findIndex(x=>re.test(x)&&!(not&&not.test(x))),a=f(/student|\bid\b|number|no\./),b=f(/name/,/nick/),c=f(/nick/),d=f(/position|role/);si=a>=0?a:0;ni=b>=0?b:1;ki=c>=0?c:2;pi=d}
  return rows.slice(hasH?1:0).map(r=>({sid:cl(r[si]),name:cl(r[ni]),nick:cl(r[ki]),pos:pi>=0?cl(r[pi]):''})).filter(x=>x.sid&&x.name)}
export function parseSheet(t){return parseRows(csvRows(t))}
