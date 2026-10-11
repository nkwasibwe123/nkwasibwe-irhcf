"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {SelfImprovementWorker}=require("./self-improvement-worker");

test("worker groups failed tasks per user and persists deduplicated proposals",async()=>{
 const queries=[];
 const pool={async query(sql,params){queries.push({sql,params});if(sql.startsWith("SELECT user_id"))return {rows:[
 {user_id:1,id:11,task:"Build website",status:"FAILED",error:"artifact verification failed",attempts:3,created_at:"2026-10-10"},
 {user_id:1,id:12,task:"Create website",status:"FAILED",error:"artifact verification failed",attempts:3,created_at:"2026-10-11"},
 {user_id:2,id:13,task:"Other",status:"FAILED",error:"provider quota exhausted",attempts:2,created_at:"2026-10-11"}
 ]};return {rows:[{id:params[0]}]};}};
 const worker=new SelfImprovementWorker({pool,pollIntervalMs:60000});
 const result=await worker.tick();
 assert.deepEqual(result,{scannedFailures:3,usersScanned:2,proposalsUpdated:2});
 assert.equal(queries.filter(q=>q.sql.startsWith("INSERT INTO self_improvement_proposals")).length,2);
 assert.ok(queries.some(q=>q.params?.[1]===1));
 assert.ok(queries.some(q=>q.params?.[1]===2));
 assert.equal(worker.getRuntimeState().lastError,null);
});
test("worker prevents overlapping scans",async()=>{
 let release;
 const pool={query:async()=>new Promise(resolve=>{release=()=>resolve({rows:[]});})};
 const worker=new SelfImprovementWorker({pool});
 const first=worker.tick();
 const second=await worker.tick();
 assert.equal(second.skipped,true);
 release(); await first;
});
