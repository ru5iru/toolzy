export const sortKeysDeep = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortKeysDeep(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

export const jsonToXml = (obj: any, rootName = "root", indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return `${pad}<${rootName}/>\n`;
  if (typeof obj !== "object") return `${pad}<${rootName}>${String(obj)}</${rootName}>\n`;
  if (Array.isArray(obj)) return obj.map((item) => jsonToXml(item, "item", indent)).join("");
  let xml = `${pad}<${rootName}>\n`;
  for (const key of Object.keys(obj)) xml += jsonToXml(obj[key], key.replace(/[^a-zA-Z0-9_]/g, "_"), indent + 1);
  xml += `${pad}</${rootName}>\n`;
  return xml;
};

export const jsonToCsv = (data: any): string => {
  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return "";
  const flatObj = (obj: any, prefix = ""): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (obj[key] !== null && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        Object.assign(result, flatObj(obj[key], path));
      } else {
        result[path] = Array.isArray(obj[key]) ? JSON.stringify(obj[key]) : String(obj[key] ?? "");
      }
    }
    return result;
  };
  const rows = arr.map((item) => flatObj(item));
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
};

export const jsonToYaml = (obj: any, indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (obj === null) return "null\n";
  if (typeof obj === "boolean") return `${obj}\n`;
  if (typeof obj === "number") return `${obj}\n`;
  if (typeof obj === "string") return obj.includes("\n") ? `|\n${obj.split("\n").map((l) => pad + "  " + l).join("\n")}\n` : `${JSON.stringify(obj)}\n`;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]\n";
    return obj.map((item) => {
      const val = jsonToYaml(item, indent + 1);
      if (typeof item === "object" && item !== null) return `${pad}- ${val.trimStart()}`;
      return `${pad}- ${val}`;
    }).join("");
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}\n";
    return keys.map((key) => {
      const val = obj[key];
      if (typeof val === "object" && val !== null) return `${pad}${key}:\n${jsonToYaml(val, indent + 1)}`;
      return `${pad}${key}: ${jsonToYaml(val, indent + 1)}`;
    }).join("");
  }
  return String(obj) + "\n";
};

export const generateJsonSchema = (obj: any): any => {
  if (obj === null) return { type: "null" };
  if (Array.isArray(obj)) {
    return {
      type: "array",
      items: obj.length > 0 ? generateJsonSchema(obj[0]) : {},
    };
  }
  if (typeof obj === "object") {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      properties[key] = generateJsonSchema(val);
      required.push(key);
    }
    return { type: "object", properties, required };
  }
  if (typeof obj === "string") return { type: "string" };
  if (typeof obj === "number") return Number.isInteger(obj) ? { type: "integer" } : { type: "number" };
  if (typeof obj === "boolean") return { type: "boolean" };
  return {};
};

export const validateJsonAgainstSchema = (data: any, schema: any, path = ""): string[] => {
  const errors: string[] = [];
  if (!schema || !schema.type) return errors;

  const actualType = data === null ? "null" : Array.isArray(data) ? "array" : typeof data;
  const expectedType = schema.type === "integer" ? "number" : schema.type;

  if (actualType !== expectedType) {
    errors.push(`${path || "root"}: expected ${schema.type}, got ${actualType}`);
    return errors;
  }

  if (schema.type === "object" && schema.properties) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in data)) errors.push(`${path}.${key}: missing required field`);
      }
    }
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (schema.properties[key]) {
        errors.push(...validateJsonAgainstSchema(val, schema.properties[key], `${path}.${key}`));
      }
    }
  }

  if (schema.type === "array" && schema.items && Array.isArray(data)) {
    data.forEach((item: any, i: number) => {
      errors.push(...validateJsonAgainstSchema(item, schema.items, `${path}[${i}]`));
    });
  }

  return errors;
};

export const filterJson = (obj: any, query: string): any => {
  if (!query) return obj;
  const q = query.toLowerCase();

  if (typeof obj === "string" && obj.toLowerCase().includes(q)) return obj;
  if (typeof obj === "number" && String(obj).includes(q)) return obj;
  if (typeof obj === "boolean" && String(obj).includes(q)) return obj;
  if (obj === null) return null;

  if (Array.isArray(obj)) {
    const filtered = obj.map((item) => filterJson(item, query)).filter((item) => item !== undefined);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    let hasMatch = false;
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase().includes(q)) {
        result[key] = val;
        hasMatch = true;
      } else {
        const filtered = filterJson(val, query);
        if (filtered !== undefined) {
          result[key] = filtered;
          hasMatch = true;
        }
      }
    }
    return hasMatch ? result : undefined;
  }

  return undefined;
};

export const downloadFile = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
