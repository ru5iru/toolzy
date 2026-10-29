import { it,expect } from 'vitest';
import { presets } from './presets';
import { runGeneration } from './run';
it('all eight presets generate successfully and User preserves its shape',async()=>{
 expect(Object.keys(presets)).toHaveLength(8);
 for(const template of Object.values(presets))expect(await runGeneration(template,{count:5,locale:'en',seed:42})).toHaveLength(5);
 const [user]=await runGeneration(presets.User,{count:1,locale:'en',seed:42});expect(Object.keys(user as object)).toEqual(['id','name','email','phone','age','address','createdAt']);
});