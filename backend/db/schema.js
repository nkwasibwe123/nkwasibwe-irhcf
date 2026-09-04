const pool = require("./pool");

async function createSchema() {
  console.log("Checking database schema...");

  // ============================================================
  // CREATE TABLES
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

    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'New conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value JSONB NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version TEXT UNIQUE NOT NULL,
      description TEXT,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      component TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ============================================================
  // SAFE MIGRATIONS
  // Add columns that may be missing from older tables
  // ============================================================

  await pool.query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS session_id TEXT;

    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'New conversation';

    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS conversation_id INTEGER;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS role TEXT;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_key TEXT;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_value TEXT;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'general';

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 1;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE user_memory
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'general';

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 1;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user';

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE long_term_memory
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS title TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS content TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS source TEXT;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text';

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE knowledge
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS task TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS result TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS task_id INTEGER;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS run_number INTEGER;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'started';

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE task_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;


    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS conversation_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS task_id INTEGER;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS goal TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planning';

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS plan JSONB DEFAULT '[]'::jsonb;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS result TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;


    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS agent_run_id INTEGER;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS step_number INTEGER;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS phase TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

    ALTER TABLE agent_steps
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS tool_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS agent_run_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'started';

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS error TEXT;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE tool_runs
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;


    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS user_id INTEGER;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS requested_capability TEXT;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS description TEXT;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'discovered';

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 1;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE capability_requests
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `);
  // ============================================================
  // UNIQUE CONSTRAINTS
  // ============================================================

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_user_memory_user_key_unique
    ON user_memory(user_id, memory_key);
  `);
  // ============================================================
  // FOREIGN KEY RELATIONSHIPS
  // ============================================================

  await pool.query(`
    DO $$
    BEGIN

      -- conversations → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_conversations_user'
      ) THEN
        ALTER TABLE conversations
        ADD CONSTRAINT
          fk_conversations_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- messages → conversations
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_messages_conversation'
      ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT
          fk_messages_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE;
      END IF;


      -- user_memory → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_user_memory_user'
      ) THEN
        ALTER TABLE user_memory
        ADD CONSTRAINT
          fk_user_memory_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- long_term_memory → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_long_term_memory_user'
      ) THEN
        ALTER TABLE long_term_memory
        ADD CONSTRAINT
          fk_long_term_memory_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- knowledge → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_knowledge_user'
      ) THEN
        ALTER TABLE knowledge
        ADD CONSTRAINT
          fk_knowledge_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- tasks → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_tasks_user'
      ) THEN
        ALTER TABLE tasks
        ADD CONSTRAINT
          fk_tasks_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- task_runs → tasks
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_task_runs_task'
      ) THEN
        ALTER TABLE task_runs
        ADD CONSTRAINT
          fk_task_runs_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE;
      END IF;


      -- agent_runs → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_agent_runs_user'
      ) THEN
        ALTER TABLE agent_runs
        ADD CONSTRAINT
          fk_agent_runs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;


      -- agent_runs → conversations
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_agent_runs_conversation'
      ) THEN
        ALTER TABLE agent_runs
        ADD CONSTRAINT
          fk_agent_runs_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE SET NULL;
      END IF;


      -- agent_runs → tasks
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_agent_runs_task'
      ) THEN
        ALTER TABLE agent_runs
        ADD CONSTRAINT
          fk_agent_runs_task
        FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE SET NULL;
      END IF;


      -- agent_steps → agent_runs
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_agent_steps_run'
      ) THEN
        ALTER TABLE agent_steps
        ADD CONSTRAINT
          fk_agent_steps_run
        FOREIGN KEY (agent_run_id)
        REFERENCES agent_runs(id)
        ON DELETE CASCADE;
      END IF;


      -- tool_runs → tools
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_tool_runs_tool'
      ) THEN
        ALTER TABLE tool_runs
        ADD CONSTRAINT
          fk_tool_runs_tool
        FOREIGN KEY (tool_id)
        REFERENCES tools(id)
        ON DELETE SET NULL;
      END IF;


      -- tool_runs → agent_runs
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_tool_runs_agent'
      ) THEN
        ALTER TABLE tool_runs
        ADD CONSTRAINT
          fk_tool_runs_agent
        FOREIGN KEY (agent_run_id)
        REFERENCES agent_runs(id)
        ON DELETE CASCADE;
      END IF;


      -- tool_runs → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_tool_runs_user'
      ) THEN
        ALTER TABLE tool_runs
        ADD CONSTRAINT
          fk_tool_runs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL;
      END IF;


      -- capability_requests → users
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'fk_capability_requests_user'
      ) THEN
        ALTER TABLE capability_requests
        ADD CONSTRAINT
          fk_capability_requests_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE;
      END IF;

    END $$;
  `);
    // ============================================================
  // STATUS VALIDATION CONSTRAINTS
  // ============================================================

  await pool.query(`
    DO $$
    BEGIN

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'chk_tasks_status'
      ) THEN
        ALTER TABLE tasks
        ADD CONSTRAINT
          chk_tasks_status
        CHECK (
          status IN (
            'pending',
            'planning',
            'running',
            'completed',
            'failed',
            'cancelled'
          )
        );
      END IF;


      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'chk_agent_runs_status'
      ) THEN
        ALTER TABLE agent_runs
        ADD CONSTRAINT
          chk_agent_runs_status
        CHECK (
          status IN (
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


      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
          'chk_agent_steps_status'
      ) THEN
        ALTER TABLE agent_steps
        ADD CONSTRAINT
          chk_agent_steps_status
        CHECK (
          status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'skipped'
          )
        );
      END IF;

    END $$;
  `);
  
  // ============================================================
  // INDEXES
  // ============================================================

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user
      ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_messages_created
      ON messages(created_at);

    CREATE INDEX IF NOT EXISTS idx_memory_user
      ON user_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_memory_importance
      ON user_memory(user_id, importance DESC);

    CREATE INDEX IF NOT EXISTS idx_long_term_memory_user
      ON long_term_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_long_term_memory_importance
      ON long_term_memory(user_id, importance DESC);

    CREATE INDEX IF NOT EXISTS idx_tasks_user
      ON tasks(user_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_status
      ON tasks(status);

    CREATE INDEX IF NOT EXISTS idx_task_runs_task
      ON task_runs(task_id);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_user
      ON agent_runs(user_id);

    CREATE INDEX IF NOT EXISTS idx_agent_runs_task
      ON agent_runs(task_id);

    CREATE INDEX IF NOT EXISTS idx_agent_steps_run
      ON agent_steps(agent_run_id);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_tool
      ON tool_runs(tool_id);

    CREATE INDEX IF NOT EXISTS idx_tool_runs_agent
      ON tool_runs(agent_run_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_user
      ON knowledge(user_id);

    CREATE INDEX IF NOT EXISTS idx_capability_requests_status
      ON capability_requests(status);

    CREATE INDEX IF NOT EXISTS idx_logs_created
      ON system_logs(created_at DESC);
  `);

  // ============================================================
  // INITIAL CAPABILITIES
  // ============================================================

  await pool.query(`
    INSERT INTO capabilities
      (
        name,
        description,
        category,
        module_path
      )
    VALUES
      (
        'conversation',
        'Conversation management',
        'core',
        'internal'
      ),
      (
        'persistent_memory',
        'Persistent user memory',
        'memory',
        'internal'
      ),
      (
        'long_term_memory',
        'Long-term memory storage',
        'memory',
        'internal'
      ),
      (
        'knowledge',
        'Knowledge storage foundation',
        'knowledge',
        'internal'
      ),
      (
        'task_management',
        'Task creation and tracking',
        'agent',
        'internal'
      ),
      (
        'agent_planning',
        'Task planning and decomposition',
        'agent',
        'internal'
      ),
      (
        'agent_execution',
        'Task execution framework',
        'agent',
        'internal'
      ),
      (
        'agent_verification',
        'Result verification framework',
        'agent',
        'internal'
      ),
      (
        'tool_registry',
        'Tool discovery and management',
        'tools',
        'internal'
      ),
      (
        'logging',
        'System logging and observability',
        'system',
        'internal'
      )
    ON CONFLICT (name) DO NOTHING;
  `);

  // ============================================================
  // INITIAL TOOLS
  // ============================================================

  await pool.query(`
    INSERT INTO tools
      (
        name,
        description,
        category,
        module_path,
        requires_auth
      )
    VALUES
      (
        'database',
        'Internal PostgreSQL database operations',
        'internal',
        'internal',
        TRUE
      ),
      (
        'memory',
        'Persistent memory operations',
        'memory',
        'internal',
        TRUE
      ),
      (
        'knowledge',
        'Knowledge base operations',
        'knowledge',
        'internal',
        TRUE
      )
    ON CONFLICT (name) DO NOTHING;
  `);

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
        '1.1.0',
        'Schema compatibility and missing-column migration'
      )
    ON CONFLICT (version) DO NOTHING;
  `);

  console.log("Database schema is ready!");
}

module.exports = createSchema;
