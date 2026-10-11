"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildImprovementProposal,evaluatePromotion,classifyFailureTarget,buildFailureImprovementProposal}=require("./self-improvement");

test("proposal sanitizes inputs and fingerprints the same issue consistently",()=>{
 const a=buildImprovementProposal({target:"provider-access",reason:" quota exhausted ",changes:["Fix routing",5],evidence:[{taskId:3}]});
 const b=buildImprovementProposal({target:"provider-access",reason:"quota exhausted",changes:["Fix routing"],evidence:[{taskId:3}]});
 assert.equal(a.reason,"quota exhausted"); assert.equal(a.changes.length,1); assert.equal(a.fingerprint,b.fingerprint); assert.equal(a.status,"PROPOSED");
});
test("promotion remains blocked without all gates",()=>{
 const r=evaluatePromotion({proposal:{},baseline:{score:.8,passRate:.9},candidate:{score:.9,passRate:.95,safe:true}});
 assert.equal(r.promotable,false); assert.ok(r.reasons.includes("SECURITY_REVIEW_REQUIRED")); assert.ok(r.reasons.includes("REGRESSION_TEST_REQUIRED")); assert.ok(r.reasons.includes("EXPLICIT_PROMOTION_REQUIRED"));
});
test("invalid metrics and unsafe candidate cannot pass",()=>{
 const r=evaluatePromotion({proposal:{},baseline:{score:"bad",passRate:1.2},candidate:{score:2,passRate:.9,safe:false},securityPassed:true,regressionPassed:true,explicitPromotion:true});
 assert.equal(r.promotable,false); assert.ok(r.reasons.includes("BENCHMARK_METRICS_INVALID")); assert.ok(r.reasons.includes("SAFETY_NOT_PASSED"));
});
test("candidate passing all gates is approved only for review, never deployment",()=>{
 const r=evaluatePromotion({proposal:{},baseline:{score:.8,passRate:.9},candidate:{score:.85,passRate:.95,safe:true},securityPassed:true,regressionPassed:true,explicitPromotion:true});
 assert.equal(r.promotable,true); assert.equal(r.policy.approvalIsNotDeployment,true);
});
test("failure classifier identifies provider, artifact, timeout, database and verification failures",()=>{
 assert.equal(classifyFailureTarget("credit_balance_exhausted from provider"),"provider-access");
 assert.equal(classifyFailureTarget("Artifact syntax verification failed"),"artifact-generation");
 assert.equal(classifyFailureTarget("request timed out"),"task-timeouts");
 assert.equal(classifyFailureTarget("Postgres connection failed"),"database-reliability");
 assert.equal(classifyFailureTarget("response quality verification failed"),"result-verification");
});
test("failure scan creates evidence-backed proposals without claiming repair",()=>{
 const p=buildFailureImprovementProposal([{id:10,task:"Build school website",status:"FAILED",error:"Artifact verification failed",attempts:3,created_at:"2026-10-10T12:00:00Z"},{id:11,task:"Create site",status:"FAILED",error:"Artifact verification failed",attempts:3,created_at:"2026-10-10T12:10:00Z"}]);
 assert.equal(p.length,1); assert.equal(p[0].target,"artifact-generation"); assert.equal(p[0].evidence.length,2); assert.match(p[0].reason,/Observed 2 failed task/); assert.ok(p[0].changes.some(v=>/regression test/i.test(v)));
});
