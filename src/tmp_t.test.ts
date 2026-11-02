import {test} from "vitest"; import {readFileSync} from "fs";
import { inspectImage } from "@/components/image-metadata/metadataUtils";
import { scanStructure } from "@/components/image-metadata/cleanUtils";
for (const n of ["a.jpg","b.jpg","c.png","d.jpg"]) test(n, async()=>{ const b=readFileSync("/tmp/im/"+n); const ab=b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
 let t=Date.now(); const f=new File([b],n,{type:n.endsWith("png")?"image/png":"image/jpeg"}); await inspectImage(ab,f); console.log(n,"inspect",Date.now()-t); t=Date.now(); scanStructure(new Uint8Array(ab)); console.log(n,"scan",Date.now()-t);},30000);
