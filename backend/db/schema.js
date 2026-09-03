const pool = require("./pool");

async function createSchema() {
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
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT 'New conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      memory_key TEXT NOT NULL,
      memory_value TEXT NOT NULL,
      memory_type TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, memory_key)
    );

    CREATE TABLE IF NOT EXISTS long_term_memory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      memory_type TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      source TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      result TEXT,
      error TEXT,
      attempts INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    CREATE TABLE IF NOT EXISTS knowledge (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      content TEXT NOT NULL,
      source TEXT,
      source_type TEXT DEFAULT 'text',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      component TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user
      ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_memory_user
      ON user_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_long_term_memory_user
      ON long_term_memory(user_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_user
      ON tasks(user_id);

    CREATE INDEX IF NOT EXISTS idx_knowledge_user
      ON knowledge(user_id);

    CREATE INDEX IF NOT EXISTS idx_logs_created
      ON system_logs(created_at);
  `);

  await pool.query(`
    INSERT INTO capabilities
      (name, description, category, module_path)
    VALUES
      ('conversation', 'Conversation management', 'core', 'internal'),
      ('persistent_memory', 'Persistent user memory', 'memory', 'internal'),
      ('long_term_memory', 'Long-term memory', 'memory', 'internal'),
      ('task_management', 'Task creation and tracking', 'agent', 'internal'),
      ('knowledge', 'Knowledge storage foundation', 'knowledge', 'internal'),
      ('logging', 'System logging and observability', 'system', 'internal')
    ON CONFLICT (name) DO NOTHING
  `);

  console.log("Database schema ready!");
}

module.exports = createSchema;
