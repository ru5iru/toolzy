import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Download, Minimize2, Wand2, Database } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { AboutTool } from "@/components/AboutTool";
import { format as sqlFormat } from "sql-formatter";

type Dialect =
  | "sql" | "mysql" | "postgresql" | "sqlite" | "mariadb"
  | "tsql" | "plsql" | "bigquery" | "redshift" | "snowflake"
  | "spark" | "hive" | "clickhouse" | "duckdb" | "trino";

type KeywordCase = "upper" | "lower" | "preserve";
type IndentSize = "2" | "4" | "tab";

const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "sql", label: "Generic SQL" },
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mariadb", label: "MariaDB" },
  { value: "tsql", label: "T-SQL (SQL Server)" },
  { value: "plsql", label: "PL/SQL (Oracle)" },
  { value: "bigquery", label: "BigQuery" },
  { value: "redshift", label: "Redshift" },
  { value: "snowflake", label: "Snowflake" },
  { value: "spark", label: "Spark SQL" },
  { value: "hive", label: "Hive" },
  { value: "clickhouse", label: "ClickHouse" },
  { value: "duckdb", label: "DuckDB" },
  { value: "trino", label: "Trino" },
];

const SAMPLE_SQL = `SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.created_at >= '2024-01-01' AND u.status = 'active' GROUP BY u.id, u.name, u.email HAVING COUNT(o.id) > 0 ORDER BY total_spent DESC LIMIT 50;`;

const SqlFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [dialect, setDialect] = useState<Dialect>("sql");
  const [keywordCase, setKeywordCase] = useState<KeywordCase>("upper");
  const [indentSize, setIndentSize] = useState<IndentSize>("2");
  const [error, setError] = useState<string | null>(null);

  const doFormat = useCallback((sql: string) => {
    if (!sql.trim()) { setOutput(""); setError(null); return; }
    try {
      const result = sqlFormat(sql, {
        language: dialect,
        tabWidth: indentSize === "tab" ? 2 : Number(indentSize),
        useTabs: indentSize === "tab",
        keywordCase,
        indentStyle: "standard",
      });
      setOutput(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to format SQL");
      setOutput("");
    }
  }, [dialect, keywordCase, indentSize]);

  const doMinify = useCallback(() => {
    if (!input.trim()) return;
    try {
      const result = sqlFormat(input, {
        language: dialect,
        keywordCase,
        newlineBeforeSemicolon: false,
      });
      // Collapse to single line, compress whitespace
      const minified = result.replace(/\s+/g, " ").trim();
      setOutput(minified);
      setError(null);
      toast.success("SQL minified");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to minify SQL");
      setOutput("");
    }
  }, [input, dialect, keywordCase]);

  // Auto-reformat when options change if we already have output
  useEffect(() => {
    if (output && input.trim()) doFormat(input);
  }, [dialect, keywordCase, indentSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormat = () => {
    doFormat(input);
    toast.success("SQL formatted");
  };

  const handleLoadSample = () => {
    setInput(SAMPLE_SQL);
    doFormat(SAMPLE_SQL);
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formatted.sql";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded formatted.sql");
  };

  const lineCount = output ? output.split("\n").length : 0;
  const charCount = output.length;

  const toolbar = (
    <>
      <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
        <SelectTrigger className="h-8 w-[160px] text-xs">
          <Database className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIALECTS.map((d) => (
            <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={keywordCase} onValueChange={(v) => setKeywordCase(v as KeywordCase)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="upper" className="text-xs">UPPERCASE</SelectItem>
          <SelectItem value="lower" className="text-xs">lowercase</SelectItem>
          <SelectItem value="preserve" className="text-xs">Preserve case</SelectItem>
        </SelectContent>
      </Select>

      <Select value={indentSize} onValueChange={(v) => setIndentSize(v as IndentSize)}>
        <SelectTrigger className="h-8 w-[100px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2" className="text-xs">2 spaces</SelectItem>
          <SelectItem value="4" className="text-xs">4 spaces</SelectItem>
          <SelectItem value="tab" className="text-xs">Tabs</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleLoadSample}>
          Load sample
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={doMinify} disabled={!input.trim()}>
          <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
          Minify
        </Button>
        <Button size="sm" className="h-8 text-xs" onClick={handleFormat} disabled={!input.trim()}>
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Format
        </Button>
      </div>
    </>
  );

  return (
    <ToolPageLayout
      title="SQL Formatter"
      description="Format and minify SQL queries for any dialect — runs entirely in your browser"
      toolbar={toolbar}
    >
      <ToolSEO
        title="SQL Formatter — Free Online SQL Beautifier"
        description="Format, beautify and minify SQL queries for MySQL, PostgreSQL, SQLite, T-SQL, Oracle PL/SQL, BigQuery, Snowflake and more. Free, browser-only, nothing uploaded."
        canonicalPath="/sql"
        keywords={["sql formatter", "sql beautifier", "sql minifier", "mysql formatter", "postgresql formatter", "online sql formatter"]}
      />

      <div className="h-[clamp(400px,calc(100dvh-200px),900px)]">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border border-border">
          {/* Input */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Input</span>
                <span className="text-xs text-muted-foreground">
                  {input.length > 0 && `${input.length} chars`}
                </span>
              </div>
              <textarea
                className="h-full w-full resize-none bg-card p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={"Paste your SQL here…\n\nSupports SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, and more."}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Output */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Output</span>
                <div className="flex items-center gap-2">
                  {output && (
                    <span className="text-xs text-muted-foreground">{lineCount} lines · {charCount} chars</span>
                  )}
                  <CopyButton value={output} disabled={!output} size="sm" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} disabled={!output} aria-label="Download SQL">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="relative h-full overflow-auto">
                {error ? (
                  <div className="p-3">
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive" role="alert">
                      {error}
                    </p>
                  </div>
                ) : output ? (
                  <pre className="h-full p-3 font-mono text-xs text-foreground whitespace-pre">{output}</pre>
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <p className="text-xs text-muted-foreground">Formatted SQL will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <AboutTool>
        <p>SQL Formatter uses the open-source <code>sql-formatter</code> library to parse and reformat SQL queries according to dialect-specific syntax rules. It supports 15 dialects including MySQL, PostgreSQL, SQLite, T-SQL (SQL Server), Oracle PL/SQL, BigQuery, Snowflake, ClickHouse, and more.</p>
        <p className="mt-2">Keyword casing controls whether reserved words like SELECT, FROM, WHERE are uppercased, lowercased, or left as-is. Indentation can be set to 2 spaces, 4 spaces, or tabs. Minify removes all unnecessary whitespace.</p>
        <p className="mt-2">Everything runs in your browser — SQL is never sent to any server.</p>
      </AboutTool>
    </ToolPageLayout>
  );
};

export default SqlFormatter;
