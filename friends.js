"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const content = $("#content");
  const title = $("#pageTitle");
  const intro = $("#pageIntro");
  const form = $("#postForm");
  const postText = $("#postText");
  const mediaInput = $("#postMedia");
  const toast = $("#toast");
  const STORAGE_KEY = "irhcf_friends_local_posts_v1";
  const copy = {
    feed:["Your people. Your stories.","Share updates, discover creators and keep up with the people and communities you care about."],
    messages:["Conversations that matter","Private one-to-one and group chats belong here. Secure, account-backed messaging is not enabled in this first UI foundation."],
    watch:["Watch & discover","A home for longer videos, creator channels, subscriptions, playlists and viewing history."],
    shorts:["Short videos","Explore a vertical, swipe-friendly short-video experience for creator clips."],
    stories:["Stories","A place for temporary photo and video updates from friends."],
    communities:["Find your community","Groups, topics, events and shared interests will live here."],
    jobs:["Work & professional connections","Professional profiles, company pages, jobs, skills and career conversations."],
    profile:["Your profile","Build a profile, share your interests and manage your public presence."]
  };
  const icon = {feed:"⌂",messages:"☏",watch:"▶",shorts:"▣",stories:"◉",communities:"♧",jobs:"▤",profile:"☺"};
  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  function readPosts() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(p => p && typeof p.text === "string").slice(0,50) : [];
    } catch (_) { return []; }
  }
  function renderPosts() {
    content.replaceChildren();
    const posts = readPosts();
    if (!posts.length) {
      const empty = document.createElement("article");
      empty.className = "card empty-state";
      const big = document.createElement("div"); big.className = "big"; big.textContent = "✳";
      const h = document.createElement("h3"); h.textContent = "Your feed starts here";
      const p = document.createElement("p"); p.textContent = "Create a local preview post above. Posts are stored only in this browser; they are not yet shared with other users.";
      const n = document.createElement("p"); n.className = "notice"; n.style.marginTop = "16px"; n.textContent = "Early foundation: user accounts, server-side posts, friend requests, realtime messaging, uploads, moderation and notifications still need production APIs and end-to-end tests.";
      empty.append(big,h,p,n); content.append(empty); return;
    }
    posts.forEach((post, index) => {
      const card = document.createElement("article"); card.className = "card post-card";
      const head = document.createElement("div"); head.className = "composer-top";
      const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = "Y";
      const info = document.createElement("div");
      const name = document.createElement("h3"); name.textContent = "You · Local preview";
      const meta = document.createElement("div"); meta.className = "post-meta"; meta.textContent = new Date(post.createdAt || Date.now()).toLocaleString();
      info.append(name,meta); head.append(avatar,info); card.append(head);
      const text = document.createElement("p"); text.className = "post-text"; text.textContent = post.text; card.append(text);
      if (post.mediaData && /^data:image\//.test(post.mediaData)) { const img = document.createElement("img"); img.className = "post-media"; img.src = post.mediaData; img.alt = "Photo attached to local preview post"; card.append(img); }
      else if (post.mediaName) { const note = document.createElement("p"); note.className = "muted"; note.textContent = "Attachment selected: " + post.mediaName + " (not uploaded or shared)."; card.append(note); }
      const actions = document.createElement("div"); actions.className = "post-actions";
      const like = document.createElement("button"); like.type = "button"; like.textContent = "♡ Like"; like.addEventListener("click", () => notify("Likes need the account-backed social API."));
      const comment = document.createElement("button"); comment.type = "button"; comment.textContent = "▢ Comment"; comment.addEventListener("click", () => notify("Comments need the account-backed social API."));
      const share = document.createElement("button"); share.type = "button"; share.textContent = "↗ Share"; share.addEventListener("click", () => notify("Sharing is not connected yet."));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete local"; remove.addEventListener("click", () => { const next = readPosts(); next.splice(index,1); localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); renderPosts(); notify("Removed from this device."); });
      actions.append(like,comment,share,remove); card.append(actions); content.append(card);
    });
  }
  function showView(view) {
    const selected = copy[view] ? view : "feed";
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === selected;
      button.classList.toggle("active", active);
      if (button.classList.contains("nav-item")) button.setAttribute("aria-current", active ? "page" : "false");
    });
    title.textContent = copy[selected][0]; intro.textContent = copy[selected][1];
    form.hidden = true;
    $("#composer").hidden = selected !== "feed";
    if (selected === "feed") { renderPosts(); return; }
    content.replaceChildren();
    const card = document.createElement("article"); card.className = "card empty-state";
    const big = document.createElement("div"); big.className = "big"; big.textContent = icon[selected];
    const h = document.createElement("h3"); h.textContent = copy[selected][0];
    const p = document.createElement("p"); p.textContent = copy[selected][1];
    const n = document.createElement("p"); n.className = "notice"; n.style.marginTop = "16px";
    n.textContent = selected === "messages" ? "Not a live messenger yet. Do not use this page for urgent or confidential messages." : "This section is a navigation and design foundation, not a completed or connected production feature.";
    card.append(big,h,p,n); content.append(card);
  }
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
  $("#openComposer").addEventListener("click", () => { form.hidden = !form.hidden; if (!form.hidden) postText.focus(); });
  document.querySelectorAll("[data-compose]").forEach(button => button.addEventListener("click", () => {
    form.hidden = false; postText.focus();
    if (button.dataset.compose === "photo" || button.dataset.compose === "video") mediaInput.click();
    if (button.dataset.compose === "story") notify("Story publishing will be enabled after media upload, expiry and privacy APIs are implemented.");
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = postText.value.trim();
    const file = mediaInput.files && mediaInput.files[0];
    if (!text && !file) { notify("Write a post or choose an attachment first."); return; }
    let mediaData = null;
    if (file && file.type.startsWith("image/") && file.size <= 700000) {
      mediaData = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(null); reader.readAsDataURL(file); });
    }
    const posts = readPosts();
    posts.unshift({text, mediaName:file ? file.name.slice(0,160) : "", mediaData, createdAt:new Date().toISOString()});
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.slice(0,30)));
    } catch (_) { notify("Device storage is full. Remove a local post or use a smaller image."); return; }
    postText.value = ""; mediaInput.value = ""; form.hidden = true; renderPosts();
    notify("Saved on this device only. Not yet published to other people.");
  });
  $("#installHint").addEventListener("click", () => notify("Notifications will be available after account and push-notification services are connected."));
  showView(location.hash === "#profile" ? "profile" : "feed");
})();