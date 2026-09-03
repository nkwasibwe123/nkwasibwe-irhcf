const pool = require("./pool");

async function createSchema() {
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
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'New conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      memory_key TEXT NOT NULL,
      memory_value TEXT NOT NULL,
      memory_type TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, memory_key)
    );

    CREATE TABLE IF NOT EXISTS long_term_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
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
      user_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE,
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
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      task TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'planning',
            'running',
            'completed',
            'failed',
            'cancelled'
          )
        ),
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
      task_id INTEGER NOT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,
      run_number INTEGER NOT NULL,
      status TEXT DEFAULT 'started',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      UNIQUE(task_id, run_number)
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
      conversation_id INTEGER
        REFERENCES conversations(id) ON DELETE SET NULL,
      task_id INTEGER
        REFERENCES tasks(id) ON DELETE SET NULL,
      goal TEXT NOT NULL,
      status TEXT DEFAULT 'planning'
        CHECK (
          status IN (
            'planning',
            'executing',
            'testing',
            'repairing',
            'verifying',
            'completed',
            'failed'
          )
        ),
      plan JSONB DEFAULT '[]'::jsonb,
      result TEXT,
      error TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_steps (
      id SERIAL PRIMARY KEY,
      agent_run_id INTEGER NOT NULL
        REFERENCES agent_runs(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      phase TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'skipped'
          )
        ),
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agent_run_id, step_number)
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
      tool_id INTEGER
        REFERENCES tools(id) ON DELETE SET NULL,
      agent_run_id INTEGER
        REFERENCES agent_runs(id) ON DELETE SET NULL,
      user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'started',
      input JSONB DEFAULT '{}'::jsonb,
      output JSONB DEFAULT '{}'::jsonb,
      error TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS capability_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
      requested_capability TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'discovered'
        CHECK (
          status IN (
            'discovered',
            'planned',
            'implemented',
            'rejected'
          )
        ),
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
      (name, description, category, module_path)
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
      (version, description)
    VALUES
      (
        '1.0.0',
        'Initial Nkwasibwe IRHCF AI Agent Platform schema'
      )
    ON CONFLICT (version) DO NOTHING;
  `);

  console.log("Database schema ready!");
}

module.exports = createSchema;
