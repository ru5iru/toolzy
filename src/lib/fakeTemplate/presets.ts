import type { Json } from './engine';
export const presets: Record<string, Json> = {
 User: { id:'{{string.uuid}}',name:'{{person.fullName}}',email:'{{internet.email}}',phone:'{{phone.number}}',age:'{{number.int({"min":18,"max":80})}}',address:{street:'{{location.streetAddress}}',city:'{{location.city}}',zip:'{{location.zipCode}}'},createdAt:'{{date.past}}' },
 Product:{id:'{{string.uuid}}',name:'{{commerce.productName}}',price:'{{number.float({"min":1,"max":999,"fractionDigits":2})}}',department:'{{commerce.department}}',sku:{$regex:'[A-Z]{3}-\\d{4}'}},
 Order:{id:'{{string.uuid}}',customer:'{{person.fullName}}',createdAt:'{{date.past}}',status:{$pick:['pending','paid','shipped']},items:{$repeat:{min:1,max:5,of:{product:'{{commerce.productName}}',quantity:'{{number.int({"min":1,"max":10})}}',price:'{{number.float({"min":1,"max":200,"fractionDigits":2})}}'}}},
 Employee:{id:'{{$index1}}',name:'{{person.fullName}}',email:'{{internet.email}}',jobTitle:'{{person.jobTitle}}',department:'{{commerce.department}}',salary:'{{number.int({"min":30000,"max":150000})}}'},
 Company:{id:'{{string.uuid}}',name:'{{company.name}}',description:'{{company.catchPhrase}}',website:'{{internet.url}}',address:{street:'{{location.streetAddress}}',city:'{{location.city}}',country:'{{location.country}}'}},
 Transaction:{id:'{{string.uuid}}',amount:'{{number.float({"min":1,"max":10000,"fractionDigits":2})}}',currency:'{{finance.currencyCode}}',account:'{{finance.accountNumber}}',date:'{{date.past}}',type:{$pick:['credit','debit']}},
 'Blog post':{id:'{{$index1}}',title:'{{lorem.sentence}}',author:'{{person.fullName}}',content:'{{lorem.paragraphs(3)}}',tags:{$repeat:{min:1,max:4,of:'{{lorem.word}}'}},publishedAt:'{{date.past}}'},
 Address:{street:'{{location.streetAddress}}',city:'{{location.city}}',state:'{{location.state}}',zip:'{{location.zipCode}}',country:'{{location.country}}'},
};