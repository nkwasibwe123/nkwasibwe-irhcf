"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CURRENCIES, toProviderAmount, fromProviderAmount, ensureCommerceSchema, calculateCouponDiscount, getShippingRateMinor, getTaxRateBps, calculateTaxMinor, releaseOrderReservations, releaseExpiredReservations } = require("./commerce-routes");

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
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_sellers/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_coupons/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_refund_requests/);
  assert.match(calls[0], /coupon_code TEXT/);
  assert.match(calls[0], /discount_minor BIGINT/);
  assert.match(calls[0], /shipping_minor BIGINT/);
  assert.match(calls[0], /tax_minor BIGINT/);
  assert.match(calls[0], /tax_rate_bps INTEGER/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_stock_reservations/);
  assert.match(calls[0], /expires_at TIMESTAMPTZ/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_addresses/);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS commerce_order_items/);
  assert.match(calls[0], /fulfillment_status TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(calls[0], /shipping_address JSONB/);
  assert.match(calls[0], /requires_shipping BOOLEAN NOT NULL DEFAULT TRUE/);
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
      if (sql.includes("SELECT DISTINCT category")) return { rows: [{ category: "Stationery" }] };
      assert.match(sql, /FROM commerce_products p/);
      return { rows: [{ id: "4", name: "Notebook", price_minor: "2500", currency: "RWF", stock_quantity: 8, category: "Stationery", requires_shipping: false, rating_average: "4.5", review_count: 2 }] };
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

test("product creation fails closed when neither admin nor approved seller is configured", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/commerce", createCommerceRouter({
    pool: { async query(sql) { if (sql.includes("SELECT status FROM commerce_sellers")) return { rows: [] }; throw new Error("product write must not be reached"); } },
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
    assert.equal(payload.code, "APPROVED_SELLER_REQUIRED");
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
    pool:{async query(sql,params){calls.push({sql,params});if(sql.includes("SELECT id FROM commerce_products"))return{rows:[{id:"3",requires_shipping:true}]};if(sql.includes("FROM commerce_wishlist_items"))return{rows:[{id:"3",name:"Saved book"}]};return{rows:[]};}},
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
      if(sql.includes("FROM commerce_products"))return{rows:[{id:"5",name:"Book",price_minor:"1200",currency:"RWF",stock_quantity:3,requires_shipping:false}]};
      if(sql.includes("UPDATE commerce_products SET stock_quantity=stock_quantity-"))return{rows:[{id:"5"}]};
      if(sql.includes("INSERT INTO commerce_orders"))return{rows:[{id:"71",expires_at:new Date(Date.now()+30*60*1000).toISOString()}]};
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


test("shipping addresses are stored and listed only for the authenticated account", async () => {
  const app=express();app.use(express.json());const calls=[];
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){calls.push({sql,params});if(sql.includes("INSERT INTO commerce_addresses"))return{rows:[{id:"11",label:params[1],recipient_name:params[2],city:params[6],country:params[4],is_default:params[10]}]};if(sql.includes("FROM commerce_addresses WHERE user_id=$1"))return{rows:[{id:"11",label:"Home",city:"Kigali",country:"Rwanda"}]};return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:77,email:"account@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const create=await fetch(base+"/api/commerce/addresses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label:"Home",recipientName:"Buyer",phone:"+250780000000",country:"Rwanda",city:"Kigali",addressLine1:"Kicukiro",isDefault:true})});
    assert.equal(create.status,201);assert.equal(calls[0].params[0],77);
    const list=await fetch(base+"/api/commerce/addresses");assert.equal(list.status,200);
    assert.ok(calls.some(call=>call.sql.includes("WHERE user_id=$1")&&call.params[0]===77));
  });
});

test("checkout rejects a shipping address that does not belong to the signed-in account", async () => {
  const app=express();app.use(express.json());let providerCalled=false;
  const client={async query(sql){if(sql==="BEGIN"||sql==="ROLLBACK")return{rows:[]};if(sql.includes("FROM commerce_products"))return{rows:[{id:"5",name:"Physical item",price_minor:"1200",currency:"RWF",stock_quantity:3,requires_shipping:true}]};if(sql.includes("FROM commerce_addresses"))return{rows:[]};return{rows:[]};},release(){}};
  app.use("/api/commerce",createCommerceRouter({
    pool:{async connect(){return client;},async query(){return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:8,email:"account@example.com"};next();},
    fetchImpl:async()=>{providerCalled=true;throw new Error("provider should not be called");},
    env:{FLW_SECRET_KEY:"test-secret",FLW_SECRET_HASH:"test-hash",FLW_REDIRECT_URL:"https://market.example.test/return"}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({addressId:999,items:[{productId:5,quantity:1}]})});
    assert.equal(response.status,400);assert.equal((await response.json()).code,"SHIPPING_ADDRESS_NOT_FOUND");assert.equal(providerCalled,false);
  });
});

test("order details are not disclosed to a different account", async () => {
  const app=express();app.use(express.json());let params;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,values){params=values;return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:55,email:"account@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/orders/12");
    assert.equal(response.status,404);assert.equal((await response.json()).code,"ORDER_NOT_FOUND");assert.deepEqual(params,[12,55]);
  });
});


test("seller applications are created for the authenticated account and start pending", async () => {
  const app=express();app.use(express.json());let params;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,values){params=values;assert.match(sql,/INSERT INTO commerce_sellers/);return{rows:[{user_id:values[0],shop_name:values[1],status:"pending"}]};}},
    authenticateToken:(req,res,next)=>{req.user={id:81,email:"seller@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/seller/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shopName:"Kigali Books",description:"Books",contactPhone:"+250780000000"})});
    assert.equal(response.status,201);const payload=await response.json();assert.equal(payload.seller.status,"pending");assert.equal(params[0],81);assert.equal(params[3],"seller@example.com");
  });
});

test("approved seller creates products owned by that seller account", async () => {
  const app=express();app.use(express.json());let insertParams,insertSql;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){if(sql.includes("SELECT status FROM commerce_sellers"))return{rows:[{status:"approved"}]};insertSql=sql;insertParams=params;return{rows:[{id:"12",name:params[0],seller_user_id:params[9],price_minor:params[3]}]};}},
    authenticateToken:(req,res,next)=>{req.user={id:33,email:"seller@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Seller book",priceMinor:5000,currency:"RWF",stockQuantity:5,requiresShipping:false})});
    assert.equal(response.status,201);assert.match(insertSql,/seller_user_id/);assert.equal(insertParams[9],33);assert.equal((await response.json()).product.seller_user_id,33);
  });
});

test("seller cannot update another seller's product", async () => {
  const app=express();app.use(express.json());let updateSql,updateParams;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){if(sql.includes("SELECT status FROM commerce_sellers"))return{rows:[{status:"approved"}]};updateSql=sql;updateParams=params;return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:33,email:"seller@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/products/88",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Hijack attempt"})});
    assert.equal(response.status,404);assert.match(updateSql,/seller_user_id=\$\d+/);assert.equal(updateParams[updateParams.length-1],33);
  });
});

test("seller fulfillment follows allowed transitions and requires a paid owned order", async () => {
  const app=express();app.use(express.json());let updated=false;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql){if(sql.includes("SELECT status FROM commerce_sellers"))return{rows:[{status:"approved"}]};if(sql.includes("SELECT oi.fulfillment_status"))return{rows:[{fulfillment_status:"pending",payment_status:"paid"}]};updated=true;return{rows:[{id:"9",fulfillment_status:"delivered"}]};}},
    authenticateToken:(req,res,next)=>{req.user={id:33,email:"seller@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/seller/order-items/9/fulfillment",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"delivered"})});
    assert.equal(response.status,409);assert.equal((await response.json()).code,"FULFILLMENT_TRANSITION_INVALID");assert.equal(updated,false);
  });
});


test("coupon discount calculation validates currency, minimum spend and positive order total", () => {
  assert.deepEqual(calculateCouponDiscount({discount_type:"percent",discount_value:20,currency:"RWF",min_subtotal_minor:5000},10000,"RWF"),{discountMinor:2000,error:null});
  assert.deepEqual(calculateCouponDiscount({discount_type:"fixed",discount_value:500,currency:"RWF",min_subtotal_minor:0},1000,"RWF"),{discountMinor:500,error:null});
  assert.match(calculateCouponDiscount({discount_type:"percent",discount_value:10,currency:"USD",min_subtotal_minor:0},10000,"RWF").error,/currency/);
  assert.match(calculateCouponDiscount({discount_type:"percent",discount_value:10,currency:"RWF",min_subtotal_minor:5000},4000,"RWF").error,/minimum subtotal/);
  assert.match(calculateCouponDiscount({discount_type:"fixed",discount_value:1000,currency:"RWF",min_subtotal_minor:0},1000,"RWF").error,/positive order total/);
});

test("cart quote computes prices and coupon discount from server-owned product rows", async () => {
  const app=express();app.use(express.json());
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql){if(sql.includes("FROM commerce_products p"))return{rows:[{id:"4",price_minor:"10000",currency:"RWF",stock_quantity:3,requires_shipping:false}]};if(sql.includes("FROM commerce_coupons"))return{rows:[{code:"SAVE20",discount_type:"percent",discount_value:20,currency:"RWF",min_subtotal_minor:"5000"}]};return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:14,email:"buyer@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{productId:4,quantity:1}],couponCode:"save20"})});
    assert.equal(response.status,200);const quote=await response.json();assert.equal(quote.subtotalMinor,10000);assert.equal(quote.discountMinor,2000);assert.equal(quote.totalMinor,8000);assert.equal(quote.couponCode,"SAVE20");
  });
});

test("coupon creation is restricted to configured administrators", async () => {
  const app=express();app.use(express.json());
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){assert.match(sql,/INSERT INTO commerce_coupons/);return{rows:[{id:"5",code:params[0],discount_type:params[2],discount_value:params[3],currency:params[4]}]};}},
    authenticateToken:(req,res,next)=>{req.user={id:7,email:"admin@example.com"};next();},env:{COMMERCE_ADMIN_USER_IDS:"7"}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:"save20",discountType:"percent",discountValue:20,currency:"RWF",minSubtotalMinor:0})});
    assert.equal(response.status,201);assert.equal((await response.json()).coupon.code,"SAVE20");
  });
});

test("refund requests are bound to the authenticated account's paid order", async () => {
  const app=express();app.use(express.json());let insertParams;
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql,params){if(sql.includes("FROM commerce_orders WHERE id=$1 AND user_id=$2"))return{rows:[{id:10,status:"paid"}]};if(sql.includes("INSERT INTO commerce_refund_requests")){insertParams=params;return{rows:[{id:"4",order_id:params[0],user_id:params[1],status:"pending"}]};}return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:44,email:"buyer@example.com"};next();},env:{}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/orders/10/refund-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:"The item arrived damaged."})});
    assert.equal(response.status,201);assert.equal(insertParams[0],10);assert.equal(insertParams[1],44);assert.equal((await response.json()).refundRequest.status,"pending");
  });
});


test("shipping and tax helpers fail closed for missing rates and use integer arithmetic", () => {
  assert.equal(getShippingRateMinor("Rwanda","RWF",{COMMERCE_SHIPPING_RATES_JSON:'{"Rwanda":{"RWF":1500}}'}),1500);
  assert.equal(getShippingRateMinor("Rwanda","USD",{COMMERCE_SHIPPING_RATES_JSON:'{"Rwanda":{"RWF":1500}}'}),null);
  assert.equal(getShippingRateMinor("Rwanda","RWF",{COMMERCE_SHIPPING_RATES_JSON:"not-json"}),null);
  assert.equal(getTaxRateBps({COMMERCE_TAX_BPS:"1000"}),1000);
  assert.equal(getTaxRateBps({COMMERCE_TAX_BPS:"9000"}),null);
  assert.equal(calculateTaxMinor(10000,2000,1000,1000),900);
  assert.ok(Number.isSafeInteger(calculateTaxMinor(Number.MAX_SAFE_INTEGER,0,0,3000)));
});

test("physical-product quote includes account-owned shipping, coupon discount and configured tax", async () => {
  const app=express();app.use(express.json());
  app.use("/api/commerce",createCommerceRouter({
    pool:{async query(sql){if(sql.includes("FROM commerce_products p"))return{rows:[{id:"4",price_minor:"10000",currency:"RWF",stock_quantity:3,requires_shipping:true}]};if(sql.includes("FROM commerce_addresses"))return{rows:[{country:"Rwanda"}]};if(sql.includes("FROM commerce_coupons"))return{rows:[{code:"SAVE20",discount_type:"percent",discount_value:20,currency:"RWF",min_subtotal_minor:"5000"}]};return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:14,email:"buyer@example.com"};next();},env:{COMMERCE_SHIPPING_RATES_JSON:'{"Rwanda":{"RWF":1000}}',COMMERCE_TAX_BPS:"1000"}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{productId:4,quantity:1}],addressId:21,couponCode:"save20"})});
    assert.equal(response.status,200);const quote=await response.json();assert.equal(quote.subtotalMinor,10000);assert.equal(quote.discountMinor,2000);assert.equal(quote.shippingMinor,1000);assert.equal(quote.taxMinor,900);assert.equal(quote.totalMinor,9900);assert.equal(quote.shippingCountry,"Rwanda");
  });
});

test("checkout charges the exact quoted coupon, shipping and tax total", async () => {
  const app=express();app.use(express.json());let orderParams,providerPayload;
  const client={async query(sql,params){
    if(sql==="BEGIN"||sql==="COMMIT"||sql==="ROLLBACK")return{rows:[]};
    if(sql.includes("FROM commerce_products p"))return{rows:[{id:"4",name:"Physical item",price_minor:"10000",currency:"RWF",stock_quantity:3,requires_shipping:true,seller_user_id:null}]};
    if(sql.includes("FROM commerce_addresses"))return{rows:[{country:"Rwanda",recipient_name:"Buyer",phone:"+250780000000",address_line1:"Kigali"}]};
    if(sql.includes("FROM commerce_coupons"))return{rows:[{id:"2",code:"SAVE20",discount_type:"percent",discount_value:20,currency:"RWF",min_subtotal_minor:"5000"}]};
    if(sql.includes("UPDATE commerce_products SET stock_quantity=stock_quantity-"))return{rows:[{id:"4"}]};
    if(sql.includes("INSERT INTO commerce_orders")){orderParams=params;return{rows:[{id:"71",expires_at:new Date(Date.now()+30*60*1000).toISOString()}]};}
    return{rows:[]};
  },release(){}};
  app.use("/api/commerce",createCommerceRouter({
    pool:{async connect(){return client;},async query(){return{rows:[]};}},
    authenticateToken:(req,res,next)=>{req.user={id:8,email:"account@example.com"};next();},
    fetchImpl:async(_url,options)=>{providerPayload=JSON.parse(options.body);return{ok:true,json:async()=>({status:"success",data:{link:"https://checkout.example.test/pay"}})};},
    env:{FLW_SECRET_KEY:"test-secret",FLW_SECRET_HASH:"test-hash",FLW_REDIRECT_URL:"https://market.example.test/return",COMMERCE_SHIPPING_RATES_JSON:'{"Rwanda":{"RWF":1000}}',COMMERCE_TAX_BPS:"1000"}
  }));
  await withServer(app,async base=>{
    const response=await fetch(base+"/api/commerce/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({addressId:21,couponCode:"SAVE20",items:[{productId:4,quantity:1}]})});
    assert.equal(response.status,201);const body=await response.json();assert.equal(body.totalMinor,9900);assert.equal(body.shippingMinor,1000);assert.equal(body.taxMinor,900);assert.equal(providerPayload.amount,9900);assert.equal(orderParams[3],9900);assert.equal(orderParams[4],10000);assert.equal(orderParams[5],2000);assert.equal(orderParams[6],1000);assert.equal(orderParams[7],900);assert.equal(orderParams[8],1000);assert.equal(orderParams[9],"SAVE20");
  });
});


test("expired pending orders release reserved stock and become cancelled atomically", async () => {
  const calls=[];
  const client={
    async query(sql,params){calls.push({sql,params});if(sql.includes("SELECT id,status,expires_at FROM commerce_orders"))return{rows:[{id:"81",status:"pending",expires_at:new Date(Date.now()-1000).toISOString()}]};if(sql.includes("SELECT product_id,quantity FROM commerce_stock_reservations"))return{rows:[{product_id:"9",quantity:2}]};return{rows:[]};},
    release(){calls.push({sql:"RELEASE"});}
  };
  const pool={async connect(){return client;},async query(){return{rows:[{id:"81"}]};}};
  assert.equal(await releaseOrderReservations(pool,81,"cancelled",true),true);
  assert.ok(calls.some(call=>call.sql.includes("UPDATE commerce_products SET stock_quantity=stock_quantity+$2")&&call.params[0]==="9"&&call.params[1]===2));
  assert.ok(calls.some(call=>call.sql.includes("DELETE FROM commerce_stock_reservations")));
  assert.ok(calls.some(call=>call.sql.includes("status=$2")&&call.params[1]==="cancelled"));
});

test("reservation expiry cleanup is safe when transaction support is unavailable", async () => {
  assert.equal(await releaseExpiredReservations({async query(){throw new Error("should not query without connect");}}),0);
});
