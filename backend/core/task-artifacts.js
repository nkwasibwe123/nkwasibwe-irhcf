"use strict";
const vm=require("node:vm");

const FILE_REQUEST=/\b(create|write|generate|build|make|produce|save|export|nkorera|unkorere|ngukorere|kora|yubake|ubaka|mpa|uyimpe|unkorere)\b.{0,120}\b(file|script|code|document|report|page|website|web site|urubuga|app|application|component|module|spreadsheet|csv|json|html|css|javascript|typescript|site ya internet)\b|\b(file|script|code|document|report|website|urubuga|app|application|component|module)\b.{0,100}\b(for me|please|that works|with|named|called|yuzuye|rwose)\b/i;
const EXTENSION=/\b([\w.-]+\.(?:js|cjs|mjs|ts|tsx|jsx|html|css|json|md|txt|csv|xml|svg))\b/i;
const EXT_TO_MIME=Object.freeze({
 js:"text/javascript",cjs:"text/javascript",mjs:"text/javascript",ts:"text/plain",tsx:"text/plain",jsx:"text/javascript",
 html:"text/html; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json",md:"text/markdown; charset=utf-8",
 txt:"text/plain; charset=utf-8",csv:"text/csv; charset=utf-8",xml:"application/xml",svg:"image/svg+xml"
});
const WEBSITE_FILES=[
 {name:"index.html",extension:"html",mimeType:EXT_TO_MIME.html},
 {name:"style.css",extension:"css",mimeType:EXT_TO_MIME.css},
 {name:"script.js",extension:"js",mimeType:EXT_TO_MIME.js},
 {name:"README.md",extension:"md",mimeType:EXT_TO_MIME.md}
];

function requestedArtifact(task) {
 const text=String(task||"").trim();
 if(!FILE_REQUEST.test(text)) return null;
 const match=text.match(EXTENSION);
 const defaultName=/\b(website|web site|urubuga|site ya internet|html|web page)\b/i.test(text)?"index.html"
  :/\b(csv|spreadsheet)\b/i.test(text)?"output.csv"
  :/\bjson\b/i.test(text)?"output.json"
  :/\b(code|script|javascript|typescript|app|application|component|module)\b/i.test(text)?"index.js":"task-deliverable.md";
 let name=(match?.[1]||defaultName).replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120);
 if(name==="."||name===".."||name.includes("..")) name="task-deliverable.md";
 const extension=name.split(".").pop().toLowerCase();
 return {name,extension,mimeType:EXT_TO_MIME[extension]||"text/plain; charset=utf-8"};
}

function requestedArtifacts(task) {
 const request=requestedArtifact(task);
 if(!request) return [];
 const text=String(task||"");
 const website=/\b(website|web site|urubuga|site ya internet)\b/i.test(text);
 return website ? WEBSITE_FILES.map(file=>({...file})) : [request];
}

function getResponseText(result) {
 for(const value of [result?.response,result?.answer,result?.output,result?.content,result?.result?.output_text]) {
  if(typeof value==="string"&&value.trim()) return value.trim();
  if(value&&typeof value.content==="string"&&value.content.trim()) return value.content.trim();
 }
 return "";
}

function extractDeliverable(text,extension) {
 const source=String(text||"").trim();
 const codeLike=new Set(["js","cjs","mjs","ts","tsx","jsx","html","css","json","csv","xml","svg"]);
 if(codeLike.has(extension)) {
  const fence=source.match(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```/);
  if(fence) return fence[1].trim()+"\n";
  if(/^(here(?:'s| is)|below is|this code|the following|sure[,!])/i.test(source)) return "";
  return source+"\n";
 }
 return source+"\n";
}

function verifyContent(name,extension,content) {
 if(!content.trim()) return {verified:false,reason:"empty content"};
 if(["js","cjs","mjs"].includes(extension)) {
  try { new vm.Script(content,{filename:name}); return {verified:true,reason:"JavaScript syntax passed"}; }
  catch(error) { return {verified:false,reason:"JavaScript syntax failed: "+String(error.message||error).slice(0,400)}; }
 }
 if(extension==="html") {
  const s=content.toLowerCase();
  if(!s.includes("<!doctype html")||!s.includes("<html")||!s.includes("</html>")||!s.includes("<body")||!s.includes("</body>"))
   return {verified:false,reason:"HTML document structure is incomplete"};
  return {verified:true,reason:"HTML document structure passed"};
 }
 if(extension==="css") {
  let depth=0;
  for(const ch of content){if(ch==="{")depth++;if(ch==="}")depth--;if(depth<0)return {verified:false,reason:"CSS braces are unbalanced"};}
  if(depth!==0)return {verified:false,reason:"CSS braces are unbalanced"};
  return {verified:true,reason:"CSS brace balance passed"};
 }
 if(extension==="json") {
  try{JSON.parse(content);return {verified:true,reason:"JSON parse passed"};}
  catch(error){return {verified:false,reason:"JSON parse failed: "+String(error.message||error).slice(0,300)};}
 }
 return {verified:true,reason:"non-empty content"};
}

function buildSingleArtifact(request,{task,result,taskId}={}) {
 if(!result||result.success===false) return {artifact:null,error:"Agent execution failed; no artifact was created."};
 const content=extractDeliverable(getResponseText(result),request.extension);
 const bytes=Buffer.byteLength(content,"utf8");
 if(bytes>20000) return {artifact:null,error:"Generated file exceeds the 20 KB per-file limit."};
 const check=verifyContent(request.name,request.extension,content);
 if(!check.verified) return {artifact:null,error:check.reason};
 return {artifact:{name:request.name,mimeType:request.mimeType,content,bytes,verified:true,verification:check.reason,
  downloadUrl:"/api/tasks/"+encodeURIComponent(String(taskId))+"/artifacts/"+encodeURIComponent(request.name)},error:null};
}

function buildTaskArtifact({task,result,taskId}={}) {
 const request=requestedArtifact(task);
 if(!request)return {required:false,artifacts:[]};
 const built=buildSingleArtifact(request,{task,result,taskId});
 return built.artifact?{required:true,artifacts:[built.artifact],verified:true,expectedFiles:[request.name],verification:built.artifact.verification}
  :{required:true,artifacts:[],verified:false,expectedFiles:[request.name],error:built.error||"The requested artifact could not be verified."};
}

function extractNamedFileBlocks(text) {
 const source=String(text||"");
 const blocks=[];
 const pattern=/```([a-zA-Z0-9_-]+)\s+(?:filename\s*=\s*)?["']?([A-Za-z0-9_.-]+\.(?:html|css|js|md))["']?\s*\r?\n([\s\S]*?)\r?\n```/g;
 let match;
 while((match=pattern.exec(source))!==null) blocks.push({language:match[1].toLowerCase(),name:match[2],content:match[3].trim()+"\n"});
 return blocks;
}

function buildTaskArtifacts({task,result,taskId}={}) {
 const expected=requestedArtifacts(task);
 if(!expected.length)return {required:false,artifacts:[]};
 if(expected.length===1)return buildTaskArtifact({task,result,taskId});
 if(!result||result.success===false)return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],error:"Agent execution failed; no website files were created."};
 const response=getResponseText(result);
 const blocks=extractNamedFileBlocks(response);
 const byName=new Map();
 for(const block of blocks) {
  if(expected.some(file=>file.name===block.name)&&!byName.has(block.name))byName.set(block.name,block);
 }
 const artifacts=[],errors=[];
 for(const file of expected) {
  const block=byName.get(file.name);
  if(!block){errors.push("Missing required file: "+file.name);continue;}
  const built=buildSingleArtifact(file,{task:"Create a file named "+file.name,result:{success:true,response:block.content},taskId});
  if(!built.artifact){errors.push(file.name+": "+built.error);continue;}
  artifacts.push(built.artifact);
 }
 const totalBytes=artifacts.reduce((sum,item)=>sum+item.bytes,0);
 if(totalBytes>36000) return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],error:"Website source exceeds the 36 KB combined file limit."};
 const verified=errors.length===0&&artifacts.length===expected.length;
 return {required:true,verified,expectedFiles:expected.map(f=>f.name),artifacts,
  verification:verified?"All website files passed their content checks.":null,
  error:verified?null:errors.join(" ").slice(0,1500)};
}

module.exports={requestedArtifact,requestedArtifacts,getResponseText,extractDeliverable,extractNamedFileBlocks,buildTaskArtifact,buildTaskArtifacts};
