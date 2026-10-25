"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CURRENCIES, toProviderAmount, fromProviderAmount, ensureCommerceSchema } = require("./commerce-routes");

test("commerce money conversion preserves integer and minor-unit currencies", () => {
  assert.equal(toProviderAmount(2500, "RWF"), 2500);
  assert.equal(fromProviderAmount(2500, "RWF"), 2500);
  assert.equal(toProviderAmount(2599, "USD"), 25.99);
  assert.equal(fromProviderAmount(25.99, "USD"), 2599);
});

test("commerce currencies are an explicit allowlist", () => {
  assert.equal(CURRENCIES.has("RWF"), true);
  assert.equal(CURRENCIES.has("USD"), true);
  assert.equal(CURRENCIES.has("BTC"), false);
});

test("commerce schema initializer creates indexed products and user-owned orders", async () => {
  const calls = [];
  await ensureCommerceSchema({
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    }
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_products/);
  assert.match(calls[0], /ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General'/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_wishlist_items/);
  assert.match(calls[0], /PRIMARY KEY \(user_id, product_id\)/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_product_reviews/);
  assert.match(calls[0], /UNIQUE \(user_id, product_id\)/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_orders/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_order_items/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_cart_items/);
  assert.match(calls[0], /PRIMARY KEY \(user_id, product_id\)/);
  assert.match(calls[0], /REFERENCES users\(id\)/);
  assert.match(calls[0], /idx_commerce_orders_user_created/);
});

const express = require("express");
const { createCommerceRouter } = require("./commerce-routes");

async function withServer(app, callback) {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const address = server.address();
    await callback("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("public product endpoint returns active product data from the database", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query(sql) {
      assert.match(sql, /FROM commerce_products p/);
      return { rows: [{ id: "4", name: "Notebook", price_minor: "2500", currency: "RWF", stock_quantity: 8, category: "Stationery", rating_average: "4.5", review_count: 2 }] };
    } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "buyer@example.com" }; next(); },
    env: {}
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/products");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.products[0].name, "Notebook");
  });
});

test("checkout fails closed when payment secrets are not configured", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query() { throw new Error("database must not be called before provider configuration"); } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "buyer@example.com" }; next(); },
    env: {}
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }] })
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.code, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  });
});

test("product creation fails closed when no commerce admin is configured", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query() { throw new Error("product write must not be reached"); } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "buyer@example.com" }; next(); },
    env: {}
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test product", priceMinor: 100, currency: "RWF", stockQuantity: 2 })
    });
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.code, "COMMERCE_ADMIN_REQUIRED");
  });
});

test("configured commerce admin can create a validated product", async () => {
  const app = express();
  app.use(express.json());
  let insertParams;
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query(sql, params) {
      assert.match(sql, /INSERT INTO commerce_products/);
      insertParams = params;
      return { rows: [{ id: "9", name: params[0], price_minor: String(params[3]), currency: params[4], stock_quantity: params[5] }] };
    } },
    authenticateToken: (req, res, next) => { req.user = { id: 7, email: "admin@example.com" }; next(); },
    env: { COMMERCE_ADMIN_USER_IDS: "7" }
  }));
  await withServer(app, async base => {
    const response = await fetch(base + "/api/commerce/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Notebook", priceMinor: 2500, currency: "RWF", stockQuantity: 8 })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.product.name, "Notebook");
    assert.equal(insertParams[3], 2500);
    assert.equal(insertParams[4], "RWF");
  });
});


test("product catalogue supports parameterized search, category filters and allowlisted sorting", async () => {
  const app = express(); app.use(express.json());
  let params;
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query(sql, values) {
      if (sql.includes("SELECT DISTINCT category")) return { rows: [{ category: "Books" }, { category: "Stationery" }] };
      assert.match(sql, /p\.name ILIKE/);
      assert.match(sql, /p\.category=\$2/);
      assert.match(sql, /ORDER BY rating_average DESC/);
      params = values;
      return { rows: [{ id: "4", name: "Notebook", category: "Stationery", rating_average: "4.5", review_count: 2 }] };
    } },
    authenticateToken: (req,res,next)=>{req.user={id:7,email:"buyer@example.com"};next();}, env:{}
  }));
  await withServer(app, async base => {
    const response=await fetch(base+"/api/commerce/products?q=note&category=Stationery&sort=rating");
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(params[0],"note"); assert.equal(params[1],"Stationery"); assert.equal(params[2],50);
    assert.equal(payload.products[0].rating_average,"4.5");
    assert.deepEqual(payload.categories,["Books","Stationery"]);
  });
});

test("wishlist reads and writes are scoped to the authenticated account ID", async () => {
  const app=express();app.use(express.json());const calls=[];
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){calls.push({sql,params});if(sql.includes("FROM commerce_wishlist_items"))return{rows:[{id:"3",name:"Saved book"}]};return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:42,email:"private@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const read=await fetch(base+"/api/commerce/wishlist");
    assert.equal(read.status,200);assert.equal((await read.json()).products[0].name,"Saved book");
    const save=await fetch(base+"/api/commerce/wishlist/3",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({saved:true})});
    assert.equal(save.status,200);
    assert.ok(calls.some(call=>call.sql.includes("WHERE w.user_id=$1")&&call.params[0]===42));
    assert.ok(calls.some(call=>call.sql.includes("INSERT INTO commerce_wishlist_items")&&call.params[0]===42));
  });
});

test("review submission requires a confirmed paid purchase for the same account", async () => {
  const app=express();app.use(express.json());let wrote=false;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql){if(sql.includes("SELECT 1 FROM commerce_orders"))return{rows:[]};wrote=true;return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:19,email:"buyer@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/products/5/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating:5,reviewText:"Great"})});
    assert.equal(response.status,403);assert.equal((await response.json()).code,"REVIEW_PURCHASE_REQUIRED");assert.equal(wrote,false);
  });
});

test("hosted checkout uses the authenticated account email, never a browser-supplied email", async () => {
  const app=express();app.use(express.json());let providerPayload;
  const client={
    async query(sql){
      if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};
      if(sql.includes("FROM commerce_products"))return{rows:[{id:"5",name:"Book",price_minor:"1200",currency:"RWF",stock_quantity:3}]};
      if(sql.includes("INSERT INTO commerce_orders"))return{rows:[{id:"71"}]};
      return{rows:[]};
    },release(){}
  };
  app.use("/api/commerce",createCommerceRouter({
    pool:{async connect(){return client;},async query(){return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:8,email:"account@example.com"};next();},
    fetchImpl:async(_url,options)=>{providerPayload=JSON.parse(options.body);return{ok:true,json:async()=>({status:"success",data:{link:"https://checkout.example.test/pay"}})};},
    env:{FLW_SECRET_KEY:"test-secret",FLW_SECRET_HASH:"test-hash",FLW_REDIRECT_URL:"https://market.example.test/return"}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"attacker@example.com",items:[{productId:5,quantity:1}]})});
    assert.equal(response.status,201);assert.equal(providerPayload.customer.email,"account@example.com");assert.equal(providerPayload.meta.user_id,"8");
  });
});
