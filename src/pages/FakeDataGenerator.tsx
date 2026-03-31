import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToolSEO } from "@/components/ToolSEO";

const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "Sarah", "Daniel", "Emma", "Chris", "Olivia", "Alex", "Sophia", "Liam", "Mia", "Noah"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "White", "Harris", "Clark", "Lewis"];
const domains = ["example.com", "test.org", "demo.io", "mail.dev", "fake.net"];
const streets = ["Main St", "Oak Ave", "Elm Blvd", "Pine Rd", "Cedar Ln", "Maple Dr", "Park Way", "Lake Ct"];
const cities = ["New York", "London", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto", "Mumbai", "São Paulo", "Cairo"];

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function generatePerson() {
  const first = rand(firstNames);
  const last = rand(lastNames);
  return {
    id: crypto.randomUUID(),
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${rand(domains)}`,
    phone: `+1-${randInt(200, 999)}-${randInt(100, 999)}-${randInt(1000, 9999)}`,
    age: randInt(18, 80),
    address: {
      street: `${randInt(1, 9999)} ${rand(streets)}`,
      city: rand(cities),
      zip: String(randInt(10000, 99999)),
    },
    createdAt: new Date(Date.now() - randInt(0, 365 * 24 * 3600000)).toISOString(),
  };
}

const FakeDataGenerator = () => {
  const [count, setCount] = useState(5);
  const [output, setOutput] = useState("");

  const generate = () => {
    const data = Array.from({ length: Math.min(count, 100) }, generatePerson);
    setOutput(JSON.stringify(data, null, 2));
    toast.success(`Generated ${data.length} records`);
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ToolSEO title="Fake Data Generator" description="Generate realistic fake user data in JSON format for testing and development. Includes names, emails, addresses, and UUIDs." canonicalPath="/fake-data" keywords={["fake data generator", "mock data", "test data generator", "random user data", "JSON test data"]} faq={[{question:"What kind of fake data can I generate?",answer:"Generate realistic user profiles with names, emails, phone numbers, addresses, ages, and UUIDs — all in JSON format."},{question:"Can I control how many records are generated?",answer:"Yes, specify any count from 1 to 100 records per generation."}]} howToSteps={["Set the number of records to generate (1-100)","Click Generate to create fake user data","Click Copy to copy the JSON output"]} />
      <h1 className="text-2xl font-mono font-bold text-foreground">Fake Data Generator</h1>
      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Count (max 100)</label>
          <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} min={1} max={100} className="w-32 bg-card border-border" />
        </div>
        <Button onClick={generate}>Generate</Button>
        <Button variant="outline" onClick={copy} disabled={!output}>Copy</Button>
      </div>
      {output && (
        <Textarea value={output} readOnly className="min-h-[400px] font-mono text-sm bg-card border-border resize-none" />
      )}
    </div>
  );
};

export default FakeDataGenerator;
