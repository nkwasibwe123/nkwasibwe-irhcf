"use strict";

/**
 * IRHCF MULTI-AGENT EXECUTION ENGINE
 *
 * Specialist agents are coordinated through the existing central
 * execution engine. This module does not create provider clients,
 * bypass authorization, or mutate production state.
 *
 * The Master Agent remains the final synthesizer. Specialists produce
 * bounded briefs that are fed into the final execution context.
 */

function clean(value, max = 8000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function selectSpecialists(team, maxSpecialists = 4, task = "") {
  const specialists = Array.isArray(team?.specialists)
    ? team.specialists
    : [];
  const taskText = clean(task, 4000).toLowerCase();

  const qualityFirst = ["requirements", "security", "testing"];
  let taskSpecific = ["verification", "architecture", "research", "backend", "frontend", "media"];

  if (/video|music|song|audio|image|film|voice|sound|media/.test(taskText)) {
    taskSpecific = ["media", "research", "architecture", "backend", "frontend"];
  } else if (/website|web app|frontend|interface|ui|design/.test(taskText)) {
    taskSpecific = ["frontend", "architecture", "backend", "research", "media"];
  } else if (/api|backend|database|server|authentication|security|code|software|application/.test(taskText)) {
    taskSpecific = ["architecture", "backend", "frontend", "research", "media"];
  } else if (/research|compare|evidence|sources|investigate/.test(taskText)) {
    taskSpecific = ["research", "architecture", "backend", "frontend", "media"];
  }

  const preferred = [...new Set([...qualityFirst, ...taskSpecific, "verification"])];
  const ranked = [...specialists].sort((a, b) => {
    const ai = preferred.indexOf(a.id);
    const bi = preferred.indexOf(b.id);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  return ranked.slice(0, Math.max(1, Math.min(6, Number(maxSpecialists) || 4)));
}

function buildSpecialistMessages(task, specialist, sharedContext = "") {
  return [
    {
      role: "system",
      content: [
        "You are a specialist agent inside Nkwasibwe IRHCF.",
        "You do not execute external side effects.",
        "You own only your assigned specialty.",
        "Return a concise, actionable engineering/analysis brief for the Master Agent.",
        "State assumptions explicitly and identify risks or missing capabilities.",
        "",
        `SPECIALTY: ${clean(specialist?.id, 100)}`,
        `ROLE: ${clean(specialist?.description, 1000)}`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "MAIN TASK:",
        clean(task, 4000),
        "",
        "SHARED CONTEXT:",
        clean(sharedContext, 1200),
        "",
        "Produce your specialist brief. Do not claim an action was performed unless the brief is only describing a plan."
      ].join("\n")
    }
  ];
}

async function runSpecialistTeam({
  task,
  team,
  executionEngine,
  userId = null,
  taskId = null,
  taskRunId = null,
  sharedContext = "",
  maxSpecialists = 4
} = {}) {
  if (!executionEngine || typeof executionEngine.execute !== "function") {
    throw new Error("Multi-agent execution requires the central execution engine.");
  }

  const selected = selectSpecialists(team, maxSpecialists, task);
  const results = [];

  for (const specialist of selected) {
    try {
      const execution = await executionEngine.execute({
        action: "generate_text",
        capabilities: ["response_generation"],
        authorized: false,
        userId,
        taskId,
        taskRunId,
        input: {
          messages: buildSpecialistMessages(
            task,
            specialist,
            sharedContext
          ),
          options: {
            temperature: 0.2,
            maxTokens: 450
          }
        },
        metadata: {
          source: "multi-agent-team",
          specialist: specialist.id
        }
      });

      results.push({
        specialist: specialist.id,
        description: specialist.description,
        provider: execution?.provider || null,
        model: execution?.model || null,
        brief: clean(
          execution?.result?.choices?.[0]?.message?.content ??
          execution?.result?.output_text ??
          execution?.result?.content ??
          execution?.result,
          3500
        ),
        status: "completed"
      });
    } catch (error) {
      results.push({
        specialist: specialist.id,
        description: specialist.description,
        status: "failed",
        error: clean(
          error?.message || String(error),
          1000
        )
      });
    }
  }

  return {
    mode: "specialist_team",
    teamTypes: Array.isArray(team?.teamTypes) ? team.teamTypes : [],
    supervisors: Array.isArray(team?.supervisors) ? team.supervisors : [],
    selectedSpecialists: selected.map(item => item.id),
    completed: results.filter(item => item.status === "completed").length,
    failed: results.filter(item => item.status === "failed").length,
    results
  };
}

function formatSpecialistBriefs(teamExecution) {
  if (!teamExecution || !Array.isArray(teamExecution.results)) {
    return "";
  }

  const completed = teamExecution.results.filter(
    item => item.status === "completed" && item.brief
  );

  if (!completed.length) return "";

  return completed
    .map(item =>
      [
        `[SPECIALIST: ${item.specialist}]`,
        item.brief
      ].join("\n")
    )
    .join("\n\n")
    .slice(0, 12000);
}

module.exports = {
  selectSpecialists,
  buildSpecialistMessages,
  runSpecialistTeam,
  formatSpecialistBriefs
};
