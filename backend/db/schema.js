const pool = require("./pool");

/**
 * ============================================================
 * NKWASIBWE IRHCF
 * DATABASE SCHEMA
 * ============================================================
 *
 * Purpose:
 * - Create all required tables
 * - Upgrade older databases safely
 * - Add missing columns
 * - Create indexes
 * - Create constraints
 * - Create foreign-key relationships
 * - Seed core capabilities and tools
 * - Track schema version
 *
 * IMPORTANT:
 * This function is designed to be safe to run repeatedly.
 * Existing tables/data should not be deleted.
 * ============================================================
 */

async function createSchema() {

  console.log("Checking database schema...");

  // ============================================================
  // 1. USERS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 2. CONVERSATIONS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'New conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 3. MESSAGES
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 4. USER MEMORY
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      memory_key TEXT NOT NULL,
      memory_value TEXT NOT NULL,
      memory_type TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 5. LONG TERM MEMORY
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS long_term_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      content TEXT NOT NULL,
      memory_type TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      source TEXT DEFAULT 'user',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 6. KNOWLEDGE
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      content TEXT NOT NULL,
      source TEXT,
      source_type TEXT DEFAULT 'text',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 7. TASKS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      task TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 1,
      result TEXT,
      error TEXT,
      attempts INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 8. TASK RUNS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_runs (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      run_number INTEGER NOT NULL,
      status TEXT DEFAULT 'started',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );
  `);

  // ============================================================
  // 9. AGENT RUNS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      conversation_id INTEGER,
      task_id INTEGER,
      goal TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      plan JSONB DEFAULT '[]'::jsonb,
      result TEXT,
      error TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );
  `);

  // ============================================================
  // 10. AGENT STEPS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_steps (
      id SERIAL PRIMARY KEY,
      agent_run_id INTEGER,
      step_number INTEGER NOT NULL,
      phase TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 11. CAPABILITIES
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capabilities (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      module_path TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      version TEXT DEFAULT '1.0.0',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 12. TOOLS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tools (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      module_path TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      requires_auth BOOLEAN DEFAULT TRUE,
      input_schema JSONB DEFAULT '{}'::jsonb,
      metadata JSONB DEFAULT '{}'::jsonb,
      version TEXT DEFAULT '1.0.0',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 13. TOOL RUNS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tool_runs (
      id SERIAL PRIMARY KEY,
      tool_id INTEGER,
      agent_run_id INTEGER,
      user_id INTEGER,
      status TEXT DEFAULT 'started',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );
  `);

  // ============================================================
  // 14. CAPABILITY REQUESTS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capability_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      requested_capability TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'discovered',
      priority INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 15. SYSTEM SETTINGS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value JSONB NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 16. SCHEMA MIGRATIONS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version TEXT UNIQUE NOT NULL,
      description TEXT,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // 17. SYSTEM LOGS
  // ============================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      component TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("All base tables checked.");

  // ============================================================
  // SAFE MIGRATIONS
  // ============================================================
  //
  // IMPORTANT:
  // CREATE TABLE IF NOT EXISTS does NOT add missing columns
  // to an existing table.
  //
  // These migrations make older production databases compatible.
  // ============================================================

  // ------------------------------------------------------------
  // USERS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);
// ------------------------------------------------------------
// CONVERSATIONS MIGRATION
// ------------------------------------------------------------

await pool.query(`
  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS session_id TEXT;

  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS title TEXT
      DEFAULT 'New conversation';

  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP;

  ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
      DEFAULT CURRENT_TIMESTAMP;

  ALTER TABLE conversations
    DROP COLUMN IF EXISTS role;

  ALTER TABLE conversations
    DROP COLUMN IF EXISTS content;
`);
  

  // ------------------------------------------------------------
  // MESSAGES MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS conversation_id INTEGER;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS role TEXT;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // USER MEMORY MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_key TEXT;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_value TEXT;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_type TEXT
        DEFAULT 'general';

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS importance INTEGER
        DEFAULT 1;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // LONG TERM MEMORY MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS memory_type TEXT
        DEFAULT 'general';

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS importance INTEGER
        DEFAULT 1;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS source TEXT
        DEFAULT 'user';

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // KNOWLEDGE MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS title TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS source TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS source_type TEXT
        DEFAULT 'text';

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // TASKS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS task TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'pending';

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS priority INTEGER
        DEFAULT 1;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS result TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS attempts INTEGER
        DEFAULT 0;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // TASK RUNS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS task_id INTEGER;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS run_number INTEGER;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'started';

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS input JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS output JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // AGENT RUNS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS conversation_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS task_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS goal TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'planning';

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS plan JSONB
        DEFAULT '[]'::jsonb;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS result TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // AGENT STEPS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS agent_run_id INTEGER;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS step_number INTEGER;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS phase TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'pending';

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS input JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS output JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // CAPABILITIES MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS name TEXT;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS category TEXT
        DEFAULT 'general';

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS module_path TEXT;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN
        DEFAULT TRUE;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS version TEXT
        DEFAULT '1.0.0';

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE capabilities
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // TOOLS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS name TEXT;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS category TEXT
        DEFAULT 'general';

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS module_path TEXT;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS enabled BOOLEAN
        DEFAULT TRUE;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN
        DEFAULT TRUE;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS input_schema JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS version TEXT
        DEFAULT '1.0.0';

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // TOOL RUNS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS tool_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS agent_run_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'started';

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS input JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS output JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
  `);

  // ------------------------------------------------------------
  // CAPABILITY REQUESTS MIGRATION
  // ------------------------------------------------------------

  await pool.query(`
    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS requested_capability TEXT;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS status TEXT
        DEFAULT 'discovered';

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS priority INTEGER
        DEFAULT 1;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS metadata JSONB
        DEFAULT '{}'::jsonb;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP;
  `);

  console.log("Safe migrations completed.");

  // ============================================================
  // IMPORTANT USER DATA REPAIR
  // ============================================================
  //
  // Older databases can contain NULL values in columns that
  // newer application code expects to exist.
  //
  // We only repair safe defaults here.
  // ============================================================

  await pool.query(`
    UPDATE users
    SET updated_at = COALESCE(
      updated_at,
      created_at,
      CURRENT_TIMESTAMP
    )
    WHERE updated_at IS NULL;
  `);

  await pool.query(`
    UPDATE conversations
    SET title = COALESCE(
      title,
      'New conversation'
    )
    WHERE title IS NULL;
  `);

  await pool.query(`
    UPDATE user_memory
    SET importance = COALESCE(
      importance,
      1
    )
    WHERE importance IS NULL;
  `);

  await pool.query(`
    UPDATE long_term_memory
    SET importance = COALESCE(
      importance,
      1
    )
    WHERE importance IS NULL;
  `);

  await pool.query(`
    UPDATE tasks
    SET attempts = COALESCE(
      attempts,
      0
    )
    WHERE attempts IS NULL;
  `);
    // ============================================================
  // INDEXES
  // ============================================================

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);

    CREATE INDEX IF NOT EXISTS idx_users_created_at
      ON users(created_at);

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id
      ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_session_id
      ON conversations(session_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
      ON conversations(updated_at);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON messages(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages(created_at);

    CREATE INDEX IF NOT EXISTS idx_user_memory_user_id
      ON user_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_user_memory_type
      ON user_memory(memory_type);

    CREATE INDEX IF NOT EXISTS idx_long_term_memory_user_id
      ON long_term_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_long_term_memory_type
      ON long_term_memory(memory_type);

    CREATE INDEX IF NOT EXISTS idx_knowledge_user_id
      ON knowledge(user_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_source_type
      ON knowledge(source_type);

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id
      ON tasks(user_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_status
      ON tasks(status);

    CREATE INDEX IF NOT EXISTS idx_tasks_priority
      ON tasks(priority);

    CREATE INDEX IF NOT EXISTS idx_task_runs_task_id
      ON task_runs(task_id);

    CREATE INDEX IF NOT EXISTS idx_task_runs_status
      ON task_runs(status);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id
      ON agent_runs(user_id);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation_id
      ON agent_runs(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id
      ON agent_runs(task_id);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_status
      ON agent_runs(status);

    CREATE INDEX IF NOT EXISTS idx_agent_steps_agent_run_id
      ON agent_steps(agent_run_id);

    CREATE INDEX IF NOT EXISTS idx_agent_steps_phase
      ON agent_steps(phase);

    CREATE INDEX IF NOT EXISTS idx_tools_category
      ON tools(category);

    CREATE INDEX IF NOT EXISTS idx_tools_enabled
      ON tools(enabled);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_tool_id
      ON tool_runs(tool_id);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_agent_run_id
      ON tool_runs(agent_run_id);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_user_id
      ON tool_runs(user_id);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_status
      ON tool_runs(status);

    CREATE INDEX IF NOT EXISTS idx_capabilities_category
      ON capabilities(category);

    CREATE INDEX IF NOT EXISTS idx_capabilities_enabled
      ON capabilities(enabled);

    CREATE INDEX IF NOT EXISTS idx_capability_requests_user_id
      ON capability_requests(user_id);

    CREATE INDEX IF NOT EXISTS idx_capability_requests_status
      ON capability_requests(status);

    CREATE INDEX IF NOT EXISTS idx_system_logs_level
      ON system_logs(level);

    CREATE INDEX IF NOT EXISTS idx_system_logs_component
      ON system_logs(component);

    CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
      ON system_logs(created_at);
  `);

  console.log("Database indexes checked.");

  // ============================================================
  // UNIQUE INDEXES
  // ============================================================

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_user_memory_user_key_unique
    ON user_memory(user_id, memory_key);
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_users_email_unique
    ON users(email);
  `);

  // ============================================================
  // FOREIGN KEY RELATIONSHIPS
  // ============================================================
  //
  // Each constraint is checked before creation so this function
  // can safely run against an existing production database.
  // ============================================================

  // ------------------------------------------------------------
  // conversations -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_conversations_user'
      ) THEN

        ALTER TABLE conversations
        ADD CONSTRAINT fk_conversations_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // messages -> conversations
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_messages_conversation'
      ) THEN

        ALTER TABLE messages
        ADD CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // user_memory -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_memory_user'
      ) THEN

        ALTER TABLE user_memory
        ADD CONSTRAINT fk_user_memory_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // long_term_memory -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_long_term_memory_user'
      ) THEN

        ALTER TABLE long_term_memory
        ADD CONSTRAINT fk_long_term_memory_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // knowledge -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_knowledge_user'
      ) THEN

        ALTER TABLE knowledge
        ADD CONSTRAINT fk_knowledge_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // tasks -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tasks_user'
      ) THEN

        ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // task_runs -> tasks
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_task_runs_task'
      ) THEN

        ALTER TABLE task_runs
        ADD CONSTRAINT fk_task_runs_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // agent_runs -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_agent_runs_user'
      ) THEN

        ALTER TABLE agent_runs
        ADD CONSTRAINT fk_agent_runs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // agent_runs -> conversations
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_agent_runs_conversation'
      ) THEN

        ALTER TABLE agent_runs
        ADD CONSTRAINT fk_agent_runs_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE SET NULL;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // agent_runs -> tasks
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_agent_runs_task'
      ) THEN

        ALTER TABLE agent_runs
        ADD CONSTRAINT fk_agent_runs_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE SET NULL;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // agent_steps -> agent_runs
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_agent_steps_run'
      ) THEN

        ALTER TABLE agent_steps
        ADD CONSTRAINT fk_agent_steps_run
        FOREIGN KEY (agent_run_id)
        REFERENCES agent_runs(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // tool_runs -> tools
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tool_runs_tool'
      ) THEN

        ALTER TABLE tool_runs
        ADD CONSTRAINT fk_tool_runs_tool
        FOREIGN KEY (tool_id)
        REFERENCES tools(id)
        ON DELETE SET NULL;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // tool_runs -> agent_runs
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tool_runs_agent'
      ) THEN

        ALTER TABLE tool_runs
        ADD CONSTRAINT fk_tool_runs_agent
        FOREIGN KEY (agent_run_id)
        REFERENCES agent_runs(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // tool_runs -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tool_runs_user'
      ) THEN

        ALTER TABLE tool_runs
        ADD CONSTRAINT fk_tool_runs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  // ------------------------------------------------------------
  // capability_requests -> users
  // ------------------------------------------------------------

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_capability_requests_user'
      ) THEN

        ALTER TABLE capability_requests
        ADD CONSTRAINT fk_capability_requests_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;

      END IF;
    END
    $$;
  `);

  console.log("Foreign-key relationships checked.");

  // ============================================================
  // STATUS CONSTRAINTS
  // ============================================================

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_tasks_status'
      ) THEN

        ALTER TABLE tasks
        ADD CONSTRAINT chk_tasks_status
        CHECK (
          status IN (
            'pending',
            'planning',
            'running',
            'testing',
            'repairing',
            'verifying',
            'completed',
            'failed',
            'cancelled'
          )
        );

      END IF;

    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_agent_runs_status'
      ) THEN

        ALTER TABLE agent_runs
        ADD CONSTRAINT chk_agent_runs_status
        CHECK (
          status IN (
            'planning',
            'executing',
            'testing',
            'repairing',
            'verifying',
            'completed',
            'failed',
            'cancelled'
          )
        );

      END IF;

    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_agent_steps_status'
      ) THEN

        ALTER TABLE agent_steps
        ADD CONSTRAINT chk_agent_steps_status
        CHECK (
          status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'skipped',
            'repairing'
          )
        );

      END IF;

    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_tool_runs_status'
      ) THEN

        ALTER TABLE tool_runs
        ADD CONSTRAINT chk_tool_runs_status
        CHECK (
          status IN (
            'started',
            'running',
            'completed',
            'failed',
            'cancelled'
          )
        );

      END IF;

    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_capability_requests_status'
      ) THEN

        ALTER TABLE capability_requests
        ADD CONSTRAINT chk_capability_requests_status
        CHECK (
          status IN (
            'discovered',
            'requested',
            'planning',
            'building',
            'testing',
            'ready',
            'rejected',
            'failed'
          )
        );

      END IF;

    END
    $$;
  `);

  console.log("Status constraints checked.");

  // ============================================================
  // DEFAULT SYSTEM SETTINGS
  // ============================================================

  await pool.query(`
    INSERT INTO system_settings
      (
        setting_key,
        setting_value,
        description
      )
    VALUES
      (
        'agent_name',
        '"Nkwasibwe IRHCF"',
        'Primary AI Agent Platform name'
      ),
      (
        'agent_version',
        '"2.0.0"',
        'Current Nkwasibwe IRHCF version'
      ),
      (
        'agent_flow',
        '[
          "understand",
          "plan",
          "execute",
          "test",
          "repair",
          "verify",
          "deliver"
        ]',
        'Core autonomous task execution flow'
      ),
      (
        'memory_enabled',
        'true',
        'Enable persistent memory'
      ),
      (
        'knowledge_enabled',
        'true',
        'Enable knowledge storage and retrieval'
      ),
      (
        'self_improvement_enabled',
        'true',
        'Enable capability discovery and improvement workflows'
      )
    ON CONFLICT (setting_key)
    DO NOTHING;
  `);

  console.log("System settings checked.");

  // ============================================================
  // CORE CAPABILITIES
  // ============================================================

  await pool.query(`
    INSERT INTO capabilities
      (
        name,
        description,
        category,
        module_path,
        enabled,
        version,
        metadata
      )
    VALUES

      (
        'task_understanding',
        'Understand and analyze natural-language user tasks.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"understand"}'::jsonb
      ),

      (
        'task_planning',
        'Create an execution plan for a user task.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"plan"}'::jsonb
      ),

      (
        'task_execution',
        'Execute planned task steps using available capabilities and tools.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"execute"}'::jsonb
      ),

      (
        'result_testing',
        'Test task execution results before delivery.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"test"}'::jsonb
      ),

      (
        'error_repair',
        'Detect and repair execution errors when possible.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"repair"}'::jsonb
      ),

      (
        'result_verification',
        'Verify the final result against the task goal.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"verify"}'::jsonb
      ),

      (
        'result_delivery',
        'Deliver the verified result to the user.',
        'core',
        NULL,
        TRUE,
        '1.0.0',
        '{"phase":"deliver"}'::jsonb
      ),

      (
        'memory_management',
        'Store and retrieve useful user and system memory.',
        'memory',
        NULL,
        TRUE,
        '1.0.0',
        '{"persistent":true}'::jsonb
      ),

      (
        'knowledge_management',
        'Store and retrieve structured knowledge.',
        'knowledge',
        NULL,
        TRUE,
        '1.0.0',
        '{"persistent":true}'::jsonb
      ),

      (
        'capability_discovery',
        'Identify missing capabilities required by tasks.',
        'self_improvement',
        NULL,
        TRUE,
        '1.0.0',
        '{"self_improvement":true}'::jsonb
      ),

      (
        'capability_improvement',
        'Track and improve available capabilities over time.',
        'self_improvement',
        NULL,
        TRUE,
        '1.0.0',
        '{"self_improvement":true}'::jsonb
      )

    ON CONFLICT (name)
    DO NOTHING;
  `);

  console.log("Core capabilities checked.");

  // ============================================================
  // CORE TOOLS
  // ============================================================
await pool.query(`
    INSERT INTO tools
      (
        name,
        description,
        category,
        module_path,
        enabled,
        requires_auth,
        input_schema,
        metadata,
        version
      )
    VALUES

      (
        'memory_read',
        'Read relevant persistent memory.',
        'memory',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "key":{"type":"string"}
          }
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      ),

      (
        'memory_write',
        'Write useful persistent memory.',
        'memory',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "key":{"type":"string"},
            "value":{"type":"string"}
          }
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      ),

      (
        'knowledge_search',
        'Search stored knowledge.',
        'knowledge',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "query":{"type":"string"}
          },
          "required":["query"]
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      ),

      (
        'task_create',
        'Create a persistent task.',
        'task',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "task":{"type":"string"},
            "priority":{"type":"integer"}
          },
          "required":["task"]
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      ),

      (
        'agent_run_create',
        'Create an autonomous agent execution run.',
        'agent',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "goal":{"type":"string"},
            "conversation_id":{"type":"integer"},
            "task_id":{"type":"integer"}
          },
          "required":["goal"]
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      ),

      (
        'capability_request',
        'Record a missing capability discovered during task execution.',
        'self_improvement',
        NULL,
        TRUE,
        TRUE,
        '{
          "type":"object",
          "properties":{
            "user_id":{"type":"integer"},
            "requested_capability":{"type":"string"},
            "description":{"type":"string"},
            "priority":{"type":"integer"}
          },
          "required":["requested_capability"]
        }'::jsonb,
        '{"internal":true}'::jsonb,
        '1.0.0'
      )

    ON CONFLICT (name)
    DO NOTHING;
  `);

  console.log("Core tools checked.");

  // ============================================================
  // SCHEMA VERSION
  // ============================================================

  await pool.query(`
    INSERT INTO schema_migrations
      (
        version,
        description
      )
    VALUES
      (
        '2.0.0',
        'Nkwasibwe IRHCF production schema with safe migrations, indexes, relationships, constraints, core capabilities and tools'
      )
    ON CONFLICT (version)
    DO NOTHING;
  `);

  // ============================================================
  // SCHEMA VERIFICATION
  // ============================================================

  const requiredTables = [
    "users",
    "conversations",
    "messages",
    "user_memory",
    "long_term_memory",
    "knowledge",
    "tasks",
    "task_runs",
    "agent_runs",
    "agent_steps",
    "capabilities",
    "tools",
    "tool_runs",
    "capability_requests",
    "system_settings",
    "schema_migrations",
    "system_logs"
  ];

  for (const tableName of requiredTables) {

    const result = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        ) AS exists;
      `,
      [tableName]
    );

    if (!result.rows[0].exists) {
      throw new Error(
        `Required database table is missing: ${tableName}`
      );
    }
  }

  // ============================================================
  // CRITICAL USERS COLUMN VERIFICATION
  // ============================================================

  const usersColumns = [
    "id",
    "name",
    "email",
    "password_hash",
    "created_at",
    "updated_at"
  ];

  for (const columnName of usersColumns) {

    const result = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = $1
        ) AS exists;
      `,
      [columnName]
    );

    if (!result.rows[0].exists) {
      throw new Error(
        `Required users column is missing: ${columnName}`
      );
    }
  }

  // ============================================================
  // FINAL STATUS
  // ============================================================

  console.log("Database schema verification passed.");
  console.log("Database schema is ready!");
}

// ============================================================
// EXPORT
// ============================================================

module.exports = createSchema;
  
