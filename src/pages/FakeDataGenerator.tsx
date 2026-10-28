import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Download, Copy } from "lucide-react";
import { createFaker, localeIds } from "@/lib/fakeTemplate/locales";
import { validateTemplate, type Json, type Issue } from "@/lib/fakeTemplate/engine";
import { presets } from "@/lib/fakeTemplate/presets";
import { generateAsync } from "@/lib/fakeTemplate/workerClient";
import { downloadFile } from "@/components/json-formatter/jsonUtils";
import { MethodBrowser } from "@/components/fake-data/MethodBrowser";
import { TemplateBuilder } from "@/components/fake-data/TemplateBuilder";
import { toBuilder, fromBuilder, type BuilderState } from "@/lib/fakeTemplate/builder";
import { defaults } from "@/lib/fakeTemplate/engine";
import { exportData, formats, type Format } from "@/lib/fakeTemplate/exports";
import { SavedTemplates } from "@/components/fake-data/SavedTemplates";
import { encodeShare, decodeShare, MAX_TEMPLATE } from "@/lib/fakeTemplate/storage";

const labelStyle = "text-xs text-muted-foreground uppercase tracking-wider";
const editorStyle = "font-mono text-sm bg-card border-border resize-none";

const FakeDataGenerator = () => {
  const [count, setCount] = useState(5);
  const [output, setOutput] = useState("");
  const [template, setTemplate] = useState(JSON.stringify(presets.User, null, 2));
  const [locale, setLocale] = useState("en");
  const [localeSearch, setLocaleSearch] = useState("");
  const [seed, setSeed] = useState("");
  const [refDate, setRefDate] = useState("");
  const [errors, setErrors] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ count: 0, ms: 0 });
  const revision = useRef(0);
  const abortRef = useRef<AbortController>();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState("template");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [targetField, setTargetField] = useState<string>();
  const [builder, setBuilder] = useState<BuilderState>(()=>toBuilder(presets.User));
  const [format, setFormat] = useState<Format>("json");
  const [table, setTable] = useState("records");
  const [preset, setPreset] = useState("User");
  const [records, setRecords] = useState<Json[]>([]);
  const loadTemplate = async (value:Json) => {
    if(JSON.stringify(value).length>MAX_TEMPLATE)throw new Error("Template exceeds 100 KB");
    const issues=validateTemplate(value,await createFaker(locale));
    if(issues.length)throw new Error(issues.map(e=>`${e.path}: ${e.message}`).join("\n"));
    setTemplate(JSON.stringify(value,null,2));setBuilder(toBuilder(value));
  };
  useEffect(()=>{
    try { const shared=decodeShare(window.location.hash);if(!shared)return;
      if(!localeIds.some(l=>l===shared.options.locale))throw new Error("Unsupported shared locale");
      setTemplate(JSON.stringify(shared.template,null,2));setCount(shared.options.count);setLocale(shared.options.locale);setSeed(shared.options.seed===undefined?"":String(shared.options.seed));setRefDate(shared.options.refDate?.slice(0,10)||"");
    }catch(e){setErrors([{path:"$",message:e instanceof Error?e.message:"Invalid share link"}]);}
  },[]);
  useEffect(()=>{if(!records.length)return;try{setOutput(exportData(records,format,table));}catch(e){setOutput("");setErrors([{path:"$",message:e instanceof Error?e.message:"Export failed"}]);}},[records,format,table]);

  const changeBuilder = (state:BuilderState) => {
    setBuilder(state);
    try { setTemplate(JSON.stringify(fromBuilder(state),null,2)); }
    catch(e) { setErrors([{path:"$",message:e instanceof Error?e.message:"Invalid builder"}]); }
  };
  const addMethod = (path:string) => {
    const field = {id:crypto.randomUUID(),name:`field${builder.fields.length+1}`,method:path,params:defaults[path]||"",nullable:0,unique:false,value:null};
    changeBuilder({...builder,fields:targetField?builder.fields.map(f=>f.id===targetField?{...f,method:path,params:defaults[path]||""}:f):[...builder.fields,field]});
    setTargetField(undefined);setTab("builder");
  };
  const insertToken = (token:string) => {
    if(targetField || tab === "builder") { const match=/^\{\{([^({]+)/.exec(token);if(match)addMethod(match[1]);return; }
    const editor=editorRef.current;
    const start=editor?.selectionStart??template.length,end=editor?.selectionEnd??start;
    const escaped=JSON.stringify(token).slice(1,-1);
    setTemplate(template.slice(0,start)+escaped+template.slice(end));
    requestAnimationFrame(()=>{editor?.focus();editor?.setSelectionRange(start+escaped.length,start+escaped.length);});
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        if(template.length>MAX_TEMPLATE)throw new Error("Template exceeds 100 KB");
        const parsed = JSON.parse(template) as Json;
        const faker = await createFaker(locale);
        if (active) { const issues=validateTemplate(parsed, faker);setErrors(issues);if(!issues.length)setBuilder(toBuilder(parsed)); }
      } catch (e) { if (active) setErrors([{ path: "$", message: e instanceof Error ? e.message : "Invalid JSON" }]); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [template, locale]);
  useEffect(() => () => { revision.current++;abortRef.current?.abort(); }, []);
  useEffect(()=>{revision.current++;abortRef.current?.abort();setBusy(false);},[template,count,locale,seed,refDate]);

  const generate = async () => {
    const id = ++revision.current;
    abortRef.current?.abort();const controller=new AbortController();abortRef.current=controller;
    setBusy(true);
    const started = performance.now();
    try {
      const data = await generateAsync(JSON.parse(template) as Json, {count, locale, seed: seed === "" ? undefined : Number(seed), refDate: refDate || undefined},controller.signal);
      if (id !== revision.current) return;
      setOutput(exportData(data,format,table));setRecords(data);
      setStats({count: data.length, ms: performance.now() - started});
      setErrors([]);
      toast.success(`Generated ${data.length} records`);
    } catch(e) { if(id === revision.current) setErrors([{path: "$", message: e instanceof Error ? e.message : "Generation failed"}]); }
    finally { if(id === revision.current) setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(output); toast.success("Copied to clipboard"); }
    catch { toast.error("Clipboard unavailable"); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ToolSEO title="Fake Data Generator" description="Generate 1–1000 records locally with Faker v10 JSON templates, a visual builder, locales, reproducible seeds, and JSON, NDJSON, CSV, SQL or YAML exports." canonicalPath="/fake-data" keywords={["fake data generator", "faker templates", "seeded mock data", "faker locales", "CSV SQL YAML test data", "JSON template builder"]} faq={[{question:"How do templates work?",answer:"Use JSON objects or arrays with Faker tokens, nested repeat, pick, weighted and maybe directives, unique values and ordered sibling references. Single tokens preserve their return types."},{question:"How many records can I generate?",answer:"Generate 1–1000 records per batch, with a 10 MiB output limit. Batches above 100 records run in a browser worker."},{question:"How do I reproduce generated data?",answer:"Use the same template, locale, seed, count and reference date. An omitted reference date defaults to January 1, 2026."},{question:"Which export formats are available?",answer:"Download JSON, NDJSON, CSV with flattened dot paths and formula-safe quoting, standard SQL INSERT statements, or YAML."},{question:"Is data transmitted or stored?",answer:"Generation runs locally. Templates persist only when explicitly saved in browser storage. Share links encode the template and options in a URL fragment; anyone given the link can read them. Static locale assets may be downloaded, but templates and generated records are not sent for processing."}]} howToSteps={["Choose a preset or define a JSON template using the Template or Builder tab","Set count from 1–1000, locale, optional seed and reference date","Click Generate and select JSON, NDJSON, CSV, SQL INSERT or YAML","Copy or download the output, or save and share the template"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground">Fake Data Generator</h1>
      <p className="text-xs text-muted-foreground">Templates and generated data stay in your browser. No data is sent for processing.</p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label htmlFor="fake-count" className={labelStyle}>Count (max 1000)</label>
          <Input id="fake-count" type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={1000} className="w-32 bg-card border-border" />
        </div>
        <div className="space-y-2">
          <label className={labelStyle} id="fake-locale-label">Locale</label>
          <Select value={locale} onValueChange={setLocale}><SelectTrigger aria-labelledby="fake-locale-label" className="w-40 bg-card border-border"><SelectValue /></SelectTrigger><SelectContent><Input aria-label="Search locales" placeholder="Search locales" value={localeSearch} onChange={e=>setLocaleSearch(e.target.value)} onKeyDown={e=>e.stopPropagation()} />{localeIds.filter(l=>l.toLowerCase().includes(localeSearch.toLowerCase())).map(l=><SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-2"><label htmlFor="fake-seed" className={labelStyle}>Seed (optional)</label><div className="flex gap-2"><Input id="fake-seed" type="number" value={seed} onChange={e=>setSeed(e.target.value)} className="w-32 bg-card border-border" /><Button variant="outline" size="icon" title="Randomize seed" aria-label="Randomize seed" onClick={()=>setSeed(String(crypto.getRandomValues(new Uint32Array(1))[0]))}><Shuffle className="w-4 h-4" /></Button></div></div>
        <div className="space-y-2"><label htmlFor="fake-refdate" className={labelStyle}>Reference date (optional)</label><Input id="fake-refdate" type="date" value={refDate} onChange={e=>setRefDate(e.target.value)} className="w-44 bg-card border-border" /></div>
      </div>
      <div className="flex flex-wrap gap-4 items-end"><div className="space-y-2"><label className={labelStyle} id="fake-preset-label">Preset</label><Select value={preset} onValueChange={name=>{void loadTemplate(presets[name]).then(()=>setPreset(name)).catch(e=>toast.error(String(e)));}}><SelectTrigger aria-labelledby="fake-preset-label" className="w-48 bg-card border-border"><SelectValue/></SelectTrigger><SelectContent>{Object.keys(presets).map(name=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" onClick={()=>{setTargetField(undefined);setBrowserOpen(true);}}>Method Browser</Button></div>
      <MethodBrowser locale={locale} open={browserOpen} onOpenChange={setBrowserOpen} onInsert={insertToken} onRow={addMethod}/>
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="template">Template</TabsTrigger><TabsTrigger value="builder">Builder</TabsTrigger></TabsList><TabsContent value="template"><Textarea ref={editorRef} aria-label="JSON template" value={template} onChange={e=>setTemplate(e.target.value)} spellCheck={false} className={`min-h-[300px] ${editorStyle}`} /></TabsContent><TabsContent value="builder"><TemplateBuilder state={builder} onChange={changeBuilder} onBrowse={id=>{setTargetField(id);setBrowserOpen(true);}}/></TabsContent></Tabs>
      {errors.length > 0 && <div role="alert" className="text-sm text-destructive space-y-1">{errors.map((e,i)=><p key={i} className="break-words">{e.path}: {e.message}</p>)}</div>}
      <SavedTemplates template={template} onLoad={loadTemplate} onShare={()=>{void (async()=>{try{const hash=encodeShare({template:JSON.parse(template) as Json,options:{count,locale,seed:seed===""?undefined:Number(seed),refDate:refDate||undefined}});await navigator.clipboard.writeText(`${window.location.origin}/fake-data${hash}`);toast.success("Share link copied");}catch(e){toast.error(e instanceof Error?e.message:"Unable to copy share link");}})();}}/>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2"><label className={labelStyle} id="fake-format-label">Output format</label><Select value={format} onValueChange={v=>setFormat(v as Format)}><SelectTrigger aria-labelledby="fake-format-label" className="w-40 bg-card border-border"><SelectValue/></SelectTrigger><SelectContent>{Object.keys(formats).map(f=><SelectItem key={f} value={f}>{f==='sql'?'SQL INSERT':f.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
        {format==='sql'&&<div className="space-y-2"><label htmlFor="fake-table" className={labelStyle}>Table name</label><Input id="fake-table" value={table} onChange={e=>setTable(e.target.value)} className="w-40 bg-card border-border"/></div>}
        <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
        {busy&&<Button variant="outline" onClick={()=>{revision.current++;abortRef.current?.abort();setBusy(false);}}>Cancel</Button>}
        <Button variant="outline" onClick={copy} disabled={!output}><Copy className="w-4 h-4 mr-2" />Copy</Button>
        <Button variant="outline" disabled={!output} onClick={()=>downloadFile(output,`fake-data.${formats[format].extension}`,formats[format].mime)}><Download className="w-4 h-4 mr-2" />Download</Button>
      </div>
      {output && (
        <div className="space-y-2"><Textarea aria-label="Generated output" value={output} readOnly className={`min-h-[400px] ${editorStyle}`} /><p className="text-xs text-muted-foreground">{stats.count} records · {new TextEncoder().encode(output).length.toLocaleString()} bytes · {stats.ms.toFixed(1)} ms</p></div>
      )}
    </div>
  );
};

export default FakeDataGenerator;
