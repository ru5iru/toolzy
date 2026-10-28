import type { Faker } from '@faker-js/faker';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface Issue { path: string; message: string }
export const MODULES = ['airline','animal','book','color','commerce','company','database','datatype','date','finance','food','git','hacker','helpers','internet','location','lorem','music','number','person','phone','science','string','system','vehicle','word'] as const;
export const MAX_BYTES = 10 * 1024 * 1024;
const BLOCKED = new Set(['constructor','__proto__','prototype','seed','setDefaultRefDate','locale','fake','uniqueArray','shuffle','multiple']);
function guardArgs(value:unknown,depth=0,key=''):void {
 if(depth>10)throw new Error('Argument nesting limit exceeded');
 if(typeof value==='number'&&(!Number.isFinite(value)||(['length','count','repeat'].includes(key)&&value>1000)))throw new Error('Argument resource limit exceeded');
 if(typeof value==='string'&&value.length>10000)throw new Error('Argument string too large');
 if(Array.isArray(value)){if(value.length>1000)throw new Error('Argument array too large');value.forEach(v=>guardArgs(v,depth+1));}
 else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))guardArgs(v,depth+1,k);
}
function guardRegex(pattern:string):void {
 if(pattern.length>256||/[()*+?|]/.test(pattern)||/\{\d{4,}/.test(pattern)||/\{\d+,\d{4,}/.test(pattern))throw new Error('Regex supports bounded character classes and quantifiers only');
 try{new RegExp(pattern);}catch{throw new Error('Invalid $regex');}
}
export const defaults: Record<string,string> = {
 'number.int':'{"min":18,"max":65}', 'number.float':'{"min":0,"max":100,"fractionDigits":2}',
 'date.between':'{"from":"2025-01-01","to":"2026-01-01"}', 'date.past':'{"years":1}',
 'string.alphanumeric':'8','lorem.paragraphs':'2','helpers.arrayElement':'["a","b","c"]',
 'helpers.weightedArrayElement':'[{"weight":3,"value":"a"},{"weight":1,"value":"b"}]',
 'helpers.fromRegExp':'"[A-Z]{3}-\\\\d{4}"',
};
export function method(faker: Faker, path: string): (...args: unknown[]) => unknown {
 const parts = path.split('.');
 if (parts.length !== 2 || !MODULES.some(m => m === parts[0]) || parts.some(p => BLOCKED.has(p))) throw new Error(`Blocked or unknown method: ${path}`);
 const module = (faker as unknown as Record<string,unknown>)[parts[0]];
 if (!module || typeof module !== 'object') throw new Error(`Unknown module: ${parts[0]}`);
 const fn = (module as Record<string,unknown>)[parts[1]];
 if (!Object.prototype.hasOwnProperty.call(module,parts[1]) || typeof fn !== 'function') throw new Error(`Unknown method: ${path}`);
 return (...args) => {args.forEach(v=>guardArgs(v));if(path==='helpers.fromRegExp'&&typeof args[0]==='string')guardRegex(args[0]);return Reflect.apply(fn,module,args) as unknown;};
}
export function methods(faker: Faker): string[] {
 return MODULES.flatMap(m => Object.keys((faker as unknown as Record<string,object>)[m] || {}).map(k=>`${m}.${k}`).filter(p=>{try {method(faker,p);return true;} catch{return false;}}));
}
interface Token { start: number; end: number; body: string }
function tokens(text: string): Token[] {
 const result: Token[]=[]; let pos=0;
 while ((pos=text.indexOf('{{',pos))>=0) {
  const start=pos; pos+=2; let quoted=false, escaped=false, depth=0, end=-1;
  for (;pos<text.length;pos++) {
   const c=text[pos];
   if(quoted){if(escaped) escaped=false; else if(c==='\\') escaped=true;else if(c==='"') quoted=false;continue;}
   if(c==='"'){quoted=true;continue;}
   if(depth===0 && text.slice(pos,pos+2)==='}}'){end=pos;break;}
   if(c==='{'||c==='['||c==='(')depth++;
   if(c==='}'||c===']'||c===')')depth--;
  }
  if(end<0)throw new Error('Unclosed token');
  result.push({start,end:end+2,body:text.slice(start+2,end).trim()});pos=end+2;
 }
 return result;
}
function parse(body:string): {path:string;args:unknown[]} {
 const match=/^([A-Za-z]+\.[A-Za-z][A-Za-z0-9]*)(?:\((.*)\))?$/s.exec(body);
 if(!match)throw new Error(`Invalid token: ${body}`);
 let args:unknown[]=[];
 if(match[2]?.trim()){try{args=JSON.parse(`[${match[2]}]`) as unknown[];}catch{throw new Error('Arguments must be valid JSON');}}
 const serialized=JSON.stringify(args);
 if(serialized.length>10000)throw new Error('Arguments too large');
 if(/"(?:length|count|repeat)"\s*:\s*(\d{5,})/.test(serialized) || args.some(v=>typeof v==='number'&&Math.abs(v)>10000))throw new Error('Argument resource limit exceeded');
 return {path:match[1],args};
}
function object(value: Json): value is {[key:string]:Json} {return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function spec(value:Json,key:string): {[key:string]:Json} {if(!object(value))throw new Error(`${key} requires an object`);return value;}
function directive(node:{[key:string]:Json}): string|undefined {
 const keys=Object.keys(node).filter(k=>k.startsWith('$')&&k!=='$unique');
 if(keys.length>1)throw new Error('Use one directive per value');
 if(node.$unique!==undefined && node.$unique!==true)throw new Error('$unique must be true');
 if(keys.length && !['$repeat','$pick','$weighted','$maybe','$regex','$value'].includes(keys[0]))throw new Error(`Unknown directive: ${keys[0]}`);
 if(keys.length && Object.keys(node).some(k=>k!==keys[0]&&k!=='$unique'))throw new Error('Directive objects cannot contain ordinary fields');
 if(node.$unique===true&&!keys.length)throw new Error('$unique requires $value or a directive');
 return keys[0];
}
export function validateTemplate(template: Json, faker: Faker): Issue[] {
 const errors:Issue[]=[];
 let visited=0;
 if(JSON.stringify(template).length>100000)return [{path:'$',message:'Template exceeds 100 KB'}];
 function walk(node:Json,path:string,depth:number,siblings?:string[],prior?:string[]){
  if(visited>10000)return;
  try{
   if(++visited>10000)throw new Error('Template node limit exceeded');
   if(depth>20)throw new Error('Maximum nesting depth is 20');
   if(typeof node==='string')for(const t of tokens(node)){
    if(t.body==='$index'||t.body==='$index1')continue;
    if(t.body.startsWith('$.')){const field=t.body.slice(2);if(!prior?.includes(field))throw new Error(siblings?.includes(field)?`Forward or cyclic reference: ${field}; fields resolve in declaration order`:`Missing sibling: ${field}`);continue;}
    const p=parse(t.body);p.args.forEach(v=>guardArgs(v));method(faker,p.path);
   }
   if(Array.isArray(node))node.forEach((v,i)=>walk(v,`${path}[${i}]`,depth+1,siblings,prior));
   if(object(node)){
    const key=directive(node);
    if(key){const v=node[key];
     if(key==='$repeat'){const s=spec(v,key);if(!Number.isInteger(s.min)||!Number.isInteger(s.max)||Number(s.min)<0||Number(s.max)>1000||Number(s.min)>Number(s.max)||!Object.prototype.hasOwnProperty.call(s,'of'))throw new Error('Invalid $repeat: min/max must be 0–1000 and of is required');walk(s.of,`${path}.$repeat.of`,depth+1,siblings,prior);}
     if(key==='$pick'){if(!Array.isArray(v)||!v.length)throw new Error('$pick requires a nonempty array');v.forEach((x,i)=>walk(x,`${path}.$pick[${i}]`,depth+1,siblings,prior));}
     if(key==='$weighted'){if(!Array.isArray(v)||!v.length||v.some(x=>!object(x)||typeof x.weight!=='number'||!Number.isFinite(x.weight)||x.weight<=0||!Object.prototype.hasOwnProperty.call(x,'value')))throw new Error('$weighted requires positive weights and values');v.forEach((x,i)=>{if(object(x))walk(x.value,`${path}.$weighted[${i}].value`,depth+1,siblings,prior);});}
     if(key==='$maybe'){const s=spec(v,key);if(typeof s.probability!=='number'||s.probability<0||s.probability>1||!Object.prototype.hasOwnProperty.call(s,'value'))throw new Error('$maybe probability must be 0–1 with a value');walk(s.value,`${path}.$maybe.value`,depth+1,siblings,prior);}
     if(key==='$regex'){if(typeof v!=='string')throw new Error('$regex requires a string');guardRegex(v);}
     if(key==='$value')walk(v,`${path}.$value`,depth+1,siblings,prior);
    }else {const names=Object.keys(node);const done:string[]=[];for(const k of names){walk(node[k],`${path}.${k}`,depth+1,names,done);done.push(k);}}
   }
  }catch(e){errors.push({path,message:e instanceof Error?e.message:'Invalid template'});}
 }
 if(!object(template)&&!Array.isArray(template))return [{path:'$',message:'Template root must be an object or array'}];
 walk(template,'$',0);return errors;
}
function normalize(value:unknown): Json {
 if(value instanceof Date)return value.toISOString();
 if(value===null)return null;
 if(typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v)]));
 throw new Error('Method returned a non-JSON value');
}
export function generateBatch(template:Json,count:number,faker:Faker):Json[] {
 if(!Number.isInteger(count)||count<1||count>1000)throw new Error('Count must be 1–1000');
 const issues=validateTemplate(template,faker);if(issues.length)throw new Error(issues.map(e=>`${e.path}: ${e.message}`).join('\n'));
 const sets=new Map<string,Set<string>>();let nodes=0;let leafBytes=0;
 const budget=(value:Json):Json=>{leafBytes+=new TextEncoder().encode(JSON.stringify(value)).length;if(leafBytes>MAX_BYTES)throw new Error('Maximum output size is 10 MiB');return value;};
 const resolve=(node:Json,path:string,index:number,siblings:Record<string,Json>={},depth=0):Json=>{
  if(++nodes>500000||depth>20)throw new Error(`${path}: generation resource limit exceeded`);
  if(typeof node==='string'){
   const list=tokens(node);const call=(body:string):Json=>{
    if(body==='$index')return index;if(body==='$index1')return index+1;
    if(body.startsWith('$.')){const key=body.slice(2);if(!Object.prototype.hasOwnProperty.call(siblings,key))throw new Error(`${path}: unresolved or cyclic reference ${key}`);return siblings[key];}
    const p=parse(body);return normalize(method(faker,p.path)(...p.args));
   };
   if(list.length===1&&list[0].start===0&&list[0].end===node.length)return budget(call(list[0].body));
   let out='',cursor=0;for(const t of list){out+=node.slice(cursor,t.start);if(t.body.startsWith('$')){const value=call(t.body);out+=typeof value==='object'?JSON.stringify(value):String(value);}else{out+=faker.helpers.fake(node.slice(t.start,t.end));}cursor=t.end;}out+=node.slice(cursor);
   return budget(out);
  }
  if(Array.isArray(node))return node.map((v,i)=>resolve(v,`${path}[${i}]`,index,siblings,depth+1));
  if(!object(node))return budget(node);
  const key=directive(node);
  const run=():Json=>{
   if(key){const v=node[key];
    if(key==='$value')return resolve(v,path,index,siblings,depth+1);
    if(key==='$repeat'){const s=spec(v,key);const n=faker.number.int({min:Number(s.min),max:Number(s.max)});return Array.from({length:n},()=>resolve(s.of,`${path}[]`,index,siblings,depth+1));}
    if(key==='$pick')return resolve(faker.helpers.arrayElement(v as Json[]),path,index,siblings,depth+1);
    if(key==='$weighted')return resolve(faker.helpers.weightedArrayElement(v as {weight:number;value:Json}[]),path,index,siblings,depth+1);
    if(key==='$maybe'){const s=spec(v,key);return faker.helpers.maybe(()=>resolve(s.value,path,index,siblings,depth+1),{probability:Number(s.probability)})??null;}
    if(key==='$regex')return budget(faker.helpers.fromRegExp((v as string).replace(/\\d/g,'[0-9]').replace(/\\w/g,'[A-Za-z0-9_]').replace(/\\s/g,'[ ]')));
   }
   const record:Record<string,Json>=Object.create(null) as Record<string,Json>;for(const [k,v]of Object.entries(node))record[k]=resolve(v,`${path}.${k}`,index,record,depth+1);return record;
  };
  if(node.$unique===true){const seen=sets.get(path)??new Set<string>();sets.set(path,seen);for(let i=0;i<100;i++){const value=run();const encoded=JSON.stringify(value);if(!seen.has(encoded)){seen.add(encoded);return value;}}throw new Error(`${path}: uniqueness pool exhausted after 100 retries`);}
  return run();
 };
 const batch:Json[]=[];let bytes=2;for(let i=0;i<count;i++){const record=resolve(template,'$',i);bytes+=new TextEncoder().encode(JSON.stringify(record)).length+1;if(bytes>MAX_BYTES)throw new Error('Maximum output size is 10 MiB');batch.push(record);}return batch;
}
