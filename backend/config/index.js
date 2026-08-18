const config = {
  port: process.env.PORT || 3000,

  openaiApiKey: process.env.OPENAI_API_KEY,

  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,

  environment: process.env.NODE_ENV || "development"
};

module.exports = config;
