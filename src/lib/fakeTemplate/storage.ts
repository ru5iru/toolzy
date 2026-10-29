import { compressToBase64, decompressFromBase64 } from 'lz-string';
import type { Json } from './engine';
import type { Options } from './run';
export interface SavedTemplate {id:string;name:string;template:Json}
export interface SharedTemplate {template:Json;options:Options}
const KEY='toolzy.fakeTemplates.v1';
export const MAX_TEMPLATE=100000;
export function readTemplates():SavedTemplate[]{try{const text=localStorage.getItem(KEY)||'[]';if(text.length>1000000)return [];const value:unknown=JSON.parse(text);if(!Array.isArray(value))return [];return value.filter((v:unknown):v is SavedTemplate=>!!v&&typeof v==='object'&&'id'in v&&typeof v.id==='string'&&'name'in v&&typeof v.name==='string'&&'template'in v).slice(0,50);}catch{return [];}}
export function writeTemplates(value:SavedTemplate[]):void{if(value.length>50)throw new Error('Maximum 50 saved templates');const text=JSON.stringify(value);if(text.length>1000000)throw new Error('Saved templates exceed storage limit');try{localStorage.setItem(KEY,text);}catch{throw new Error('Browser storage is unavailable or full');}}
export function encodeShare(value:SharedTemplate):string{const text=JSON.stringify(value);if(text.length>MAX_TEMPLATE)throw new Error('Template too large to share');const hash=`#template=${encodeURIComponent(compressToBase64(text))}`;if(hash.length>16000)throw new Error('Share link exceeds 16000 characters; export the template instead');return hash;}
export function decodeShare(hash:string):SharedTemplate|null {
 if(!hash.startsWith('#template='))return null;if(hash.length>16000)throw new Error('Share link too large');
 const compressed=decodeURIComponent(hash.slice(10));
 // Bound compressed input as well as decompressed output.
 if(compressed.length>12000)throw new Error('Share payload too large');
 const text=decompressFromBase64(compressed);if(!text||text.length>MAX_TEMPLATE)throw new Error('Invalid or oversized share link');
 const v:unknown=JSON.parse(text);
 if(!v||typeof v!=='object'||!('template'in v)||!('options'in v)||!v.options||typeof v.options!=='object')throw new Error('Invalid shared template');
 const o=v.options;
 if(!('count'in o)||typeof o.count!=='number'||!Number.isInteger(o.count)||o.count<1||o.count>1000||!('locale'in o)||typeof o.locale!=='string')throw new Error('Invalid shared options');
 const seed='seed'in o?o.seed:undefined,refDate='refDate'in o?o.refDate:undefined;
 if(seed!==undefined&&(typeof seed!=='number'||!Number.isSafeInteger(seed)))throw new Error('Invalid shared seed');
 if(refDate!==undefined&&(typeof refDate!=='string'||!Number.isFinite(Date.parse(refDate))))throw new Error('Invalid shared reference date');
 return {template:v.template as Json,options:{count:o.count,locale:o.locale,seed:seed as number|undefined,refDate:refDate as string|undefined}};
}