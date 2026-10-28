import { runGeneration, type Options } from '../lib/fakeTemplate/run';
import type { Json } from '../lib/fakeTemplate/engine';
self.onmessage=async(event:MessageEvent<{template:Json;options:Options}>)=>{
 try {self.postMessage({data:await runGeneration(event.data.template,event.data.options)});}
 catch(e){self.postMessage({error:e instanceof Error?e.message:'Generation failed'});}
};