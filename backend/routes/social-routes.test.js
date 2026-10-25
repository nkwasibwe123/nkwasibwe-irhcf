"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createSocialRouter, ensureSocialSchema } = require("./social-routes");

async function withServer(app, run) {
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  try { await run("http://127.0.0.1:"+server.address().port); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
function appFor(pool, authenticated=true) {
  const app=express();
  app.use(express.json());
  app.use("/api/social",createSocialRouter({pool,authenticateToken:(req,res,next)=>{
    if(!authenticated) return res.status(401).json({success:false,error:"Unauthorized"});
    req.user={id:7}; next();
  }}));
  return app;
}
test("social router requires pool and auth middleware",()=>{
  assert.throws(()=>createSocialRouter({}),/database pool/);
  assert.throws(()=>createSocialRouter({pool:{query(){} }}),/authentication middleware/);
});
test("profile update validates display name and HTTPS avatar",async()=>{
  const calls=[];
  const pool={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    let r=await fetch(base+"/api/social/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:""})});
    assert.equal(r.status,400);
    r=await fetch(base+"/api/social/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Test",avatarUrl:"http://bad.example"})});
    assert.equal(r.status,400);
    assert.equal(calls.length,0);
  });
});
test("social APIs reject unauthenticated requests",async()=>{
  await withServer(appFor({query:async()=>({rows:[]})},false),async base=>{
    const r=await fetch(base+"/api/social/feed");
    assert.equal(r.status,401);
  });
});
test("post creation requires text or media and limits media URL scheme",async()=>{
  const pool={query:async()=>({rows:[{id:"1",author_id:7,body:"hello",media:[],visibility:"public"}]})};
  await withServer(appFor(pool),async base=>{
    let r=await fetch(base+"/api/social/posts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:" "})});
    assert.equal(r.status,400);
    r=await fetch(base+"/api/social/posts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:"hi",media:[{url:"javascript:alert(1)"}]})});
    assert.equal(r.status,400);
    r=await fetch(base+"/api/social/posts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:"hi"})});
    assert.equal(r.status,201);
  });
});
test("feed clamps pagination and only uses parameterized query",async()=>{
  let params,sql;
  const pool={query:async(q,p)=>{sql=q;params=p;return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/feed?limit=1000&beforeId=12");
    assert.equal(r.status,200);
    assert.equal(params[2],50);
    assert.equal(params[1],12);
    assert.match(sql,/NOT EXISTS/);
  });
});
test("schema helper requires a database pool",async()=>{
  await assert.rejects(()=>ensureSocialSchema(),/database pool/);
});
