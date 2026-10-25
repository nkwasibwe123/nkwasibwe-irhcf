"use strict";

const express = require("express");

function ensureSocialSchema(pool) {
  if (!pool || typeof pool.query !== "function") throw new Error("Social routes require a database pool.");
  return pool.query(`
    CREATE TABLE IF NOT EXISTS social_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','friends','private')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS social_friend_requests (
      id BIGSERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (sender_id <> recipient_id),
      UNIQUE (sender_id, recipient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_social_friend_recipient_status ON social_friend_requests(recipient_id,status,created_at DESC);
    CREATE TABLE IF NOT EXISTS social_follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, followed_id),
      CHECK (follower_id <> followed_id)
    );
    CREATE TABLE IF NOT EXISTS social_posts (
      id BIGSERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL DEFAULT '',
      media JSONB NOT NULL DEFAULT '[]'::jsonb,
      visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','friends','private')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (length(body) <= 5000)
    );
    CREATE INDEX IF NOT EXISTS idx_social_posts_feed ON social_posts(created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts(author_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS social_post_comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_post_comments(post_id,created_at ASC);
    CREATE TABLE IF NOT EXISTS social_post_reactions (
      post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction TEXT NOT NULL DEFAULT 'like' CHECK (reaction IN ('like','love','laugh','wow','sad','angry')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(post_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS social_blocks (
      blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(blocker_id,blocked_id),
      CHECK (blocker_id <> blocked_id)
    );
    CREATE TABLE IF NOT EXISTS social_conversations (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      is_group BOOLEAN NOT NULL DEFAULT FALSE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS social_conversation_members (
      conversation_id BIGINT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ,
      PRIMARY KEY(conversation_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_social_members_user ON social_conversation_members(user_id,conversation_id);
    CREATE TABLE IF NOT EXISTS social_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES social_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_social_messages_conversation ON social_messages(conversation_id,id DESC);
  `);
}

function createSocialRouter({ pool, authenticateToken } = {}) {
  if (!pool || typeof pool.query !== "function") throw new Error("Social router requires a database pool.");
  if (typeof authenticateToken !== "function") throw new Error("Social router requires authentication middleware.");
  const router = express.Router();
  router.use(authenticateToken);

  const userId = req => Number(req.user?.id);
  const validId = value => /^\d+$/.test(String(value || "")) && Number(value) > 0;
  const fail = (res, status, error) => res.status(status).json({ success: false, error });

  router.get("/profile", async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT u.id, COALESCE(p.display_name,u.name) AS display_name, COALESCE(p.bio,'') AS bio,
                p.avatar_url, COALESCE(p.visibility,'public') AS visibility
         FROM users u LEFT JOIN social_profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [userId(req)]
      );
      if (!result.rows[0]) return fail(res,404,"Profile not found.");
      return res.json({ success:true, profile:result.rows[0] });
    } catch (error) { return next(error); }
  });

  router.put("/profile", async (req, res, next) => {
    try {
      const displayName = String(req.body?.displayName || "").trim().slice(0,80);
      const bio = String(req.body?.bio || "").trim().slice(0,500);
      const avatarUrl = req.body?.avatarUrl == null ? null : String(req.body.avatarUrl).trim().slice(0,2000);
      const visibility = ["public","friends","private"].includes(req.body?.visibility) ? req.body.visibility : "public";
      if (!displayName) return fail(res,400,"displayName is required.");
      if (avatarUrl && !/^https:\/\//i.test(avatarUrl)) return fail(res,400,"avatarUrl must use HTTPS.");
      const result = await pool.query(
        `INSERT INTO social_profiles(user_id,display_name,bio,avatar_url,visibility)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,bio=EXCLUDED.bio,
         avatar_url=EXCLUDED.avatar_url,visibility=EXCLUDED.visibility,updated_at=NOW()
         RETURNING user_id,display_name,bio,avatar_url,visibility`,
        [userId(req),displayName,bio,avatarUrl,visibility]
      );
      return res.json({ success:true, profile:result.rows[0] });
    } catch (error) { return next(error); }
  });

  router.get("/feed", async (req, res, next) => {
    try {
      const limit = Math.min(50,Math.max(1,Number.parseInt(req.query.limit,10)||20));
      const beforeId = validId(req.query.beforeId) ? Number(req.query.beforeId) : null;
      const result = await pool.query(
        `SELECT p.id,p.author_id,p.body,p.media,p.visibility,p.created_at,p.updated_at,
                COALESCE(sp.display_name,u.name) AS author_name,
                (p.author_id=$1) AS is_mine,
                (SELECT COUNT(*)::int FROM social_post_comments c WHERE c.post_id=p.id) AS comment_count,
                (SELECT COUNT(*)::int FROM social_post_reactions r WHERE r.post_id=p.id) AS reaction_count,
                COALESCE((SELECT json_agg(json_build_object('id',c.id,'author_name',COALESCE(csp.display_name,cu.name),'body',c.body,'created_at',c.created_at) ORDER BY c.created_at ASC) FROM social_post_comments c JOIN users cu ON cu.id=c.author_id LEFT JOIN social_profiles csp ON csp.user_id=cu.id WHERE c.post_id=p.id),'[]'::json) AS comments,
                EXISTS(SELECT 1 FROM social_post_reactions r WHERE r.post_id=p.id AND r.user_id=$1) AS reacted_by_me
         FROM social_posts p JOIN users u ON u.id=p.author_id
         LEFT JOIN social_profiles sp ON sp.user_id=u.id
         WHERE (p.visibility='public' OR p.author_id=$1 OR (p.visibility='friends' AND EXISTS(SELECT 1 FROM social_follows f WHERE f.follower_id=$1 AND f.followed_id=p.author_id)))
           AND ($2::bigint IS NULL OR p.id<$2)
           AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE
             (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))
         ORDER BY p.id DESC LIMIT $3`,
        [userId(req),beforeId,limit]
      );
      return res.json({success:true,posts:result.rows,nextBeforeId:result.rows.length===limit?result.rows[result.rows.length-1].id:null});
    } catch (error) { return next(error); }
  });

  router.post("/posts", async (req, res, next) => {
    try {
      const body = String(req.body?.body || "").trim();
      const media = Array.isArray(req.body?.media) ? req.body.media.slice(0,10) : [];
      const visibility = ["public","friends","private"].includes(req.body?.visibility) ? req.body.visibility : "public";
      if (!body && media.length===0) return fail(res,400,"A post needs text or media.");
      if (body.length>5000) return fail(res,400,"Post text cannot exceed 5000 characters.");
      if (media.some(item => !item || typeof item!=="object" || typeof item.url!=="string" || !/^https:\/\//i.test(item.url) || item.url.length>2000)) {
        return fail(res,400,"Each media item must have a valid HTTPS URL.");
      }
      const result = await pool.query(
        "INSERT INTO social_posts(author_id,body,media,visibility) VALUES($1,$2,$3::jsonb,$4) RETURNING id,author_id,body,media,visibility,created_at,updated_at",
        [userId(req),body,JSON.stringify(media),visibility]
      );
      return res.status(201).json({success:true,post:result.rows[0]});
    } catch (error) { return next(error); }
  });

  router.delete("/posts/:postId", async (req, res, next) => {
    if (!validId(req.params.postId)) return fail(res,400,"Invalid post ID.");
    try {
      const result = await pool.query("DELETE FROM social_posts WHERE id=$1 AND author_id=$2 RETURNING id",[req.params.postId,userId(req)]);
      if (!result.rows.length) return fail(res,404,"Post not found.");
      return res.json({success:true,deletedId:result.rows[0].id});
    } catch (error) { return next(error); }
  });

  router.post("/posts/:postId/comments", async (req, res, next) => {
    if (!validId(req.params.postId)) return fail(res,400,"Invalid post ID.");
    const body = String(req.body?.body || "").trim();
    if (!body || body.length>2000) return fail(res,400,"Comment must contain 1–2000 characters.");
    try {
      const visible = await pool.query(
        `SELECT p.id FROM social_posts p WHERE p.id=$1 AND
         (p.visibility='public' OR p.author_id=$2 OR (p.visibility='friends' AND EXISTS(SELECT 1 FROM social_follows f WHERE f.follower_id=$2 AND f.followed_id=p.author_id))) AND NOT EXISTS(
           SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$2))`,
        [req.params.postId,userId(req)]
      );
      if (!visible.rows.length) return fail(res,404,"Post not found.");
      const result = await pool.query("INSERT INTO social_post_comments(post_id,author_id,body) VALUES($1,$2,$3) RETURNING id,post_id,author_id,body,created_at",[req.params.postId,userId(req),body]);
      return res.status(201).json({success:true,comment:result.rows[0]});
    } catch (error) { return next(error); }
  });

  router.put("/posts/:postId/reaction", async (req, res, next) => {
    if (!validId(req.params.postId)) return fail(res,400,"Invalid post ID.");
    const reaction = String(req.body?.reaction || "like");
    if (!["like","love","laugh","wow","sad","angry","none"].includes(reaction)) return fail(res,400,"Unsupported reaction.");
    try {
      const visible = await pool.query("SELECT id FROM social_posts p WHERE id=$1 AND (visibility='public' OR author_id=$2 OR (visibility='friends' AND EXISTS(SELECT 1 FROM social_follows f WHERE f.follower_id=$2 AND f.followed_id=p.author_id))) AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$2))",[req.params.postId,userId(req)]);
      if (!visible.rows.length) return fail(res,404,"Post not found.");
      if (reaction==="none") await pool.query("DELETE FROM social_post_reactions WHERE post_id=$1 AND user_id=$2",[req.params.postId,userId(req)]);
      else await pool.query("INSERT INTO social_post_reactions(post_id,user_id,reaction) VALUES($1,$2,$3) ON CONFLICT(post_id,user_id) DO UPDATE SET reaction=EXCLUDED.reaction,created_at=NOW()",[req.params.postId,userId(req),reaction]);
      return res.json({success:true,reaction:reaction==="none"?null:reaction});
    } catch (error) { return next(error); }
  });

  router.post("/friend-requests", async (req, res, next) => {
    const recipientId = Number(req.body?.recipientId);
    if (!validId(recipientId) || recipientId===userId(req)) return fail(res,400,"A valid different recipientId is required.");
    try {
      const recipient = await pool.query("SELECT id FROM users WHERE id=$1",[recipientId]);
      if (!recipient.rows.length) return fail(res,404,"Recipient not found.");
      const blocked = await pool.query("SELECT 1 FROM social_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1",[userId(req),recipientId]);
      if (blocked.rows.length) return fail(res,403,"Friend request is unavailable.");
      const existing = await pool.query("SELECT id,status FROM social_friend_requests WHERE sender_id=$1 AND recipient_id=$2",[userId(req),recipientId]);
      if (existing.rows.length && existing.rows[0].status==="pending") return fail(res,409,"Friend request already pending.");
      const result = await pool.query(
        `INSERT INTO social_friend_requests(sender_id,recipient_id,status) VALUES($1,$2,'pending')
         ON CONFLICT(sender_id,recipient_id) DO UPDATE SET status='pending',updated_at=NOW()
         RETURNING id,sender_id,recipient_id,status,created_at`,
        [userId(req),recipientId]
      );
      return res.status(201).json({success:true,request:result.rows[0]});
    } catch (error) { return next(error); }
  });

  router.get("/friend-requests", async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT r.id,r.sender_id,r.recipient_id,r.status,r.created_at,u.name AS sender_name
         FROM social_friend_requests r JOIN users u ON u.id=r.sender_id
         WHERE r.recipient_id=$1 AND r.status='pending' ORDER BY r.created_at DESC LIMIT 100`,
        [userId(req)]
      );
      return res.json({success:true,requests:result.rows});
    } catch (error) { return next(error); }
  });

  router.post("/friend-requests/:requestId/accept", async (req, res, next) => {
    if (!validId(req.params.requestId)) return fail(res,400,"Invalid request ID.");
    try {
      const result = await pool.query(
        "UPDATE social_friend_requests SET status='accepted',updated_at=NOW() WHERE id=$1 AND recipient_id=$2 AND status='pending' RETURNING id,sender_id,recipient_id,status",
        [req.params.requestId,userId(req)]
      );
      if (!result.rows.length) return fail(res,404,"Pending request not found.");
      const request=result.rows[0];
      await pool.query("INSERT INTO social_follows(follower_id,followed_id) VALUES($1,$2),($2,$1) ON CONFLICT DO NOTHING",[request.sender_id,request.recipient_id]);
      return res.json({success:true,request});
    } catch (error) { return next(error); }
  });

  router.post("/blocks/:targetId", async (req, res, next) => {
    if (!validId(req.params.targetId) || Number(req.params.targetId)===userId(req)) return fail(res,400,"A valid different target ID is required.");
    try {
      const target=await pool.query("SELECT id FROM users WHERE id=$1",[req.params.targetId]);
      if (!target.rows.length) return fail(res,404,"User not found.");
      await pool.query("INSERT INTO social_blocks(blocker_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[userId(req),req.params.targetId]);
      await pool.query("UPDATE social_friend_requests SET status='cancelled',updated_at=NOW() WHERE status='pending' AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))",[userId(req),req.params.targetId]);
      return res.json({success:true,blockedId:Number(req.params.targetId)});
    } catch (error) { return next(error); }
  });

  router.get("/people", async (req,res,next) => {
    const query=String(req.query.q||"").trim().slice(0,80);
    if(query.length<2) return res.json({success:true,people:[]});
    try {
      const result=await pool.query(
        `SELECT u.id,COALESCE(p.display_name,u.name) AS display_name,COALESCE(p.bio,'') AS bio
         FROM users u LEFT JOIN social_profiles p ON p.user_id=u.id
         WHERE u.id<>$1 AND COALESCE(p.visibility,'public')='public'
           AND (COALESCE(p.display_name,u.name) ILIKE $2)
           AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE
             (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
         ORDER BY COALESCE(p.display_name,u.name) LIMIT 20`,
        [userId(req),"%"+query.replace(/[\\%_]/g,"\\  router.get("/conversations", async (req,res,next) => {")+"%"]
      );
      return res.json({success:true,people:result.rows});
    } catch(error){return next(error);}
  });

  router.get("/conversations", async (req,res,next) => {
    try {
      const result=await pool.query(
        `SELECT c.id,c.title,c.is_group,c.created_by,c.created_at,c.updated_at,
          (SELECT COUNT(*)::int FROM social_conversation_members m WHERE m.conversation_id=c.id) AS member_count,
          (SELECT json_build_object('id',msg.id,'body',msg.body,'sender_id',msg.sender_id,'created_at',msg.created_at)
           FROM social_messages msg WHERE msg.conversation_id=c.id ORDER BY msg.id DESC LIMIT 1) AS last_message
         FROM social_conversations c JOIN social_conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1
         ORDER BY c.updated_at DESC,c.id DESC LIMIT 100`,
        [userId(req)]
      );
      return res.json({success:true,conversations:result.rows});
    } catch(error){return next(error);}
  });

  router.post("/conversations", async (req,res,next) => {
    const ids=Array.isArray(req.body?.participantIds)?[...new Set(req.body.participantIds.map(Number))]:[];
    const title=String(req.body?.title||"").trim().slice(0,100);
    const me=userId(req);
    if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||ids.includes(me)) return fail(res,400,"participantIds must contain other valid user IDs only.");
    if(ids.length<1||ids.length>49) return fail(res,400,"Choose between 1 and 49 other participants.");
    try {
      const people=await pool.query("SELECT id FROM users WHERE id=ANY($1::int[])",[ids]);
      if(people.rows.length!==ids.length) return fail(res,404,"One or more participants were not found.");
      const blocked=await pool.query("SELECT 1 FROM social_blocks WHERE (blocker_id=$1 AND blocked_id=ANY($2::int[])) OR (blocked_id=$1 AND blocker_id=ANY($2::int[])) LIMIT 1",[me,ids]);
      if(blocked.rows.length) return fail(res,403,"A conversation cannot be created with a blocked user.");
      const client=typeof pool.connect==="function"?await pool.connect():null;
      const db=client||pool;
      try {
        if(client) await db.query("BEGIN");
        const created=await db.query("INSERT INTO social_conversations(title,is_group,created_by) VALUES($1,$2,$3) RETURNING id,title,is_group,created_by,created_at,updated_at",[title,ids.length>1,me]);
        const conversation=created.rows[0];
        const members=[me,...ids];
        await db.query("INSERT INTO social_conversation_members(conversation_id,user_id) SELECT $1,unnest($2::int[]) ON CONFLICT DO NOTHING",[conversation.id,members]);
        if(client) await db.query("COMMIT");
        return res.status(201).json({success:true,conversation:{...conversation,member_count:members.length}});
      } catch(error){if(client) await db.query("ROLLBACK");throw error;}
      finally {if(client) client.release();}
    } catch(error){return next(error);}
  });

  router.get("/conversations/:conversationId/messages", async (req,res,next) => {
    if(!validId(req.params.conversationId)) return fail(res,400,"Invalid conversation ID.");
    const limit=Math.min(100,Math.max(1,Number.parseInt(req.query.limit,10)||50));
    try {
      const member=await pool.query("SELECT 1 FROM social_conversation_members WHERE conversation_id=$1 AND user_id=$2",[req.params.conversationId,userId(req)]);
      if(!member.rows.length) return fail(res,404,"Conversation not found.");
      const beforeId=validId(req.query.beforeId)?Number(req.query.beforeId):null;
      const result=await pool.query(
        `SELECT id,conversation_id,sender_id,body,created_at FROM (
           SELECT id,conversation_id,sender_id,body,created_at FROM social_messages
           WHERE conversation_id=$1 AND ($2::bigint IS NULL OR id<$2)
           ORDER BY id DESC LIMIT $3
         ) recent ORDER BY id ASC`,
        [req.params.conversationId,beforeId,limit]
      );
      await pool.query("UPDATE social_conversation_members SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2",[req.params.conversationId,userId(req)]);
      return res.json({success:true,messages:result.rows});
    } catch(error){return next(error);}
  });

  router.post("/conversations/:conversationId/messages", async (req,res,next) => {
    if(!validId(req.params.conversationId)) return fail(res,400,"Invalid conversation ID.");
    const body=String(req.body?.body||"").trim();
    if(!body||body.length>5000) return fail(res,400,"Message must contain 1–5000 characters.");
    try {
      const member=await pool.query("SELECT 1 FROM social_conversation_members WHERE conversation_id=$1 AND user_id=$2",[req.params.conversationId,userId(req)]);
      if(!member.rows.length) return fail(res,404,"Conversation not found.");
      const blocked=await pool.query(
        `SELECT 1 FROM social_blocks b JOIN social_conversation_members other
         ON ((b.blocker_id=$2 AND b.blocked_id=other.user_id) OR (b.blocked_id=$2 AND b.blocker_id=other.user_id))
         WHERE other.conversation_id=$1 AND other.user_id<>$2 LIMIT 1`,
        [req.params.conversationId,userId(req)]
      );
      if(blocked.rows.length) return fail(res,403,"Messaging is unavailable because a participant is blocked.");
      const client=typeof pool.connect==="function"?await pool.connect():null;
      const db=client||pool;
      try {
        if(client) await db.query("BEGIN");
        const inserted=await db.query("INSERT INTO social_messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,conversation_id,sender_id,body,created_at",[req.params.conversationId,userId(req),body]);
        await db.query("UPDATE social_conversations SET updated_at=NOW() WHERE id=$1",[req.params.conversationId]);
        await db.query("UPDATE social_conversation_members SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2",[req.params.conversationId,userId(req)]);
        if(client) await db.query("COMMIT");
        return res.status(201).json({success:true,message:inserted.rows[0]});
      } catch(error){if(client) await db.query("ROLLBACK");throw error;}
      finally {if(client) client.release();}
    } catch(error){return next(error);}
  });

  return router;
}

module.exports = { createSocialRouter, ensureSocialSchema };
