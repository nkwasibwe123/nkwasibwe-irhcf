"use strict";
const { buildFailureImprovementProposal } = require("./self-improvement");

class SelfImprovementWorker {
  constructor({ pool, pollIntervalMs = 300000 } = {}) {
    if (!pool || typeof pool.query !== "function") throw new Error("SelfImprovementWorker requires a database pool.");
    this.pool=pool;
    this.pollIntervalMs=Math.max(60000,Number(pollIntervalMs)||300000);
    this.running=false;
    this.active=false;
    this.timer=null;
    this.lastRunAt=null;
    this.lastResult=null;
    this.lastError=null;
  }
  async tick() {
    if(this.active) return { skipped:true, reason:"scan_already_running" };
    this.active=true;
    try {
      const result=await this.pool.query(
        "SELECT user_id,id,task,status,error,attempts,created_at FROM tasks WHERE user_id IS NOT NULL AND status='FAILED' AND error IS NOT NULL AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '14 days' ORDER BY updated_at DESC LIMIT 500"
      );
      const byUser=new Map();
      for(const row of result.rows) {
        if(!byUser.has(row.user_id)) byUser.set(row.user_id,[]);
        byUser.get(row.user_id).push(row);
      }
      let upserted=0;
      for(const [userId,failures] of byUser) {
        const proposals=buildFailureImprovementProposal(failures);
        for(const p of proposals) {
          const saved=await this.pool.query(
            "INSERT INTO self_improvement_proposals (id,user_id,fingerprint,target,reason,changes,evidence,status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) ON CONFLICT (user_id,fingerprint) DO UPDATE SET reason=EXCLUDED.reason,changes=EXCLUDED.changes,evidence=EXCLUDED.evidence,updated_at=CURRENT_TIMESTAMP WHERE self_improvement_proposals.status IN ('PROPOSED','BLOCKED') RETURNING id",
            [p.id,userId,p.fingerprint,p.target,p.reason,JSON.stringify(p.changes),JSON.stringify(p.evidence),p.status]
          );
          if(saved.rows.length) upserted++;
        }
      }
      this.lastRunAt=new Date().toISOString();
      this.lastResult={scannedFailures:result.rows.length,usersScanned:byUser.size,proposalsUpdated:upserted};
      this.lastError=null;
      return this.lastResult;
    } catch(error) {
      this.lastRunAt=new Date().toISOString();
      this.lastError=String(error?.message||error).slice(0,500);
      console.error("[SELF_IMPROVEMENT_WORKER] Scan failed:",this.lastError);
      throw error;
    } finally { this.active=false; }
  }
  start() {
    if(this.running) return this;
    this.running=true;
    this.timer=setInterval(()=>this.tick().catch(()=>{}),this.pollIntervalMs);
    if(typeof this.timer.unref==="function") this.timer.unref();
    this.tick().catch(()=>{});
    console.log("[SELF_IMPROVEMENT_WORKER] Failure-pattern scanner started.");
    return this;
  }
  stop() {
    this.running=false;
    if(this.timer) clearInterval(this.timer);
    this.timer=null;
  }
  getRuntimeState() {
    return {running:this.running,active:this.active,pollIntervalMs:this.pollIntervalMs,lastRunAt:this.lastRunAt,lastResult:this.lastResult,lastError:this.lastError};
  }
}
module.exports={SelfImprovementWorker};
