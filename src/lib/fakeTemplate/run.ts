import { createFaker } from './locales';
import { generateBatch, type Json } from './engine';
export interface Options { count: number; locale: string; seed?: number; refDate?: string }
export async function runGeneration(template:Json, options:Options):Promise<Json[]> {
 if(options.seed!==undefined&&!Number.isSafeInteger(options.seed))throw new Error('Seed must be a safe integer');
 if(options.refDate&&!Number.isFinite(Date.parse(options.refDate)))throw new Error('Invalid reference date');
 return generateBatch(template,options.count,await createFaker(options.locale,options.seed,options.refDate));
}