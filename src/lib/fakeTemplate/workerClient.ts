import { runGeneration, type Options } from './run';
import type { Json } from './engine';
export function generateAsync(template:Json,options:Options,signal:AbortSignal):Promise<Json[]> {
 if(signal.aborted)return Promise.reject(new Error('Generation cancelled'));
 if(options.count<=100)return runGeneration(template,options).then(data=>{if(signal.aborted)throw new Error('Generation cancelled');return data;});
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../../workers/fakeDataWorker.ts',import.meta.url),{type:'module'});
  const finish=(error?:string,data?:Json[])=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(new Error(error));else if(data)resolve(data);else reject(new Error('No worker result'));};
  const abort=()=>finish('Generation cancelled');
  const timer=window.setTimeout(()=>finish('Generation exceeded 30 seconds; reduce count or template complexity'),30000);
  signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=(event:MessageEvent<{data?:Json[];error?:string}>)=>finish(event.data.error,event.data.data);
  worker.onerror=()=>finish('Worker generation failed');
  worker.postMessage({template,options});
 });
}