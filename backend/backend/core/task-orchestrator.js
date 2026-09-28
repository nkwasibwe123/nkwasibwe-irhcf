"use strict";

/**
 * ============================================================
 * NKWASIBWE IRHCF
 * TASK ORCHESTRATION ENGINE
 * ============================================================
 *
 * Phase 1:
 * - Task understanding
 * - Task classification
 * - Complexity estimation
 * - Capability discovery
 * - Execution strategy
 * - Verification strategy
 *
 * IMPORTANT:
 * This module does NOT execute external actions.
 * It only produces a safe execution plan.
 *
 * Future phases will connect:
 * - web research
 * - browser
 * - code execution
 * - media
 * - voice
 * - deployment
 * - agent factory
 * - self-repair
 * ============================================================
 */

const ENGINE_NAME =
  "Nkwasibwe Task Orchestration Engine";

const ENGINE_VERSION =
  "1.0.0";

/* ============================================================
 * LIMITS
 * ============================================================
 */

const LIMITS = Object.freeze({
  maxTaskLength: 100000,
  maxPlanSteps: 25,
  maxCapabilities: 50,
  maxKeywords: 100
});

/* ============================================================
 * TASK TYPES
 * ============================================================
 */

const TASK_TYPES = Object.freeze({
  CONVERSATION: "conversation",
  QUESTION: "question",
  RESEARCH: "research",
  WRITING: "writing",
  CODING: "coding",
  SOFTWARE_BUILD: "software_build",
  WEB_BUILD: "web_build",
  DATA: "data",
  MEDIA: "media",
  BUSINESS: "business",
  AUTOMATION: "automation",
  ANALYSIS: "analysis",
  TRANSLATION: "translation",
  PLANNING: "planning",
  UNKNOWN: "unknown"
});

/* ============================================================
 * COMPLEXITY LEVELS
 * ============================================================
 */

const COMPLEXITY = Object.freeze({
  SIMPLE: "simple",
  MODERATE: "moderate",
  COMPLEX: "complex",
  AUTONOMOUS: "autonomous"
});

/* ============================================================
 * EXECUTION MODES
 * ============================================================
 */

const EXECUTION_MODES = Object.freeze({
  RESPOND: "respond",
  RESEARCH: "research",
  PLAN_AND_EXECUTE: "plan_and_execute",
  BUILD_AND_TEST: "build_and_test",
  ANALYZE_AND_VERIFY: "analyze_and_verify",
  MULTI_AGENT: "multi_agent"
});

/* ============================================================
 * CAPABILITY CATALOG
 * ============================================================
 */

const CAPABILITIES = Object.freeze([
  "conversation",
  "reasoning",
  "planning",
  "writing",
  "translation",
  "research",
  "web_search",
  "source_verification",
  "coding",
  "software_architecture",
  "frontend_development",
  "backend_development",
  "database",
  "api_integration",
  "testing",
  "debugging",
  "self_repair",
  "data_analysis",
  "document_generation",
  "image_generation",
  "audio_generation",
  "music_generation",
  "video_generation",
  "voice",
  "browser_automation",
  "deployment",
  "monitoring",
  "business_analysis",
  "marketing",
  "automation",
  "project_management"
]);

/* ============================================================
 * KEYWORD MAP
 * ============================================================
 */

const KEYWORD_MAP = Object.freeze({
  research: [
    "research",
    "ubushakashatsi",
    "shakisha",
    "search",
    "investigate",
    "iga",
    "amakuru",
    "sources"
  ],

  coding: [
    "code",
    "coding",
    "program",
    "programming",
    "javascript",
    "python",
    "typescript",
    "backend",
    "frontend",
    "api",
    "database",
    "bug",
    "debug"
  ],

  software: [
    "app",
    "application",
    "software",
    "platform",
    "system",
    "website",
    "web app",
    "mobile app",
    "build",
    "create"
  ],

  media: [
    "image",
    "photo",
    "video",
    "music",
    "song",
    "audio",
    "voice",
    "thumbnail",
    "film"
  ],

  business: [
    "business",
    "company",
    "startup",
    "customer",
    "sales",
    "marketing",
    "revenue",
    "money",
    "product",
    "market"
  ],

  translation: [
    "translate",
    "translation",
    "hindura",
    "guhindura",
    "language",
    "kinyarwanda",
    "english",
    "french"
  ],

  analysis: [
    "analyze",
    "analysis",
    "compare",
    "evaluate",
    "sesengura",
    "igereranya",
    "explain"
  ],

  automation: [
    "automate",
    "automation",
    "schedule",
    "publish",
    "upload",
    "daily",
    "weekly",
    "recurring",
    "automatic"
  ]
});

/* ============================================================
 * SAFE TEXT
 * ============================================================
 */

function safeText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, "")
    .trim()
    .slice(
      0,
      LIMITS.maxTaskLength
    );
}

/* ============================================================
 * TOKENIZE
 * ============================================================
 */

function tokenize(text) {
  return safeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(
      0,
      LIMITS.maxKeywords
    );
}

/* ============================================================
 * KEYWORD MATCHING
 * ============================================================
 */

function containsKeyword(
  text,
  keyword
) {
  const normalized =
    text.toLowerCase();

  return normalized.includes(
    keyword.toLowerCase()
  );
}

/* ============================================================
 * DETECT DOMAINS
 * ============================================================
 */

function detectDomains(text) {
  const domains = [];

  for (
    const [
      domain,
      keywords
    ] of Object.entries(
      KEYWORD_MAP
    )
  ) {
    const matched =
      keywords.some(
        keyword =>
          containsKeyword(
            text,
            keyword
          )
      );

    if (matched) {
      domains.push(domain);
    }
  }

  return domains;
}

/* ============================================================
 * DETECT TASK TYPE
 * ============================================================
 */

function detectTaskType(
  text,
  domains
) {
  const lower =
    text.toLowerCase();

  if (
    domains.includes("coding") &&
    (
      domains.includes("software") ||
      lower.includes("build") ||
      lower.includes("create")
    )
  ) {
    return TASK_TYPES.SOFTWARE_BUILD;
  }

  if (
    domains.includes("software") &&
    lower.includes("website")
  ) {
    return TASK_TYPES.WEB_BUILD;
  }

  if (
    domains.includes("research")
  ) {
    return TASK_TYPES.RESEARCH;
  }

  if (
    domains.includes("translation")
  ) {
    return TASK_TYPES.TRANSLATION;
  }

  if (
    domains.includes("media")
  ) {
    return TASK_TYPES.MEDIA;
  }

  if (
    domains.includes("business")
  ) {
    return TASK_TYPES.BUSINESS;
  }

  if (
    domains.includes("analysis")
  ) {
    return TASK_TYPES.ANALYSIS;
  }

  if (
    domains.includes("automation")
  ) {
    return TASK_TYPES.AUTOMATION;
  }

  if (
    domains.includes("coding")
  ) {
    return TASK_TYPES.CODING;
  }

  if (
    lower.startsWith("what ") ||
    lower.startsWith("why ") ||
    lower.startsWith("how ") ||
    lower.includes("ninde") ||
    lower.includes("kuki") ||
    lower.includes("ute")
  ) {
    return TASK_TYPES.QUESTION;
  }

  return TASK_TYPES.CONVERSATION;
}

/* ============================================================
 * COMPLEXITY
 * ============================================================
 */

function estimateComplexity(
  text,
  domains
) {
  const lower =
    text.toLowerCase();

  let score = 0;

  if (
    text.length > 300
  ) {
    score += 1;
  }

  if (
    text.length > 1000
  ) {
    score += 2;
  }

  if (
    domains.length >= 2
  ) {
    score += 2;
  }

  if (
    domains.length >= 4
  ) {
    score += 2;
  }

  const complexSignals = [
    "build",
    "create",
    "develop",
    "deploy",
    "automate",
    "research",
    "analyze",
    "integrate",
    "website",
    "application",
    "platform",
    "system",
    "business",
    "daily",
    "continuous",
    "autonomous",
    "24/7",
    "end-to-end",
    "full"
  ];

  for (
    const signal of complexSignals
  ) {
    if (
      lower.includes(signal)
    ) {
      score += 1;
    }
  }

  if (
    score >= 9
  ) {
    return COMPLEXITY.AUTONOMOUS;
  }

  if (
    score >= 5
  ) {
    return COMPLEXITY.COMPLEX;
  }

  if (
    score >= 2
  ) {
    return COMPLEXITY.MODERATE;
  }

  return COMPLEXITY.SIMPLE;
}

/* ============================================================
 * CAPABILITY DISCOVERY
 * ============================================================
 */

function discoverCapabilities(
  text,
  domains,
  taskType
) {
  const result =
    new Set();

  result.add(
    "conversation"
  );

  result.add(
    "reasoning"
  );

  result.add(
    "planning"
  );

  if (
    domains.includes(
      "research"
    )
  ) {
    result.add(
      "research"
    );

    result.add(
      "web_search"
    );

    result.add(
      "source_verification"
    );
  }

  if (
    domains.includes(
      "coding"
    )
  ) {
    result.add(
      "coding"
    );

    result.add(
      "debugging"
    );

    result.add(
      "testing"
    );
  }

  if (
    taskType ===
    TASK_TYPES.SOFTWARE_BUILD
  ) {
    result.add(
      "software_architecture"
    );

    result.add(
      "frontend_development"
    );

    result.add(
      "backend_development"
    );

    result.add(
      "database"
    );

    result.add(
      "api_integration"
    );

    result.add(
      "testing"
    );
  }

  if (
    taskType ===
    TASK_TYPES.WEB_BUILD
  ) {
    result.add(
      "frontend_development"
    );

    result.add(
      "backend_development"
    );

    result.add(
      "deployment"
    );
  }

  if (
    domains.includes(
      "media"
    )
  ) {
    result.add(
      "image_generation"
    );

    result.add(
      "audio_generation"
    );

    result.add(
      "video_generation"
    );

    result.add(
      "voice"
    );
  }

  if (
    domains.includes(
      "business"
    )
  ) {
    result.add(
      "business_analysis"
    );

    result.add(
      "market_research"
    );

    result.add(
      "marketing"
    );
  }

  if (
    domains.includes(
      "translation"
    )
  ) {
    result.add(
      "translation"
    );
  }

  if (
    domains.includes(
      "automation"
    )
  ) {
    result.add(
      "automation"
    );

    result.add(
      "project_management"
    );
  }

  if (
    domains.includes(
      "analysis"
    )
  ) {
    result.add(
      "data_analysis"
    );
  }

  return Array.from(
    result
  ).filter(
    capability =>
      CAPABILITIES.includes(
        capability
      )
  );
}

/* ============================================================
 * EXECUTION MODE
 * ============================================================
 */

function determineExecutionMode(
  taskType,
  complexity,
  domains
) {
  if (
    complexity ===
    COMPLEXITY.AUTONOMOUS
  ) {
    return EXECUTION_MODES.MULTI_AGENT;
  }

  if (
    taskType ===
      TASK_TYPES.SOFTWARE_BUILD ||
    taskType ===
      TASK_TYPES.WEB_BUILD
  ) {
    return EXECUTION_MODES.BUILD_AND_TEST;
  }

  if (
    taskType ===
    TASK_TYPES.RESEARCH
  ) {
    return EXECUTION_MODES.RESEARCH;
  }

  if (
    taskType ===
    TASK_TYPES.ANALYSIS
  ) {
    return EXECUTION_MODES.ANALYZE_AND_VERIFY;
  }

  if (
    complexity ===
    COMPLEXITY.COMPLEX
  ) {
    return EXECUTION_MODES.PLAN_AND_EXECUTE;
  }

  if (
    domains.length > 1
  ) {
    return EXECUTION_MODES.PLAN_AND_EXECUTE;
  }

  if (
    taskType ===
    TASK_TYPES.CONVERSATION
  ) {
    return EXECUTION_MODES.RESPOND;
  }

  return EXECUTION_MODES.PLAN_AND_EXECUTE;
}

/* ============================================================
 * PLAN BUILDER
 * ============================================================
 */

function buildPlan(
  taskType,
  complexity,
  mode,
  capabilities
) {
  const steps = [];

  steps.push({
    id: 1,
    name: "understand",
    status: "planned",
    purpose:
      "Understand the user's objective and constraints."
  });

  if (
    complexity !==
    COMPLEXITY.SIMPLE
  ) {
    steps.push({
      id: steps.length + 1,
      name: "plan",
      status: "planned",
      purpose:
        "Break the objective into executable steps."
    });
  }

  if (
    capabilities.includes(
      "research"
    )
  ) {
    steps.push({
      id: steps.length + 1,
      name: "research",
      status: "planned",
      purpose:
        "Gather relevant information from permitted sources."
    });
  }

  if (
    capabilities.includes(
      "coding"
    ) ||
    capabilities.includes(
      "software_architecture"
    )
  ) {
    steps.push({
      id: steps.length + 1,
      name: "build",
      status: "planned",
      purpose:
        "Create or modify the required software components."
    });
  }

  if (
    capabilities.includes(
      "automation"
    )
  ) {
    steps.push({
      id: steps.length + 1,
      name: "automate",
      status: "planned",
      purpose:
        "Define repeatable execution where requested."
    });
  }

  steps.push({
    id: steps.length + 1,
    name: "execute",
    status: "planned",
    purpose:
      "Execute the approved task operations."
  });

  if (
    complexity !==
    COMPLEXITY.SIMPLE ||
    mode ===
      EXECUTION_MODES.BUILD_AND_TEST ||
    mode ===
      EXECUTION_MODES.ANALYZE_AND_VERIFY
  ) {
    steps.push({
      id: steps.length + 1,
      name: "test",
      status: "planned",
      purpose:
        "Test the result against the task requirements."
    });
  }

  steps.push({
    id: steps.length + 1,
    name: "verify",
    status: "planned",
    purpose:
      "Verify correctness, completeness and safety."
  });

  steps.push({
    id: steps.length + 1,
    name: "deliver",
    status: "planned",
    purpose:
      "Return the verified result to the user."
  });

  return steps.slice(
    0,
    LIMITS.maxPlanSteps
  );
}

/* ============================================================
 * VERIFICATION STRATEGY
 * ============================================================
 */

function buildVerificationStrategy(
  taskType,
  complexity
) {
  const checks = [
    "requirement_completeness",
    "output_validity"
  ];

  if (
    complexity !==
    COMPLEXITY.SIMPLE
  ) {
    checks.push(
      "consistency"
    );
  }

  if (
    taskType ===
      TASK_TYPES.CODING ||
    taskType ===
      TASK_TYPES.SOFTWARE_BUILD ||
    taskType ===
      TASK_TYPES.WEB_BUILD
  ) {
    checks.push(
      "syntax_validation"
    );

    checks.push(
      "functional_testing"
    );

    checks.push(
      "regression_testing"
    );

    checks.push(
      "security_review"
    );
  }

  if (
    taskType ===
    TASK_TYPES.RESEARCH
  ) {
    checks.push(
      "source_quality"
    );

    checks.push(
      "source_consistency"
    );
  }

  return checks;
}

/* ============================================================
 * MAIN TASK ANALYSIS
 * ============================================================
 */

function analyzeTask(
  task,
  options = {}
) {
  const text =
    safeText(task);

  if (!text) {
    const error =
      new Error(
        "Task is required."
      );

    error.code =
      "TASK_REQUIRED";

    throw error;
  }

  const tokens =
    tokenize(text);

  const domains =
    detectDomains(text);

  const taskType =
    detectTaskType(
      text,
      domains
    );

  const complexity =
    estimateComplexity(
      text,
      domains
    );

  const capabilities =
    discoverCapabilities(
      text,
      domains,
      taskType
    );

  const executionMode =
    determineExecutionMode(
      taskType,
      complexity,
      domains
    );

  const plan =
    buildPlan(
      taskType,
      complexity,
      executionMode,
      capabilities
    );

  const verification =
    buildVerificationStrategy(
      taskType,
      complexity
    );

  return {
    engine: {
      name:
        ENGINE_NAME,
      version:
        ENGINE_VERSION
    },

    task: {
      original:
        text,
      length:
        text.length,
      tokens:
        tokens.length
    },

    classification: {
      type:
        taskType,
      domains,
      complexity,
      executionMode
    },

    capabilities: {
      required:
        capabilities,
      count:
        capabilities.length
    },

    plan,

    verification,

    metadata: {
      userId:
        options.userId ||
        null,

      sessionId:
        options.sessionId ||
        null,

      createdAt:
        new Date().toISOString()
    }
  };
}

/* ============================================================
 * PLAN SUMMARY
 * ============================================================
 */

function summarizePlan(
  analysis
) {
  if (!analysis) {
    return "";
  }

  const type =
    analysis.classification?.type ||
    "unknown";

  const complexity =
    analysis.classification?.complexity ||
    "unknown";

  const mode =
    analysis.classification?.executionMode ||
    "unknown";

  const capabilities =
    Array.isArray(
      analysis.capabilities?.required
    )
      ? analysis.capabilities.required
      : [];

  return [
    `Task type: ${type}`,
    `Complexity: ${complexity}`,
    `Execution mode: ${mode}`,
    `Required capabilities: ${
      capabilities.join(", ") ||
      "reasoning"
    }`
  ].join(
    " | "
  );
}

/* ============================================================
 * PUBLIC API
 * ============================================================
 */

module.exports = {
  ENGINE_NAME,
  ENGINE_VERSION,

  TASK_TYPES,
  COMPLEXITY,
  EXECUTION_MODES,
  CAPABILITIES,

  analyzeTask,
  summarizePlan
};
