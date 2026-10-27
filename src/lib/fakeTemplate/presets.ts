import type { Json } from './engine';
export const presets: Record<string, Json> = {
 User: { id:'{{string.uuid}}',name:'{{person.fullName}}',email:'{{internet.email}}',phone:'{{phone.number}}',age:'{{number.int({"min":18,"max":80})}}',address:{street:'{{location.streetAddress}}',city:'{{location.city}}',zip:'{{location.zipCode}}'},createdAt:'{{date.past}}' },
};