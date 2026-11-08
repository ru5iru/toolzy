import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { CopyButton } from "@/components/CopyButton";
import { envToJson, jsonToEnv, parseEnv, toExample } from "@/lib/env/envUtils";

const templates: Record<string, string> = {
  Node: `NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug`,
  Laravel: `APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:generated-key-here
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=smtp
MAIL_HOST=mailhog
MAIL_PORT=1025`,
  "Spring Boot": `SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mydb
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=password
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=true
JWT_SECRET=your-secret-key
JWT_EXPIRATION=86400000`,
  "React (Vite)": `VITE_API_URL=http://localhost:3000/api
VITE_APP_TITLE=My App
VITE_ENABLE_ANALYTICS=false`,
  Django: `DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`,
};

const EnvGenerator = () => {
  const [content, setContent] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const loadTemplate = (name: string) => {
    setContent(templates[name]);
    toast.success(`Loaded ${name} template`);
  };

  const addVar = () => {
    if (!newKey.trim()) return;
    const line = `${newKey.trim().toUpperCase()}=${newVal}`;
    setContent((prev) => (prev ? prev + "\n" + line : line));
    setNewKey("");
    setNewVal("");
    toast.success("Variable added");
  };

  const issues = parseEnv(content).issues;
  const convert = (fn: () => string, done: string) => {
    try { setContent(fn()); toast.success(done); } catch (e) { toast.error(e instanceof Error ? e.message : "Conversion failed"); }
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .env file");
  };

  return (
    <ToolPageLayout title="Environment Generator" description="Build and validate .env files from templates · Docker and dotenv formats">
      <ToolSEO title="Environment File Generator" description="Build .env configuration files with pre-built templates for Node.js, Laravel, Spring Boot, React, and Django. Copy or download instantly." canonicalPath="/env" keywords={[".env generator", "environment variables", "dotenv builder", "env file template", "config generator"]} faq={[{question:"What .env templates are available?",answer:"Templates for Node.js, Laravel, Spring Boot, React, and Django with common environment variables pre-filled."},{question:"Can I add custom variables?",answer:"Yes. Add custom key-value pairs using the form below the template selector, or edit the textarea directly."},{question:"Is my configuration data uploaded anywhere?",answer:"No. The .env file is built entirely in your browser — secrets and values never leave your machine."},{question:"How do I download the generated .env file?",answer:"Click the download button to save the output as a .env file, or copy it to your clipboard with one click."}]} howToSteps={["Select a template (Node, Laravel, Spring Boot, React, Django)","Add custom variables using the key-value form","Copy to clipboard or download as a .env file"]} />
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Templates</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(templates).map((t) => (
            <Button key={t} variant="secondary" size="sm" onClick={() => loadTemplate(t)}>{t}</Button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Key</label>
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="MY_VAR" className="w-40 bg-card border-border font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Value</label>
          <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="value" className="w-56 bg-card border-border font-mono" />
        </div>
        <Button variant="outline" size="sm" onClick={addVar}>Add</Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="KEY=value"
        className="code-surface h-[clamp(240px,calc(100dvh-420px),800px)] resize-y bg-card"
      />
      <div className="flex gap-2">
        <CopyButton value={content} label="Copy" variant="default" disabled={!content} />
        <Button variant="secondary" size="sm" onClick={download} disabled={!content}>Download .env</Button>
        <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden />
        <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => toExample(content), "Secret values cleared")} title="Blank secrets, tokens and URLs with credentials">Make .env.example</Button>
        <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => envToJson(content), "Converted to JSON")}>To JSON</Button>
        <Button variant="outline" size="sm" disabled={!content} onClick={() => convert(() => jsonToEnv(content), "Converted to .env")}>From JSON</Button>
      </div>
      {issues.length > 0 && (
        <ul role="status" className="space-y-0.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {issues.slice(0, 6).map((i) => <li key={i}>{i}</li>)}
          {issues.length > 6 && <li>…and {issues.length - 6} more</li>}
        </ul>
      )}
    </ToolPageLayout>
  );
};

export default EnvGenerator;
