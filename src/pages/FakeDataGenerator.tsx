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
import { runGeneration } from "@/lib/fakeTemplate/run";
import { downloadFile } from "@/components/json-formatter/jsonUtils";
import { MethodBrowser } from "@/components/fake-data/MethodBrowser";
import { TemplateBuilder } from "@/components/fake-data/TemplateBuilder";
import { toBuilder, fromBuilder, type BuilderState } from "@/lib/fakeTemplate/builder";
import { defaults } from "@/lib/fakeTemplate/engine";

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
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState("template");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [targetField, setTargetField] = useState<string>();
  const [builder, setBuilder] = useState<BuilderState>(()=>toBuilder(presets.User));

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
        const parsed = JSON.parse(template) as Json;
        const faker = await createFaker(locale);
        if (active) { const issues=validateTemplate(parsed, faker);setErrors(issues);if(!issues.length)setBuilder(toBuilder(parsed)); }
      } catch (e) { if (active) setErrors([{ path: "$", message: e instanceof Error ? e.message : "Invalid JSON" }]); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [template, locale]);
  useEffect(() => () => { revision.current++; }, []);

  const generate = async () => {
    const id = ++revision.current;
    setBusy(true);
    const started = performance.now();
    try {
      const data = await runGeneration(JSON.parse(template) as Json, {count, locale, seed: seed === "" ? undefined : Number(seed), refDate: refDate || undefined});
      if (id !== revision.current) return;
      setOutput(JSON.stringify(data, null, 2));
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
      <ToolSEO title="Fake Data Generator" description="Generate realistic fake user data in JSON format for testing and development. Includes names, emails, addresses, and UUIDs." canonicalPath="/fake-data" keywords={["fake data generator", "mock data", "test data generator", "random user data", "JSON test data"]} faq={[{question:"What kind of fake data can I generate?",answer:"Generate realistic user profiles with names, emails, phone numbers, addresses, ages, and UUIDs — all in JSON format."},{question:"Can I control how many records are generated?",answer:"Yes, specify any count from 1 to 100 records per generation."},{question:"Is the generated data safe to use in tests?",answer:"Yes. All data is randomly generated in your browser and contains no real personal information."},{question:"What format is the output?",answer:"Output is JSON, ready to copy or use as fixtures in tests, seed scripts, and API mocking."}]} howToSteps={["Set the number of records to generate (1-100)","Click Generate to create fake user data","Click Copy to copy the JSON output"]} />
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
      <div className="flex flex-wrap gap-4"><Button variant="outline" onClick={()=>{setTargetField(undefined);setBrowserOpen(true);}}>Method Browser</Button></div>
      <MethodBrowser locale={locale} open={browserOpen} onOpenChange={setBrowserOpen} onInsert={insertToken} onRow={addMethod}/>
      <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="template">Template</TabsTrigger><TabsTrigger value="builder">Builder</TabsTrigger></TabsList><TabsContent value="template"><Textarea ref={editorRef} aria-label="JSON template" value={template} onChange={e=>setTemplate(e.target.value)} spellCheck={false} className={`min-h-[300px] ${editorStyle}`} /></TabsContent><TabsContent value="builder"><TemplateBuilder state={builder} onChange={changeBuilder} onBrowse={id=>{setTargetField(id);setBrowserOpen(true);}}/></TabsContent></Tabs>
      {errors.length > 0 && <div role="alert" className="text-sm text-destructive space-y-1">{errors.map((e,i)=><p key={i} className="break-words">{e.path}: {e.message}</p>)}</div>}
      <div className="flex flex-wrap items-end gap-4">
        <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button>
        <Button variant="outline" onClick={copy} disabled={!output}><Copy className="w-4 h-4 mr-2" />Copy</Button>
        <Button variant="outline" disabled={!output} onClick={()=>downloadFile(output,"fake-data.json","application/json")}><Download className="w-4 h-4 mr-2" />Download</Button>
      </div>
      {output && (
        <div className="space-y-2"><Textarea aria-label="Generated output" value={output} readOnly className={`min-h-[400px] ${editorStyle}`} /><p className="text-xs text-muted-foreground">{stats.count} records · {new TextEncoder().encode(output).length.toLocaleString()} bytes · {stats.ms.toFixed(1)} ms</p></div>
      )}
    </div>
  );
};

export default FakeDataGenerator;
