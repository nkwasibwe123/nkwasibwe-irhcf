"use strict";
const vm=require("node:vm");

const FILE_REQUEST=/\b(create|write|generate|build|make|produce|save|export|nkorera|unkorera|unkorere|ngukorere|ndashaka|kora|yubake|ubaka|mpa|uyimpe)\b.{0,160}\b(file|script|code|document|report|page|website|web site|urubuga|app|application|component|module|spreadsheet|csv|json|html|css|javascript|typescript|site ya internet)\b|\b(file|script|code|document|report|website|urubuga|app|application|component|module)\b.{0,100}\b(for me|please|that works|with|named|called|yuzuye|rwose)\b/i;
const EXTENSION=/\b([\w.-]+\.(?:js|cjs|mjs|ts|tsx|jsx|html|htm|css|json|md|txt|csv|xml|svg|yml|yaml|toml|py|go|rs|java|kt|php|sql|sh|bat|webmanifest|map|graphql|gql|vue|svelte|astro|scss|sass|less|lock))\b/i;
const EXT_TO_MIME=Object.freeze({
 js:"text/javascript",cjs:"text/javascript",mjs:"text/javascript",ts:"text/plain",tsx:"text/plain",jsx:"text/javascript",
 html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json",md:"text/markdown; charset=utf-8",
 txt:"text/plain; charset=utf-8",csv:"text/csv; charset=utf-8",xml:"application/xml",svg:"image/svg+xml",yml:"text/yaml",yaml:"text/yaml",toml:"text/plain",py:"text/x-python",go:"text/plain",rs:"text/plain",java:"text/plain",kt:"text/plain",php:"text/plain",sql:"text/plain",sh:"text/plain",bat:"text/plain",webmanifest:"application/manifest+json",map:"application/json",graphql:"text/plain",gql:"text/plain",vue:"text/plain",svelte:"text/plain",astro:"text/plain",scss:"text/plain",sass:"text/plain",less:"text/plain",lock:"text/plain"
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
 const base=website ? WEBSITE_FILES.map(file=>({...file})) : [request];
 // Respect every explicitly named source/config/data file in the request.
 // The standard website bundle is a minimum, not a hard-coded ceiling.
 const named=[];
 const pattern=/\b([A-Za-z0-9_.-]+\.(?:js|cjs|mjs|ts|tsx|jsx|html|htm|css|json|md|txt|csv|xml|svg|yml|yaml|toml|py|go|rs|java|kt|php|sql|sh|bat|webmanifest|map|graphql|gql|vue|svelte|astro|scss|sass|less|lock))\b/gi;
 let match;
 while((match=pattern.exec(text))!==null) {
  const name=match[1];
  if(name.includes("..")||name.startsWith(".")) continue;
  const extension=name.split(".").pop().toLowerCase();
  if(!EXT_TO_MIME[extension]||base.some(file=>file.name.toLowerCase()===name.toLowerCase())||named.some(file=>file.name.toLowerCase()===name.toLowerCase())) continue;
  named.push({name,extension,mimeType:EXT_TO_MIME[extension]});
 }
 return [...base,...named];
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
 if(bytes>512000) return {artifact:null,error:"Generated file exceeds the 512 KB per-file limit."};
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
  const filenameMatch=info.match(/(?:filename\s*=\s*)?["']?([A-Za-z0-9_.-]+\.(?:js|cjs|mjs|ts|tsx|jsx|html|htm|css|json|md|txt|csv|xml|svg|yml|yaml|toml|py|go|rs|java|kt|php|sql|sh|bat|webmanifest|map|graphql|gql|vue|svelte|astro|scss|sass|less|lock))["']?/i);
  const language=(info.split(/\s+/)[0]||"").toLowerCase();
  const languageExtension=({html:"html",htm:"htm",css:"css",js:"js",javascript:"js",ecmascript:"js",cjs:"cjs",mjs:"mjs",ts:"ts",tsx:"tsx",jsx:"jsx",json:"json",md:"md",markdown:"md",text:"txt",txt:"txt",csv:"csv",xml:"xml",svg:"svg",yaml:"yaml",yml:"yml",toml:"toml",python:"py",py:"py",go:"go",rust:"rs",rs:"rs",java:"java",kotlin:"kt",php:"php",sql:"sql",bash:"sh",sh:"sh",vue:"vue",svelte:"svelte",astro:"astro",scss:"scss",sass:"sass",less:"less",graphql:"graphql",gql:"gql"})[language]||"";
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
- **index.html** — page structure and school sections
- **style.css** — responsive layout and visual styling
- **script.js** — mobile navigation and current-year footer
- **README.md** — project notes

## Run locally
Open index.html in a browser. Keep all three source files in the same folder.

## Before publishing
Replace the sample school name and contact email, add verified school details and images, and confirm any admissions information before making the site public.
`}
 ];
}



function isEcommerceWebsiteRequest(task) {
 return /\b(shop|shopping|e[- ]?commerce|online store|storefront|checkout|cart|payment|payments|sell products|selling products|gucururizaho|gucuruza|ubucuruzi|amaduka|iduka|ibicuruzwa|kwishyura|ubwishyu)\b/i.test(String(task||""));
}
function buildEcommerceFallback(task) {
 const title="Nkwasibwe Market";
 return [
  {name:"index.html",extension:"html",mimeType:EXT_TO_MIME.html,content:'<!doctype html><html lang="rw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="style.css"><script defer src="script.js"></script></head><body><div class="banner">Nkwasibwe Market · Urugero rw’iduka ryo kuri internet</div><header><a class="brand" href="#home">Nkwasibwe <b>Market</b></a><nav><a href="#products">Ibicuruzwa</a><a href="#about">Abo turi bo</a><a href="#contact">Twandikire</a></nav><button id="cartButton">Agaseke (<span id="cartCount">0</span>)</button></header><main id="home"><section class="hero"><p>IKAZE MU IDUKA RYACU</p><h1>Ibicuruzwa byiza. Kugura byoroshye.</h1><p>Shakisha ibicuruzwa, shyira ibyo ukeneye mu gaseke, urebe igiteranyo.</p><a class="cta" href="#products">Reba ibicuruzwa</a><small>DEMO: nta mafaranga yishyurwa hano.</small></section><section id="products" class="section"><h2>Ibicuruzwa</h2><input id="search" type="search" placeholder="Shakisha ibicuruzwa"><div class="products"><article class="product" data-name="Isakoshi"><div>👜</div><h3>Isakoshi yiza</h3><p>RWF 18,000</p><button data-add="bag">Shyira mu gaseke</button></article><article class="product" data-name="Headphones"><div>🎧</div><h3>Headphones</h3><p>RWF 25,000</p><button data-add="audio">Shyira mu gaseke</button></article><article class="product" data-name="Isaha"><div>⌚</div><h3>Isaha</h3><p>RWF 32,000</p><button data-add="watch">Shyira mu gaseke</button></article><article class="product" data-name="Inkweto"><div>👟</div><h3>Inkweto</h3><p>RWF 28,000</p><button data-add="shoes">Shyira mu gaseke</button></article></div></section><section id="checkout" class="section checkout"><div><h2>Agaseke kawe</h2><ul id="cartItems"><li>Nta bicuruzwa wahisemo.</li></ul><strong id="total">Igiteranyo: RWF 0</strong></div><form id="checkoutForm"><h2>Amakuru yo kohereza</h2><label>Amazina<input required name="name" autocomplete="name"></label><label>Email<input required name="email" type="email" autocomplete="email"></label><label>Aho woherezwa<input required name="address" autocomplete="street-address"></label><button type="submit">Komeza (demo gusa)</button><p id="notice">Ntushyiremo amakuru y’ikarita. Nta kwishyura nyakuri bikorwa.</p></form></section><section id="about" class="section"><h2>Amakuru y’ubucuruzi</h2><p>Ongeramo amakuru yemejwe y’ikigo, uburyo bwo kohereza no gusubiza ibicuruzwa.</p></section><section id="contact" class="section"><h2>Twandikire</h2><p>Ongeramo telefone na email byemejwe.</p></section></main><footer>© <span id="year"></span> Nkwasibwe Market · Demo gusa</footer></body></html>'},
  {name:"style.css",extension:"css",mimeType:EXT_TO_MIME.css,content:':root{font-family:system-ui,sans-serif;color:#172033;background:#f7f9fc}*{box-sizing:border-box}body{margin:0}.banner{background:#17324d;color:white;text-align:center;padding:.6rem}header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 5vw;background:white;flex-wrap:wrap}.brand{font-size:1.3rem;font-weight:900;text-decoration:none;color:#172033}b,.hero>p{color:#087f8c}nav{display:flex;gap:1rem}nav a{color:#334155;text-decoration:none}button,.cta{border:0;border-radius:.6rem;background:#087f8c;color:white;padding:.8rem 1rem;cursor:pointer;font-weight:700;text-decoration:none}.hero{padding:5rem 8vw;background:linear-gradient(120deg,#e2f7f4,#f7f9fc)}.hero h1{font-size:clamp(2.4rem,5vw,4.5rem);max-width:750px;line-height:1.05}.hero p{max-width:650px}.hero small{display:block;margin-top:1rem;color:#9a3412}.section{padding:3rem 7vw}.section h2{font-size:2rem}.section input{padding:.8rem;width:100%;max-width:420px;border:1px solid #cbd5e1;border-radius:.5rem}.products{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:1rem}.product{padding:1rem;background:white;border:1px solid #e2e8f0;border-radius:1rem}.product div{font-size:3.5rem;text-align:center;padding:1.5rem;background:#e9f5f4;border-radius:.7rem}.product button{width:100%}.checkout{display:grid;grid-template-columns:1fr 1fr;gap:2rem;background:#edf4f7}.checkout li{margin:.5rem 0}.checkout label{display:block;margin:.8rem 0}.checkout label input{display:block;margin-top:.3rem}.checkout form{background:white;padding:1.5rem;border-radius:1rem}.checkout form button{width:100%}#notice{color:#9a3412;font-size:.9rem}footer{text-align:center;padding:2rem;background:#17324d;color:white}@media(max-width:720px){.products{grid-template-columns:repeat(2,minmax(0,1fr))}.checkout{grid-template-columns:1fr}nav{width:100%;order:3}}@media(max-width:420px){.products{grid-template-columns:1fr}.hero,.section{padding:2rem 1rem}}'},
  {name:"script.js",extension:"js",mimeType:EXT_TO_MIME.js,content:'"use strict";const catalog={bag:{name:"Isakoshi yiza",price:18000},audio:{name:"Headphones",price:25000},watch:{name:"Isaha",price:32000},shoes:{name:"Inkweto",price:28000}};const cart={};const money=n=>"RWF "+n.toLocaleString("en-US");function render(){const entries=Object.entries(cart).filter(x=>x[1]>0);document.querySelector("#cartCount").textContent=entries.reduce((n,x)=>n+x[1],0);const list=document.querySelector("#cartItems");list.replaceChildren();if(!entries.length){const li=document.createElement("li");li.textContent="Nta bicuruzwa wahisemo.";list.append(li)}entries.forEach(([id,q])=>{const li=document.createElement("li");li.textContent=catalog[id].name+" × "+q+" — "+money(catalog[id].price*q);list.append(li)});document.querySelector("#total").textContent="Igiteranyo: "+money(entries.reduce((n,[id,q])=>n+catalog[id].price*q,0))}document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{cart[b.dataset.add]=(cart[b.dataset.add]||0)+1;render()}));document.querySelector("#search").addEventListener("input",e=>document.querySelectorAll(".product").forEach(p=>p.hidden=!p.dataset.name.toLowerCase().includes(e.target.value.toLowerCase())));document.querySelector("#checkoutForm").addEventListener("submit",e=>{e.preventDefault();document.querySelector("#notice").textContent="Demo gusa: nta order yoherejwe kandi nta mafaranga yishyuwe. Hakenewe backend na payment provider wemewe mbere yo gufungura iduka nyakuri."});document.querySelector("#cartButton").addEventListener("click",()=>document.querySelector("#checkout").scrollIntoView({behavior:"smooth"}));document.querySelector("#year").textContent=new Date().getFullYear();render();'},
  {name:"README.md",extension:"md",mimeType:EXT_TO_MIME.md,content:'# Nkwasibwe Market\n\nResponsive e-commerce starter in Kinyarwanda with sample products, search, a browser-only cart and a checkout form demo.\n\nSECURITY: This is not production-ready and does not process payments. Never collect card data in this demo. Production needs secure server-side authentication, database-backed products/orders, server-side price validation, HTTPS, a reputable hosted PCI-compliant payment provider, order verification, shipping/returns/privacy policies and legal/tax review. Keep payment secrets on the server.\n\nOpen index.html with all four files in the same folder. Products and prices are examples only.'}
 ];
}

function isSchoolWebsiteRequest(task) {
 return /\b(school|primary school|secondary school|education|academy|college|university|ishuri|amashuri|ikigo cy'ishuri|ikigo cy'uburezi)\b/i.test(String(task||""));
}

function isTradingWebsiteRequest(task) {
 return /\b(trad(?:e|ing)|broker|forex|stock market|crypto exchange|portfolio|paper trading|trading platform|trading website|crypto trading)\b/i.test(String(task||""));
}

function buildTradingFallback(task) {
 const title=String(task||"Trading Platform").replace(/\s+/g," ").trim().slice(0,90)||"Trading Platform";
 const safeTitle=title.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 return [
  {name:"index.html",extension:"html",mimeType:EXT_TO_MIME.html,content:`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Trading dashboard demo with market watchlist and paper portfolio"><title>${safeTitle}</title><link rel="stylesheet" href="style.css"><script defer src="script.js"></script></head>
<body><header class="topbar"><a class="brand" href="#home">Trade<span>Desk</span></a><nav><a href="#markets">Markets</a><a href="#portfolio">Portfolio</a><a href="#learn">Learn</a></nav><span class="demo-pill">DEMO · PAPER TRADING</span></header>
<main id="home"><section class="welcome"><div><p class="eyebrow">MARKET OVERVIEW</p><h1>Trade with a clearer view.</h1><p>Track sample markets, review your paper portfolio and practice order entry without real money.</p></div><div class="market-summary"><span>Demo account balance</span><strong id="balance">$10,000.00</strong><small>Virtual funds only · no real orders</small></div></section>
<section class="market-strip" aria-label="Sample market prices"><article><span>BTC / USD</span><strong>$67,420.50</strong><em>+2.14%</em></article><article><span>ETH / USD</span><strong>$3,520.20</strong><em>+1.08%</em></article><article><span>S&P 500</span><strong>5,842.10</strong><em>+0.42%</em></article><article><span>EUR / USD</span><strong>1.0842</strong><em class="negative">−0.16%</em></article></section>
<section class="grid"><div class="panel" id="markets"><div class="panel-heading"><div><p class="eyebrow">WATCHLIST</p><h2>Markets</h2></div><span class="sample-label">SAMPLE DATA</span></div><label class="search-label" for="marketSearch">Search markets</label><input id="marketSearch" type="search" placeholder="Search BTC, ETH, AAPL…"><div class="table-wrap"><table><thead><tr><th>Asset</th><th>Price</th><th>24h</th><th>Action</th></tr></thead><tbody id="marketRows"><tr data-symbol="BTC"><td><b>Bitcoin</b><small>BTC/USD</small></td><td>$67,420.50</td><td class="positive">+2.14%</td><td><button class="buy" data-buy="BTC">Paper buy</button></td></tr><tr data-symbol="ETH"><td><b>Ethereum</b><small>ETH/USD</small></td><td>$3,520.20</td><td class="positive">+1.08%</td><td><button class="buy" data-buy="ETH">Paper buy</button></td></tr><tr data-symbol="AAPL"><td><b>Apple</b><small>AAPL</small></td><td>$231.40</td><td class="positive">+0.61%</td><td><button class="buy" data-buy="AAPL">Paper buy</button></td></tr><tr data-symbol="TSLA"><td><b>Tesla</b><small>TSLA</small></td><td>$248.50</td><td class="negative">−0.84%</td><td><button class="buy" data-buy="TSLA">Paper buy</button></td></tr></tbody></table></div></div>
<aside class="panel" id="portfolio"><p class="eyebrow">PRACTICE ONLY</p><h2>Paper portfolio</h2><p class="muted">Click “Paper buy” to simulate a small order using virtual funds.</p><div class="portfolio-stat"><span>Virtual cash</span><strong id="cash">$10,000.00</strong></div><div class="portfolio-stat"><span>Demo orders</span><strong id="orderCount">0</strong></div><h3>Recent activity</h3><ul id="activity"><li>No demo orders yet.</li></ul><button id="resetDemo" class="secondary">Reset demo</button></aside></section>
<section class="learn" id="learn"><p class="eyebrow">IMPORTANT</p><h2>A safe starting point, not a live broker</h2><p>This starter uses illustrative prices and browser-only demo orders. It does not connect to a broker, execute real trades, provide investment advice, or guarantee market data. Before production, add secure authentication, a backend, a licensed market-data source, risk controls, compliance review and a broker integration.</p></section></main><footer>TradeDesk · Educational paper-trading demo · No real funds or live market data.</footer></body></html>`},
  {name:"style.css",extension:"css",mimeType:EXT_TO_MIME.css,content:`:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e7edf8;background:#0b1220;font-synthesis:none}*{box-sizing:border-box}body{margin:0;line-height:1.5}.topbar{display:flex;align-items:center;gap:2rem;padding:1rem clamp(1rem,4vw,4rem);background:#111b2d;border-bottom:1px solid #24324a;position:sticky;top:0}.brand{font-size:1.35rem;font-weight:900;color:#fff;text-decoration:none}.brand span{color:#5ee0b5}.topbar nav{display:flex;gap:1.25rem;flex:1}.topbar nav a{color:#aab8ce;text-decoration:none}.demo-pill,.sample-label{font-size:.7rem;font-weight:800;letter-spacing:.08em;color:#ffd98a;background:#3b2d18;padding:.45rem .65rem;border-radius:99px}.welcome{display:flex;justify-content:space-between;align-items:center;gap:2rem;padding:3.5rem clamp(1rem,5vw,5rem);background:radial-gradient(ellipse at top right,#183d49,#0b1220 60%)}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;color:#5ee0b5}.welcome h1{font-size:clamp(2.1rem,5vw,4rem);line-height:1.05;max-width:650px;margin:.5rem 0}.welcome p:not(.eyebrow),.muted{color:#aab8ce;max-width:650px}.market-summary,.panel{background:#111b2d;border:1px solid #26354d;border-radius:1rem;padding:1.3rem}.market-summary{min-width:230px;display:grid;gap:.5rem}.market-summary span,.market-summary small,.market-strip span,.portfolio-stat span{color:#aab8ce}.market-summary strong{font-size:1.7rem}.market-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;padding:0 clamp(1rem,5vw,5rem) 1.5rem}.market-strip article{display:grid;gap:.35rem;padding:1rem;background:#111b2d;border:1px solid #26354d;border-radius:.8rem}.market-strip strong{font-size:1.2rem}.positive,.market-strip em{color:#5ee0b5;font-style:normal}.negative{color:#ff8b9b!important}.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,1fr);gap:1rem;padding:0 clamp(1rem,5vw,5rem) 2rem}.panel-heading{display:flex;justify-content:space-between;align-items:center}.panel h2{margin:.1rem 0 1rem}.search-label{display:block;color:#aab8ce;font-size:.85rem;margin:.5rem 0}.panel input{width:100%;padding:.75rem;border:1px solid #30425e;border-radius:.6rem;background:#0b1220;color:#fff;margin-bottom:1rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:.85rem .6rem;border-bottom:1px solid #26354d;white-space:nowrap}th{font-size:.75rem;color:#aab8ce}td small{display:block;color:#aab8ce}.buy,.secondary{border:0;border-radius:.5rem;padding:.55rem .7rem;background:#1b725a;color:#fff;font-weight:700;cursor:pointer}.secondary{background:#30425e;margin-top:1rem}.portfolio-stat{display:flex;justify-content:space-between;padding:.85rem 0;border-bottom:1px solid #26354d}.panel h3{margin-top:1.5rem}.panel ul{padding-left:1.2rem;color:#aab8ce;font-size:.9rem}.panel li{margin:.5rem 0}.learn{margin:0 clamp(1rem,5vw,5rem) 2rem;padding:1.5rem;background:#17263b;border-radius:1rem}.learn p:last-child{color:#bdc9da}footer{text-align:center;padding:1.5rem;color:#aab8ce;border-top:1px solid #26354d}@media(max-width:800px){.topbar{flex-wrap:wrap;gap:1rem}.topbar nav{order:3;width:100%;flex-basis:100%}.demo-pill{margin-left:auto}.welcome{align-items:stretch;flex-direction:column}.market-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.grid{grid-template-columns:1fr}}@media(max-width:420px){.market-strip{grid-template-columns:1fr 1fr;gap:.5rem}.market-strip article{padding:.7rem}.market-strip strong{font-size:1rem}}`},
  {name:"script.js",extension:"js",mimeType:EXT_TO_MIME.js,content:`"use strict";
let cash=10000;let orders=0;
const prices={BTC:67420.5,ETH:3520.2,AAPL:231.4,TSLA:248.5};
const fmt=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
const cashNode=document.querySelector("#cash"),balanceNode=document.querySelector("#balance"),orderNode=document.querySelector("#orderCount"),activity=document.querySelector("#activity");
document.querySelectorAll("[data-buy]").forEach(button=>button.addEventListener("click",()=>{
 const symbol=button.dataset.buy;const cost=prices[symbol]*0.01;
 if(cash<cost){alert("Not enough virtual cash in this demo.");return;}
 cash-=cost;orders+=1;cashNode.textContent=fmt(cash);balanceNode.textContent=fmt(cash);orderNode.textContent=String(orders);
 const empty=activity.querySelector("li");if(empty&&empty.textContent.includes("No demo orders"))activity.replaceChildren();
 const item=document.createElement("li");item.textContent="Paper buy: 0.01 "+symbol+" · "+fmt(cost)+" (virtual only)";activity.prepend(item);
}));
document.querySelector("#marketSearch").addEventListener("input",event=>{
 const query=event.target.value.trim().toLowerCase();
 document.querySelectorAll("#marketRows tr").forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(query));
});
document.querySelector("#resetDemo").addEventListener("click",()=>{cash=10000;orders=0;cashNode.textContent=fmt(cash);balanceNode.textContent=fmt(cash);orderNode.textContent="0";activity.innerHTML="<li>No demo orders yet.</li>";});
`},
  {name:"README.md",extension:"md",mimeType:EXT_TO_MIME.md,content:`# ${title}

Responsive trading-dashboard starter with a market watchlist, searchable sample assets, virtual balance and browser-only paper-buy interactions.

## Run
Keep index.html, style.css and script.js in one folder, then open index.html in a browser.

## Included
- Responsive market overview and watchlist
- Search filter for listed sample assets
- Paper-trading demo buttons and resettable virtual cash
- No real broker, live prices, real-money orders, or investment advice

## Production requirements
This is not a production brokerage. Before launch, add a secure backend, authentication, database, trusted market-data provider, broker API, audit logs, order/risk validation, legal/compliance review and security testing. Do not expose provider keys in browser code. Sample prices are illustrative and may be stale.
`}
 ];
}

function verifyWebsiteBundle(artifacts) {
 const byName=new Map(artifacts.map(item=>[String(item.name||"").toLowerCase(),item]));
 const html=byName.get("index.html")?.content||"";
 const errors=[];
 if(!html) return ["Missing index.html."];
 const referenced=new Set();
 const ids=new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]));
 for(const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
  const raw=String(match[1]||"").trim();
  if(!raw||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
  if(raw.startsWith("#")) {
   if(raw.length>1&&!ids.has(decodeURIComponent(raw.slice(1)))) errors.push("Broken in-page link: "+raw);
   continue;
  }
  const path=raw.split(/[?#]/)[0].replace(/^\.\//,"");
  if(!path) continue;
  const name=path.split("/").pop().toLowerCase();
  referenced.add(name);
  if(!byName.has(name)) errors.push("Missing local file reference: "+raw);
 }
 for(const required of ["style.css","script.js"]) {
  if(byName.has(required)&&!referenced.has(required)) errors.push("index.html does not reference required file: "+required);
 }
 return [...new Set(errors)];
}

function buildTaskArtifacts({task,result,taskId}={}) {
 const expected=requestedArtifacts(task);
 if(!expected.length)return {required:false,artifacts:[]};
 if(expected.length===1)return buildTaskArtifact({task,result,taskId});
 const executionFailed=!result||result.success===false;
 if(executionFailed&&expected.length===1)return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],error:"Agent execution failed; no artifact was created."};
 const response=executionFailed?"":getResponseText(result);
 const blocks=extractNamedFileBlocks(response, expected);
 // If the agent returned no parseable file blocks at all, deliver a real,
 // syntax-checked starter site rather than leaving the task failed with four
 // missing-file errors. Partial AI output still fails verification explicitly.
 if(blocks.length===0) {
  // Never substitute an unrelated template for the user's requested product.
  // Only use a local fallback when the request's domain is positively identified.
  const fallback=isEcommerceWebsiteRequest(task)?buildEcommerceFallback(task)
   :(isTradingWebsiteRequest(task)?buildTradingFallback(task)
   :(isSchoolWebsiteRequest(task)?buildWebsiteFallback(task):null));
  if(!fallback) {
   return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],fallbackUsed:false,
    error:"The AI did not generate the requested website files, and no matching domain-specific fallback is available. Nothing unrelated was substituted.",
    providerFailure:executionFailed?{code:result?.error?.code||result?.code||"AI_EXECUTION_FAILED",message:String(result?.error?.message||result?.error||"The AI execution adapter failed before returning website files.").slice(0,500)}:null};
  }
  const artifacts=[];
  const errors=[];
  for(const file of fallback) {
   const check=verifyContent(file.name,file.extension,file.content);
   if(!check.verified) { errors.push(file.name+": "+check.reason); continue; }
   artifacts.push({name:file.name,mimeType:file.mimeType,content:file.content,bytes:Buffer.byteLength(file.content,"utf8"),verified:true,
    verification:"Verified starter-site fallback: "+check.reason,
    downloadUrl:"/api/tasks/"+encodeURIComponent(String(taskId))+"/artifacts/"+encodeURIComponent(file.name)});
  }
  errors.push(...verifyWebsiteBundle(artifacts));
  const verified=errors.length===0&&artifacts.length===expected.length;
  if(!verified) for(const artifact of artifacts) artifact.verified=false;
  return {required:true,verified,expectedFiles:expected.map(f=>f.name),artifacts,
   fallbackUsed:true,
   fallbackReason:executionFailed?"AI provider execution failed; used a verified local website starter instead.":"AI response did not contain the required website source files.",
   providerFailure:executionFailed?{code:result?.error?.code||result?.code||"AI_EXECUTION_FAILED",message:String(result?.error?.message||result?.error||"The AI execution adapter failed before returning website files.").slice(0,500)}:null,
   verification:verified?"All fallback website files passed their content checks.":null,
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
 if(totalBytes>2000000) return {required:true,verified:false,expectedFiles:expected.map(f=>f.name),artifacts:[],error:"Generated project exceeds the 2 MB combined artifact limit."};
 errors.push(...verifyWebsiteBundle(artifacts));
 const verified=errors.length===0&&artifacts.length===expected.length;
 if(!verified) for(const artifact of artifacts) artifact.verified=false;
 return {required:true,verified,expectedFiles:expected.map(f=>f.name),artifacts,
  verification:verified?"All website files passed their content checks.":null,
  error:verified?null:errors.join(" ").slice(0,1500)};
}

module.exports={requestedArtifact,requestedArtifacts,getResponseText,extractDeliverable,extractNamedFileBlocks,buildTaskArtifact,buildTaskArtifacts};
