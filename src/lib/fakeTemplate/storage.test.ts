import { it,expect } from 'vitest';
import { encodeShare,decodeShare,writeTemplates,readTemplates } from './storage';
it('shares unicode templates and options locally',()=>{const v={template:{name:'日本語'},options:{count:5,locale:'ja',seed:3,refDate:'2026-01-01'}};expect(decodeShare(encodeShare(v))).toEqual(v);});
it('saves and reads templates',()=>{const templates=[{id:'1',name:'Test',template:{n:1}}];writeTemplates(templates);expect(readTemplates()).toEqual(templates);});