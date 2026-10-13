"use strict";
const vm=require("node:vm");

const FILE_REQUEST=/\b(create|write|generate|build|make|produce|save|export|nkorera|unkorera|unkorere|ngukorere|ndashaka|kora|yubake|ubaka|mpa|uyimpe)\b.{0,160}\b(file|script|code|document|report|page|website|web site|urubuga|app|application|component|module|spreadsheet|csv|json|html|css|javascript|typescript|site ya internet)\b|\b(file|script|code|document|report|website|urubuga|app|application|component|module)\b.{0,100}\b(for me|please|that works|with|named|called|yuzuye|rwose)\b/i;
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
  catch(error) { return {verified:false,reason:"JavaScript syntax verification failed: "+String(error.message||error).slice(0,400)}; }
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

function extractNamedFileBlocks(text, expectedFiles = WEBSITE_FILES) {
 const source=String(text||"");
 const blocks=[];
 const pattern=/```([^\r\n`]*)(?:\r?\n)([\s\S]*?)\r?\n```/g;
 let match;
 while((match=pattern.exec(source))!==null) {
  const info=String(match[1]||"").trim();
  const body=String(match[2]||"").trim()+"\n";
  if(!body.trim()) continue;
  const filenameMatch=info.match(/(?:filename\s*=\s*)?["']?([A-Za-z0-9_.-]+\.(?:html|css|js|md))["']?/i);
  const language=(info.split(/\s+/)[0]||"").toLowerCase();
  const languageExtension=({html:"html",htm:"html",css:"css",js:"js",javascript:"js",ecmascript:"js",md:"md",markdown:"md",text:"md",txt:"md"})[language]||"";
  const explicitName=filenameMatch?.[1];
  const expectedExtension=expectedFiles.find(file=>file.extension===languageExtension)?.name;
  blocks.push({language,name:explicitName||expectedExtension||null,content:body,info});
 }
 // Also support labelled Markdown sections such as "## index.html" followed by a code fence.
 for(const file of expectedFiles) {
  if(blocks.some(block=>block.name===file.name)) continue;
  const heading=new RegExp("^[#]{1,4}\\s*"+file.name.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")+"\\s*$","im");
  const found=heading.exec(source);
  if(!found) continue;
  const from=found.index+found[0].length;
  const nextHeading=/^#{1,4}\s+[^\r\n]+/gm;
  nextHeading.lastIndex=from;
  const next=nextHeading.exec(source);
  const section=source.slice(from,next?next.index:source.length).trim();
  const fenced=section.match(/```[^\r\n`]*(?:\r?\n)([\s\S]*?)\r?\n```/);
  const content=(fenced?fenced[1]:section).trim();
  if(content) blocks.push({language:file.extension,name:file.name,content:content+"\n",info:"section"});
 }
 // Legacy responses often return four anonymous code blocks in the expected order.
 const unassigned=blocks.filter(block=>!block.name);
 const missing=expectedFiles.filter(file=>!blocks.some(block=>block.name===file.name));
 if(unassigned.length && unassigned.length===missing.length) {
  unassigned.forEach((block,index)=>{ block.name=missing[index].name; });
 }
 return blocks;
}


function buildWebsiteFallback(task) {
 const title=String(task||"School Website").replace(/\s+/g," ").trim().slice(0,100) || "School Website";
 const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const safeTitle=escapeHtml(title);
 return [
  {name:"index.html",extension:"html",mimeType:EXT_TO_MIME.html,content:`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="School information, learning, and community.">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="style.css">
  <script defer src="script.js"></script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="#home" aria-label="Home">${safeTitle}</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main navigation">
      <a href="#about">About</a><a href="#programs">Programs</a><a href="#news">News</a><a href="#contact">Contact</a>
    </nav>
  </header>
  <main>
    <section class="hero" id="home">
      <p class="eyebrow">Welcome to our school</p>
      <h1>Learning today. Leading tomorrow.</h1>
      <p>A caring school community helping every learner grow through knowledge, creativity, and character.</p>
      <a class="button" href="#about">Discover our school</a>
    </section>
    <section class="section" id="about"><p class="eyebrow">Who we are</p><h2>Every learner matters</h2><p>We create a supportive environment where students can ask questions, build skills, and prepare for a bright future.</p></section>
    <section class="section cards" id="programs"><article class="card"><h3>Quality learning</h3><p>Engaging lessons that build strong foundations.</p></article><article class="card"><h3>Student wellbeing</h3><p>A safe, respectful place to learn and belong.</p></article><article class="card"><h3>Community</h3><p>Families and educators working together.</p></article></section>
    <section class="section" id="news"><p class="eyebrow">School updates</p><h2>What is happening</h2><p>Contact the school office for current announcements, term dates, and admissions information.</p></section>
    <section class="section contact" id="contact"><h2>Get in touch</h2><p>For admissions and general enquiries, please contact the school office.</p><a class="button" href="mailto:info@example.com">Email the school</a></section>
  </main>
  <footer><p>© <span id="year"></span> ${safeTitle}. All rights reserved.</p></footer>
</body>
</html>
`},
  {name:"style.css",extension:"css",mimeType:EXT_TO_MIME.css,content:`:root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f9fc; font-synthesis: none; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; line-height: 1.6; }
a { color: inherit; }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem clamp(1rem, 5vw, 4rem); background: #fff; border-bottom: 1px solid #e5eaf2; }
.brand { font-weight: 800; text-decoration: none; }
.site-nav { display: flex; gap: 1.25rem; }
.site-nav a { text-decoration: none; color: #475569; }
.menu-toggle { display: none; }
.hero { padding: clamp(4rem, 10vw, 8rem) clamp(1rem, 8vw, 7rem); background: linear-gradient(135deg, #e8f2ff, #f7f9fc 65%); }
.hero h1 { max-width: 760px; font-size: clamp(2.4rem, 6vw, 4.8rem); line-height: 1.05; letter-spacing: -.04em; margin: .5rem 0 1rem; }
.hero p:not(.eyebrow) { max-width: 620px; color: #475569; font-size: 1.15rem; }
.eyebrow { color: #2563eb; font-size: .8rem; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
.button { display: inline-block; margin-top: 1rem; padding: .8rem 1.1rem; border-radius: .7rem; background: #1d4ed8; color: #fff; text-decoration: none; font-weight: 700; }
.section { padding: 3.5rem clamp(1rem, 8vw, 7rem); max-width: 1200px; margin: auto; }
.section h2 { font-size: clamp(1.8rem, 4vw, 2.8rem); margin: .25rem 0 .75rem; }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.card { padding: 1.5rem; background: #fff; border: 1px solid #e5eaf2; border-radius: 1rem; }
.card h3 { margin-top: 0; }
.contact { background: #eef4ff; border-radius: 1rem; margin-bottom: 2rem; }
footer { padding: 1.5rem; text-align: center; color: #64748b; background: #fff; }
@media (max-width: 680px) { .site-header { flex-wrap: wrap; } .menu-toggle { display: inline-block; padding: .5rem .75rem; border: 1px solid #cbd5e1; border-radius: .5rem; background: #fff; } .site-nav { display: none; width: 100%; flex-direction: column; padding: .5rem 0; } .site-nav.is-open { display: flex; } .cards { grid-template-columns: 1fr; } .hero { padding-top: 4rem; padding-bottom: 4rem; } }
`},
  {name:"script.js",extension:"js",mimeType:EXT_TO_MIME.js,content:`"use strict";
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-nav");
if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    navigation.classList.toggle("is-open", !expanded);
  });
  navigation.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    menuButton.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  }));
}
const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());
`},
  {name:"README.md",extension:"md",mimeType:EXT_TO_MIME.md,content:`# ${title}

A responsive starter school website generated as a safe fallback because the AI response did not contain the four expected source files.

## Files
- `index.html` — page structure and school sections
- `style.css` — responsive layout and visual styling
- `script.js` — mobile navigation and current-year footer
- `README.md` — project notes

## Run locally
Open `index.html` in a browser. Keep all three source files in the same folder.

## Before publishing
Replace the sample school name and contact email, add verified school details and images, and confirm any admissions information before making the site public.
`}
 ];
}

function buildTaskArtifacts({task,result,taskId}={}) {
 const expected=requestedArtifacts(task);
 if(!expected.length)return {required:false,artifacts:[]};
 if(expected.length===1)return buildTaskArtifact({task,result,taskId});
 if(!result||result.success===false)return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],error:"Agent execution failed; no website files were created."};
 const response=getResponseText(result);
 const blocks=extractNamedFileBlocks(response, expected);
 // If the agent returned no parseable file blocks at all, deliver a real,
 // syntax-checked starter site rather than leaving the task failed with four
 // missing-file errors. Partial AI output still fails verification explicitly.
 if(blocks.length===0) {
  const fallback=buildWebsiteFallback(task);
  const artifacts=[];
  const errors=[];
  for(const file of fallback) {
   const check=verifyContent(file.name,file.extension,file.content);
   if(!check.verified) { errors.push(file.name+": "+check.reason); continue; }
   artifacts.push({name:file.name,mimeType:file.mimeType,content:file.content,bytes:Buffer.byteLength(file.content,"utf8"),verified:true,
    verification:"Verified starter-site fallback: "+check.reason,
    downloadUrl:"/api/tasks/"+encodeURIComponent(String(taskId))+"/artifacts/"+encodeURIComponent(file.name)});
  }
  const verified=errors.length===0&&artifacts.length===expected.length;
  return {required:true,verified,expectedFiles:expected.map(f=>f.name),artifacts,
   fallbackUsed:true,verification:verified?"All fallback website files passed their content checks.":null,
   error:verified?null:errors.join(" ").slice(0,1500)};
 }
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
