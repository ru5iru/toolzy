import { describe,it,expect } from 'vitest';
import { exportData, csvCell } from './exports';
describe('exports',()=>{
 it('flattens CSV and escapes quotes/newlines/formulas',()=>{expect(exportData([{address:{city:'a"b\nc'},v:'=SUM(1)'}],'csv')).toBe('"address.city","v"\r\n"a""b\nc","\'=SUM(1)"');expect(csvCell(' \t+1')).toBe('"\' \t+1"');});
 it('escapes SQL strings and identifiers and maps types',()=>{expect(exportData([{name:"O'Brien",n:3,b:true,z:null,'x"y':'value'}],'sql','users')).toBe('INSERT INTO "users" ("name", "n", "b", "z", "x""y") VALUES (\'O\'\'Brien\', 3, TRUE, NULL, \'value\');');expect(()=>exportData([{}],'sql','bad; DROP')).toThrow('identifier');});
 it('JSON and NDJSON preserve values',()=>{const data=[{n:2},{n:3}];expect(JSON.parse(exportData(data,'json'))).toEqual(data);expect(exportData(data,'ndjson').split('\n').map(s=>JSON.parse(s))).toEqual(data);});
 it('YAML quotes ambiguous strings',()=>{expect(exportData([{v:'yes',a:[null,true]}],'yaml')).toContain('"v": "yes"');});
});