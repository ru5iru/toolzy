import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateAsync } from './workerClient';
class MockWorker {
 static instances:MockWorker[]=[];
 onmessage:((event:MessageEvent)=>void)|null=null;
 onerror:(()=>void)|null=null;
 terminate=vi.fn();postMessage=vi.fn();
 constructor(){MockWorker.instances.push(this);}
}
beforeEach(()=>{vi.useFakeTimers();MockWorker.instances=[];vi.stubGlobal('Worker',MockWorker);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('uses worker only above 100 and cleans up on successful result',async()=>{
 const pending=generateAsync({}, {count:101,locale:'en'},new AbortController().signal);
 const worker=MockWorker.instances[0];expect(worker.postMessage).toHaveBeenCalledWith({template:{},options:{count:101,locale:'en'}});
 worker.onmessage?.({data:{data:[{}]}} as MessageEvent);await expect(pending).resolves.toEqual([{}]);expect(worker.terminate).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
it('cancels stale runs and ignores late results',async()=>{
 const controller=new AbortController();const pending=generateAsync({}, {count:1000,locale:'en'},controller.signal);const assertion=expect(pending).rejects.toThrow('cancelled');
 const worker=MockWorker.instances[0],late=worker.onmessage;controller.abort();late?.({data:{data:[{stale:true}]}} as MessageEvent);await assertion;expect(worker.terminate).toHaveBeenCalledOnce();expect(worker.onmessage).toBeNull();
});
it('times out and terminates the worker',async()=>{
 const pending=generateAsync({}, {count:101,locale:'en'},new AbortController().signal);const assertion=expect(pending).rejects.toThrow('30 seconds');await vi.advanceTimersByTimeAsync(30000);await assertion;expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
});
it('does not create a worker for count 100',async()=>{await expect(generateAsync({}, {count:100,locale:'en',seed:1},new AbortController().signal)).resolves.toHaveLength(100);expect(MockWorker.instances).toHaveLength(0);});