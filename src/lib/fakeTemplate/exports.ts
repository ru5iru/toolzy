import { MAX_BYTES, type Json } from './engine';
export type Format='json'|'ndjson'|'csv'|'sql'|'yaml';
export const formats:Record<Format,{extension:string;mime:string}>={json:{extension:'json',mime:'application/json'},ndjson:{extension:'ndjson',mime:'application/x-ndjson'},csv:{extension:'csv',mime:'text/csv'},sql:{extension:'sql',mime:'application/sql'},yaml:{extension:'yaml',mime:'application/yaml'}};
export function flatten(value:Json,prefix='',out:Record<string,Json>=Object.create(null) as Record<string,Json>):Record<string,Json>{
 if(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length){for(const [key,v]of Object.entries(value))flatten(v,prefix?`${prefix}.${key}`:key,out);}
 else out[prefix||'value']=value;
 return out;
}
const cell=(value:Json):string=>value===null?'':typeof value==='object'?JSON.stringify(value):String(value);
export function csvCell(value:Json):string {const raw=cell(value);const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`;}
function sqlValue(value:Json):string {
 if(value===null)return 'NULL';if(typeof value==='number')return String(value);if(typeof value==='boolean')return value?'TRUE':'FALSE';
 return `'${cell(value).replace(/'/g,"''")}'`;
}
function yaml(value:Json,indent=0):string {
 const pad=' '.repeat(indent);
 if(value===null||typeof value!=='object')return `${pad}${JSON.stringify(value)}`;
 if(Array.isArray(value)){if(!value.length)return `${pad}[]`;return value.map(v=>v!==null&&typeof v==='object'?`${pad}-\n${yaml(v,indent+2)}`:`${pad}- ${JSON.stringify(v)}`).join('\n');}
 if(!Object.keys(value).length)return `${pad}{}`;
 return Object.entries(value).map(([k,v])=>v!==null&&typeof v==='object'?`${pad}${JSON.stringify(k)}:\n${yaml(v,indent+2)}`:`${pad}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join('\n');
}
export function exportData(data:Json[],format:Format,table='records'):string {
 let output='';
 if(format==='json')output=JSON.stringify(data,null,2);
 if(format==='ndjson')output=data.map(v=>JSON.stringify(v)).join('\n');
 if(format==='yaml')output=yaml(data);
 if(format==='csv'||format==='sql'){
  const rows=data.map(v=>flatten(v));const columns=[...new Set(rows.flatMap(Object.keys))];
  if(format==='csv')output=[columns.map(csvCell).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c]??null)).join(','))].join('\r\n');
  else {if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))throw new Error('SQL table name must be a plain identifier');
   const identifiers=columns.map(c=>`"${c.replace(/"/g,'""')}"`).join(', ');
   output=rows.map(r=>`INSERT INTO "${table}" (${identifiers}) VALUES (${columns.map(c=>sqlValue(r[c]??null)).join(', ')});`).join('\n');
  }
 }
 if(new TextEncoder().encode(output).length>MAX_BYTES)throw new Error('Formatted output exceeds 10 MiB');return output;
}