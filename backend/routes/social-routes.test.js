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
test("schema helper requires a database pool",()=>{
  assert.throws(()=>ensureSocialSchema(),/database pool/);
});

test("conversation messages are hidden from non-members",async()=>{
  const pool={query:async(sql,params)=>{
    if(/FROM social_conversation_members WHERE conversation_id=\$1 AND user_id=\$2/.test(sql)) return {rows:[]};
    throw new Error("Unexpected query");
  }};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/conversations/42/messages");
    assert.equal(r.status,404);
    const data=await r.json();
    assert.equal(data.success,false);
  });
});
test("message creation rejects empty body before database access",async()=>{
  let called=false;
  const pool={query:async()=>{called=true;return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/conversations/42/messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:"   "})});
    assert.equal(r.status,400);
    assert.equal(called,false);
  });
});
test("conversation listing is scoped to the authenticated member",async()=>{
  let sql,params;
  const pool={query:async(q,p)=>{sql=q;params=p;return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/conversations");
    assert.equal(r.status,200);
    assert.match(sql,/mine\.user_id=\$1/);
    assert.deepEqual(params,[7]);
  });
});


test("feed response query exposes the current user's selected reaction",async()=>{
  let sql="";
  const pool={query:async(q)=>{sql=q;return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/feed");
    assert.equal(r.status,200);
    assert.match(sql,/AS my_reaction/);
  });
});

test("reaction endpoint saves supported reactions and removes a reaction with none",async()=>{
  const statements=[];
  const pool={query:async(sql,params)=>{
    statements.push({sql,params});
    if(/SELECT id FROM social_posts p WHERE id=\$1/.test(sql)) return {rows:[{id:"9"}]};
    return {rows:[]};
  }};
  await withServer(appFor(pool),async base=>{
    let r=await fetch(base+"/api/social/posts/9/reaction",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({reaction:"love"})});
    assert.equal(r.status,200);
    assert.equal((await r.json()).reaction,"love");
    r=await fetch(base+"/api/social/posts/9/reaction",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({reaction:"none"})});
    assert.equal(r.status,200);
    assert.equal((await r.json()).reaction,null);
    assert.ok(statements.some(item=>/INSERT INTO social_post_reactions/.test(item.sql)));
    assert.ok(statements.some(item=>/DELETE FROM social_post_reactions/.test(item.sql)));
  });
});

test("friends list is scoped to the signed-in user and excludes blocked relationships",async()=>{
  let sql,params;
  const pool={query:async(q,p)=>{sql=q;params=p;return {rows:[{id:8,display_name:"Friend"}]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/friends");
    assert.equal(r.status,200);
    assert.deepEqual((await r.json()).friends,[{id:8,display_name:"Friend"}]);
    assert.match(sql,/mine\.follower_id=\$1/);
    assert.match(sql,/NOT EXISTS/);
    assert.deepEqual(params,[7]);
  });
});

test("declining a friend request only changes the recipient's pending request",async()=>{
  let sql,params;
  const pool={query:async(q,p)=>{sql=q;params=p;return {rows:[{id:12,status:"declined"}]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/friend-requests/12/decline",{method:"POST"});
    assert.equal(r.status,200);
    assert.match(sql,/recipient_id=\$2 AND status='pending'/);
    assert.deepEqual(params,["12",7]);
  });
});

test("media upload rejects unsupported types and mismatched file signatures",async()=>{
  let called=false; const pool={query:async()=>{called=true;return {rows:[]};}};
  await withServer(appFor(pool),async base=>{
    let r=await fetch(base+"/api/social/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fileName:"x.exe",mimeType:"application/x-msdownload",dataBase64:Buffer.from("MZ").toString("base64")})});
    assert.equal(r.status,415);
    r=await fetch(base+"/api/social/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fileName:"x.png",mimeType:"image/png",dataBase64:Buffer.from("not png").toString("base64")})});
    assert.equal(r.status,415); assert.equal(called,false);
  });
});
test("media upload persists a validated small PNG and returns a first-party URL",async()=>{
  let sql,params; const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const pool={query:async(q,p)=>{sql=q;params=p;return {rows:[{id:"17",file_name:"photo.png",mime_type:"image/png",byte_size:png.length,created_at:"now"}]};}};
  await withServer(appFor(pool),async base=>{
    const r=await fetch(base+"/api/social/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({fileName:"photo.png",mimeType:"image/png",dataBase64:png.toString("base64")})});
    assert.equal(r.status,201); const data=await r.json(); assert.equal(data.media.url,"/api/social/media/17/content");
    assert.match(sql,/INSERT INTO social_media_assets/); assert.equal(params[0],7); assert.deepEqual(params[4],png);
  });
});
test("media content is not returned to users without ownership or a visible post",async()=>{
  const pool={query:async()=>({rows:[]})};
  await withServer(appFor(pool),async base=>{const r=await fetch(base+"/api/social/media/17/content");assert.equal(r.status,404);});
});
