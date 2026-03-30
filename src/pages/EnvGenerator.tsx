import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

  const copy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
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
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-mono font-bold text-foreground">Environment Generator</h1>
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
        className="min-h-[300px] font-mono text-sm bg-card border-border resize-none"
      />
      <div className="flex gap-2">
        <Button onClick={copy} disabled={!content}>Copy</Button>
        <Button variant="secondary" onClick={download} disabled={!content}>Download .env</Button>
      </div>
    </div>
  );
};

export default EnvGenerator;
