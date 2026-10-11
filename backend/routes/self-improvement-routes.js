"use strict";
const express = require("express");
const { buildImprovementProposal, evaluatePromotion, buildFailureImprovementProposal } = require("../core/self-improvement");

function createSelfImprovementRouter({ pool, authenticateToken, taskEngine } = {}) {
  if (!pool?.query || typeof authenticateToken !== "function" || !taskEngine?.getRuntimeState) throw new Error("Self-improvement routes require pool, authentication and task engine.");
  const router = express.Router();

  router.get("/status", authenticateToken, async (req,res) => {
    try {
      const [counts, recent, proposals] = await Promise.all([
        pool.query("SELECT status, COUNT(*)::int AS count FROM tasks WHERE user_id=$1 GROUP BY status",[req.user.id]),
        pool.query("SELECT id,status,progress,progress_message,updated_at FROM tasks WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 5",[req.user.id]),
        pool.query("SELECT status,COUNT(*)::int AS count FROM self_improvement_proposals WHERE user_id=$1 GROUP BY status",[req.user.id])
      ]);
      return res.json({
        success:true, generatedAt:new Date().toISOString(), worker:taskEngine.getRuntimeState(),
        tasks:{counts:Object.fromEntries(counts.rows.map(r=>[r.status,r.count])),recent:recent.rows},
        selfImprovement:{
          enabled:true,mode:"guarded_failure_analysis_and_proposals",
          automaticFailureScanning:true,automaticProductionCodeChanges:false,
          automaticProductionDeployment:false,requiresReviewedPatchAndPassingCI:true,
          proposalCounts:Object.fromEntries(proposals.rows.map(r=>[r.status,r.count]))
        }
      });
    } catch(error) {
      console.error("[SELF_IMPROVEMENT] Status failed:",String(error?.message||error).slice(0,300));
      return res.status(500).json({success:false,code:"SELF_IMPROVEMENT_STATUS_FAILED",error:"Could not load self-improvement status."});
    }
  });

  router.get("/proposals", authenticateToken, async (req,res) => {
    try {
      const limit=Math.min(100,Math.max(1,Math.trunc(Number(req.query.limit)||30)));
      const r=await pool.query("SELECT id,fingerprint,target,reason,changes,evidence,status,baseline,candidate,evaluation,created_at,updated_at FROM self_improvement_proposals WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2",[req.user.id,limit]);
      return res.json({success:true,proposals:r.rows});
    } catch(error) {
      console.error("[SELF_IMPROVEMENT] List failed:",String(error?.message||error).slice(0,300));
      return res.status(500).json({success:false,code:"SELF_IMPROVEMENT_LIST_FAILED",error:"Could not load improvement proposals."});
    }
  });

  router.post("/proposals", authenticateToken, async (req,res) => {
    const p=buildImprovementProposal({target:req.body?.target,reason:req.body?.reason,changes:req.body?.changes,evidence:req.body?.evidence});
    if(!p.reason) return res.status(400).json({success:false,code:"IMPROVEMENT_REASON_REQUIRED",error:"A reason based on observed evidence is required."});
    try {
      const r=await pool.query("INSERT INTO self_improvement_proposals (id,user_id,fingerprint,target,reason,changes,evidence,status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) ON CONFLICT (user_id,fingerprint) DO UPDATE SET evidence=EXCLUDED.evidence,updated_at=CURRENT_TIMESTAMP WHERE self_improvement_proposals.status IN ('PROPOSED','BLOCKED') RETURNING id,target,reason,changes,evidence,status,created_at,updated_at",[p.id,req.user.id,p.fingerprint,p.target,p.reason,JSON.stringify(p.changes),JSON.stringify(p.evidence),p.status]);
      if(!r.rows.length) return res.status(409).json({success:false,code:"IMPROVEMENT_ALREADY_CLOSED",error:"A proposal with the same fingerprint already exists and is no longer editable."});
      return res.status(201).json({success:true,proposal:r.rows[0]});
    } catch(error) {
      console.error("[SELF_IMPROVEMENT] Create failed:",String(error?.message||error).slice(0,300));
      return res.status(500).json({success:false,code:"SELF_IMPROVEMENT_CREATE_FAILED",error:"Could not save the improvement proposal."});
    }
  });

  router.post("/scan", authenticateToken, async (req,res) => {
    try {
      const failed=await pool.query("SELECT id,task,status,error,attempts,created_at FROM tasks WHERE user_id=$1 AND status='FAILED' AND error IS NOT NULL ORDER BY updated_at DESC LIMIT 100",[req.user.id]);
      const candidates=buildFailureImprovementProposal(failed.rows), saved=[];
      for(const p of candidates) {
        const r=await pool.query("INSERT INTO self_improvement_proposals (id,user_id,fingerprint,target,reason,changes,evidence,status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) ON CONFLICT (user_id,fingerprint) DO UPDATE SET evidence=EXCLUDED.evidence,updated_at=CURRENT_TIMESTAMP WHERE self_improvement_proposals.status IN ('PROPOSED','BLOCKED') RETURNING id,target,reason,changes,evidence,status,created_at,updated_at",[p.id,req.user.id,p.fingerprint,p.target,p.reason,JSON.stringify(p.changes),JSON.stringify(p.evidence),p.status]);
        if(r.rows[0]) saved.push(r.rows[0]);
      }
      return res.json({success:true,scannedFailures:failed.rows.length,created:saved.length,proposals:saved,productionChanged:false,message:candidates.length?"Failure patterns were analyzed; proposals are not production code changes.":"No failed tasks with recorded errors were found for this account."});
    } catch(error) {
      console.error("[SELF_IMPROVEMENT] Scan failed:",String(error?.message||error).slice(0,300));
      return res.status(500).json({success:false,code:"SELF_IMPROVEMENT_SCAN_FAILED",error:"Could not scan task failures."});
    }
  });

  router.post("/proposals/:id/evaluate", authenticateToken, async (req,res) => {
    const id=String(req.params.id||"").slice(0,80);
    try {
      const found=await pool.query("SELECT id,target,reason,status FROM self_improvement_proposals WHERE id=$1 AND user_id=$2 LIMIT 1",[id,req.user.id]);
      if(!found.rows.length) return res.status(404).json({success:false,code:"IMPROVEMENT_PROPOSAL_NOT_FOUND",error:"Improvement proposal not found."});
      const evaluation=evaluatePromotion({
        proposal:found.rows[0],baseline:req.body?.baseline,candidate:req.body?.candidate,
        securityPassed:req.body?.securityPassed===true,regressionPassed:req.body?.regressionPassed===true,
        explicitPromotion:req.body?.explicitPromotion===true
      });
      const status=evaluation.promotable?"APPROVED_FOR_REVIEW":"BLOCKED";
      const updated=await pool.query("UPDATE self_improvement_proposals SET baseline=$3::jsonb,candidate=$4::jsonb,evaluation=$5::jsonb,status=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND user_id=$2 RETURNING id,target,reason,status,baseline,candidate,evaluation,updated_at",[id,req.user.id,JSON.stringify(req.body?.baseline||{}),JSON.stringify(req.body?.candidate||{}),JSON.stringify(evaluation),status]);
      return res.json({success:true,proposal:updated.rows[0],productionChanged:false,message:evaluation.promotable?"Gate checks recorded; this approves the proposal for human review only and does not change or deploy production code.":"Promotion is blocked until every required gate passes."});
    } catch(error) {
      console.error("[SELF_IMPROVEMENT] Evaluate failed:",String(error?.message||error).slice(0,300));
      return res.status(500).json({success:false,code:"SELF_IMPROVEMENT_EVALUATION_FAILED",error:"Could not evaluate the improvement proposal."});
    }
  });
  return router;
}
module.exports={createSelfImprovementRouter};
