import type { Json } from './engine';
export interface Field { id:string; name:string; method:string; params:string; nullable:number; unique:boolean; value:Json }
export interface BuilderState { array:boolean; fields:Field[] }
function obj(v:Json):v is Record<string,Json>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
export function toBuilder(template:Json):BuilderState {
 const array=Array.isArray(template);
 const entries=array?template.map((v,i)=>[String(i),v] as const):obj(template)?Object.entries(template):[];
 return {array,fields:entries.map(([name,original],i)=>{
  let value=original,unique=false,nullable=0;
  if(obj(value)&&value.$unique===true){unique=true;const copy={...value};delete copy.$unique;value=Object.keys(copy).length===1&&'$value'in copy?copy.$value:copy;}
  if(obj(value)&&obj(value.$maybe)){nullable=Math.round((1-Number(value.$maybe.probability))*100);value=value.$maybe.value;}
  const match=typeof value==='string'?/^\{\{([A-Za-z]+\.[A-Za-z][A-Za-z0-9]*)(?:\((.*)\))?\}\}$/s.exec(value):null;
  return {id:`field-${i}`,name,method:match?.[1]||'custom',params:match?.[2]||'',nullable,unique,value};
 })};
}
export function fromBuilder(state:BuilderState):Json {
 const names=new Set<string>();
 const values=state.fields.map(field=>{
  if(!state.array){if(!field.name||field.name.startsWith('$')||names.has(field.name))throw new Error('Field names must be nonempty, distinct, and not start with $');names.add(field.name);}
  let value:Json=field.method==='custom'?field.value:`{{${field.method}${field.params?`(${field.params})`:''}}}`;
  if(field.nullable>0)value={$maybe:{probability:1-field.nullable/100,value}};
  if(field.unique)value={$value:value,$unique:true};
  return value;
 });
 return state.array?values:Object.fromEntries(state.fields.map((f,i)=>[f.name,values[i]]));
}