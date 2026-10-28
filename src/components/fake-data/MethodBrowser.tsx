import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from '@/components/ui/command';
import { createFaker } from '@/lib/fakeTemplate/locales';
import { defaults, methods, generateBatch, MODULES } from '@/lib/fakeTemplate/engine';
import { Plus } from 'lucide-react';
export function methodToken(path:string):string {return `{{${path}${defaults[path]?`(${defaults[path]})`:''}}}`;}
export function MethodBrowser({locale,onInsert,onRow,open,onOpenChange}:{locale:string;onInsert:(token:string)=>void;onRow:(path:string)=>void;open:boolean;onOpenChange:(open:boolean)=>void}) {
 const [entries,setEntries]=useState<{path:string;sample:string}[]>([]);
 useEffect(()=>{if(!open)return;let active=true;
  void createFaker(locale,123).then(faker=>{
   const result=methods(faker).sort().map(path=>{let sample='Parameters required';try{sample=JSON.stringify(generateBatch({v:methodToken(path)},1,faker)[0]);sample=sample.slice(5,-1);}catch{/* Methods requiring parameters stay available. */}return {path,sample};});
   if(active)setEntries(result);
  }).catch(()=>{if(active)setEntries([]);});
  return()=>{active=false;};
 },[open,locale]);
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl w-[calc(100%-2rem)]"><DialogTitle className="font-mono">Faker methods</DialogTitle><DialogDescription>Live samples · {locale}</DialogDescription><Command><CommandInput placeholder="Search Faker methods"/><CommandList className="max-h-[55vh]"><CommandEmpty>No methods found.</CommandEmpty>{MODULES.map(module=><CommandGroup key={module} heading={module}>{entries.filter(e=>e.path.startsWith(`${module}.`)).map(entry=><CommandItem key={entry.path} value={entry.path} onSelect={()=>{onInsert(methodToken(entry.path));onOpenChange(false);}} className="gap-2"><div className="min-w-0 flex-1"><span className="font-mono text-xs">{entry.path}</span><p className="truncate text-xs text-muted-foreground">{entry.sample}</p></div><Button size="sm" variant="outline" onClick={e=>{e.stopPropagation();onInsert(methodToken(entry.path));onOpenChange(false);}}>Insert</Button><Button size="icon" variant="outline" title="Add builder row" aria-label={`Add ${entry.path} builder row`} onClick={e=>{e.stopPropagation();onRow(entry.path);onOpenChange(false);}}><Plus className="w-4 h-4"/></Button></CommandItem>)}</CommandGroup>)}</CommandList></Command></DialogContent></Dialog>;
}