"use strict";
(() => {
  const API = "https://nkwasibwe-irhcf.onrender.com/api/commerce";
  const TOKEN_KEY = "nkwasibwe_auth_token";
  const $ = id => document.getElementById(id);
  const state = { products: [], cart: [], orders: [], wishlist: [], addresses: [], seller: null };
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
  const authHeaders = () => token() ? { Authorization: "Bearer " + token() } : {};
  const integerCurrencies = new Set(["RWF", "UGX", "XAF", "XOF", "JPY"]);
  const money = (minor, currency) => {
    const amount = Number(minor) / (integerCurrencies.has(currency) ? 1 : 100);
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: integerCurrencies.has(currency) ? 0 : 2 }).format(amount); }
    catch { return String(currency) + " " + amount; }
  };
  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { ...authHeaders(), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || ("Request failed (" + response.status + ")"));
    return data;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function showAuthNotice() {
    $("authNotice").replaceChildren();
    if (token()) {
      $("authNotice").textContent = "You are signed in. Your cart, favourites, orders and payments are separated by your account.";
      return;
    }
    $("authNotice").append(document.createTextNode("You can browse products without signing in. To save favourites, keep a cart or place an order, "));
    const link = element("a", "", "sign in to Nkwasibwe IRHCF");
    link.href = "index.html";
    $("authNotice").append(link, document.createTextNode("."));
  }
  async function addToCart(product) {
    if (!token()) { $("checkoutMessage").textContent = "Please sign in through Nkwasibwe IRHCF first."; return; }
    const current = state.cart.find(item => String(item.product_id) === String(product.id));
    await request("/cart/items/" + encodeURIComponent(product.id), {
      method: "PUT",
      body: JSON.stringify({ quantity: Math.min(99, Number(current?.quantity || 0) + 1) })
    });
    $("checkoutMessage").textContent = product.name + " added to your cart.";
    await loadCart();
  }
  async function loadReviews(product, target) {
    target.replaceChildren(element("p", "muted", "Loading reviews…"));
    try {
      const result = await request("/products/" + encodeURIComponent(product.id) + "/reviews");
      target.replaceChildren();
      if (!result.reviews?.length) target.append(element("p", "muted", "No reviews yet."));
      for (const review of result.reviews || []) {
        const row = element("article", "review-row");
        row.append(element("strong", "", "★".repeat(Number(review.rating)) + "☆".repeat(5 - Number(review.rating))));
        if (review.review_text) row.append(element("p", "", review.review_text));
        row.append(element("small", "muted", new Date(review.created_at).toLocaleDateString()));
        target.append(row);
      }
      if (token()) {
        const form = element("form", "review-form");
        const heading = element("strong", "", "Review after purchase");
        const ratingLabel = element("label", "", "Rating");
        const rating = document.createElement("select"); rating.name = "rating"; rating.required = true;
        for (let n=5;n>=1;n--) { const option=document.createElement("option"); option.value=String(n); option.textContent=n+" star"+(n===1?"":"s"); rating.append(option); }
        ratingLabel.append(rating);
        const textLabel = element("label", "", "Your review (optional)");
        const text = document.createElement("textarea"); text.name="reviewText"; text.maxLength=2000; text.rows=3; text.placeholder="Share your experience";
        textLabel.append(text);
        const submit = element("button", "primary-button", "Submit review"); submit.type="submit";
        const message = element("p", "muted", "Only accounts with a confirmed paid order can submit a review.");
        form.append(heading,ratingLabel,textLabel,submit,message);
        form.addEventListener("submit", async event => {
          event.preventDefault(); submit.disabled=true;
          try {
            await request("/products/"+encodeURIComponent(product.id)+"/reviews",{method:"POST",body:JSON.stringify({rating:Number(rating.value),reviewText:text.value.trim()})});
            message.textContent="Review saved."; await loadReviews(product,target); await loadProducts();
          } catch(error) { message.textContent=error.message; }
          finally { submit.disabled=false; }
        });
        target.append(form);
      }
    } catch(error) { target.replaceChildren(element("p","muted","Could not load reviews: "+error.message)); }
  }
  function renderProducts() {
    const grid=$("productGrid"); grid.replaceChildren();
    const query=$("productSearch").value.trim().toLowerCase();
    const category=$("categoryFilter").value;
    const sort=$("productSort").value;
    let products=state.products.filter(product => (!category || product.category===category) &&
      (!query || [product.name,product.description,product.sku,product.category].some(value=>String(value||"").toLowerCase().includes(query))));
    products=products.slice().sort((a,b)=>{
      if(sort==="price_asc")return Number(a.price_minor)-Number(b.price_minor);
      if(sort==="price_desc")return Number(b.price_minor)-Number(a.price_minor);
      if(sort==="name_asc")return String(a.name).localeCompare(String(b.name));
      if(sort==="rating")return Number(b.rating_average||0)-Number(a.rating_average||0)||Number(b.review_count||0)-Number(a.review_count||0);
      return Number(b.id)-Number(a.id);
    });
    $("productCount").textContent=products.length+(products.length===1?" item":" items");
    if(!products.length){grid.append(element("p","muted","No products match these filters."));return;}
    for(const product of products){
      const card=element("article","product-card");
      const imageUrl=String(product.image_url||"");
      if(imageUrl.startsWith("https://")){
        const image=element("img","product-image"); image.src=imageUrl; image.alt=String(product.name||"Product"); image.loading="lazy"; image.referrerPolicy="no-referrer";
        image.addEventListener("error",()=>image.replaceWith(element("div","product-placeholder","▧")),{once:true}); card.append(image);
      } else card.append(element("div","product-placeholder","▧"));
      const body=element("div","product-body");
      body.append(element("span","product-category",product.category||"General"),element("h3","",product.name),element("small","seller-name","Sold by "+(product.seller_name||"Nkwasibwe Market")));
      if(product.description)body.append(element("p","",product.description));
      body.append(element("div","product-price",money(product.price_minor,product.currency)));
      body.append(element("div","product-rating",(Number(product.rating_average)>0?"★ "+Number(product.rating_average).toFixed(1):"No rating")+" · "+Number(product.review_count||0)+" reviews"));
      body.append(element("span","stock",Number(product.stock_quantity)>0?Number(product.stock_quantity)+" in stock":"Out of stock"));
      const actions=element("div","product-actions");
      const add=element("button","primary-button",token()?"Add to cart":"Sign in to add"); add.type="button"; add.disabled=Number(product.stock_quantity)<1;
      add.addEventListener("click",async()=>{add.disabled=true;try{await addToCart(product);}catch(error){$("checkoutMessage").textContent=error.message;}finally{add.disabled=Number(product.stock_quantity)<1;}});
      const saved=state.wishlist.some(item=>String(item.id)===String(product.id));
      const wish=element("button","",saved?"♥ Saved":"♡ Save"); wish.type="button"; wish.disabled=!token();
      wish.title=token()?"Save or remove this favourite":"Sign in to save favourites";
      wish.addEventListener("click",async()=>{
        wish.disabled=true;
        try{await request("/wishlist/"+encodeURIComponent(product.id),{method:"PUT",body:JSON.stringify({saved:!state.wishlist.some(item=>String(item.id)===String(product.id))})});await loadWishlist();renderProducts();}
        catch(error){$("checkoutMessage").textContent=error.message;wish.disabled=false;}
      });
      actions.append(add,wish);body.append(actions);
      const details=element("details","product-reviews");
      const summary=element("summary","","Read reviews / write a review");
      const reviews=element("div","reviews-content");
      details.append(summary,reviews);
      details.addEventListener("toggle",()=>{if(details.open&&!details.dataset.loaded){details.dataset.loaded="1";loadReviews(product,reviews);}});
      body.append(details);card.append(body);grid.append(card);
    }
  }
  async function loadSellerProfile() {
    const status=$("sellerStatus");
    if(!token()){state.seller=null;status.textContent="Sign in to apply to sell and manage a seller workspace.";return;}
    try{
      const result=await request("/seller/profile");state.seller=result.seller||null;
      if(!state.seller){status.textContent="You have not applied to sell yet. Submit your shop details below.";return;}
      status.textContent="Shop: "+state.seller.shop_name+" · Application status: "+state.seller.status+". "+(state.seller.status==="approved"?"You can create products and manage paid orders.":state.seller.status==="pending"?"Your application is awaiting administrator review.":"Contact the platform administrator if you need to reapply.");
      const form=$("sellerApplicationForm");
      for(const key of ["shopName","description","contactEmail","contactPhone"]){if(form.elements[key]&&state.seller[key==="shopName"?"shop_name":key==="contactEmail"?"contact_email":key==="contactPhone"?"contact_phone":key]!==undefined)form.elements[key].value=state.seller[key==="shopName"?"shop_name":key==="contactEmail"?"contact_email":key==="contactPhone"?"contact_phone":key]||"";}
    }catch(error){status.textContent="Could not load seller status: "+error.message;}
  }
  async function loadSellerProducts() {
    const box=$("sellerProductsList");
    if(!token()){box.replaceChildren(element("p","muted","Sign in to view seller products."));return;}
    try{
      const result=await request("/seller/products");box.replaceChildren();
      if(!(result.products||[]).length)box.append(element("p","muted","No products in this seller shop yet."));
      for(const product of result.products||[]){
        const row=element("article","seller-row"),info=element("div","cart-info");
        info.append(element("strong","",product.name),element("small","",money(product.price_minor,product.currency)+" · stock "+product.stock_quantity+" · "+(product.active?"Active":"Hidden")));
        const toggle=element("button","",product.active?"Hide product":"Publish product");toggle.type="button";
        toggle.addEventListener("click",async()=>{toggle.disabled=true;try{await request("/products/"+encodeURIComponent(product.id),{method:"PATCH",body:JSON.stringify({active:!product.active})});await Promise.all([loadSellerProducts(),loadProducts()]);}catch(error){$("sellerMessage").textContent=error.message;toggle.disabled=false;}});
        row.append(info,toggle);box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Seller product workspace: "+error.message));}
  }
  async function loadSellerOrders() {
    const box=$("sellerOrdersList");
    if(!token()){box.replaceChildren(element("p","muted","Sign in to view seller orders."));return;}
    try{
      const result=await request("/seller/orders");box.replaceChildren();
      if(!(result.orders||[]).length)box.append(element("p","muted","No paid seller orders yet."));
      for(const order of result.orders||[]){
        const row=element("article","seller-row"),info=element("div","cart-info");
        info.append(element("strong","","Order #"+order.order_id+" · "+order.product_name+" × "+order.quantity),element("small","",money(order.line_total_minor,order.currency)+" · payment "+order.payment_status+" · fulfillment "+order.fulfillment_status));
        if(order.shipping_address){const a=order.shipping_address;info.append(element("small","",[a.recipient_name,a.phone,a.address_line1,a.address_line2,a.city,a.region,a.country].filter(Boolean).join(", ")));}
        const transitions=({pending:["processing","cancelled"],processing:["shipped","cancelled"],shipped:["delivered"],delivered:[],cancelled:[]})[order.fulfillment_status]||[];
        row.append(info);
        if(transitions.length){const controls=element("div","seller-order-actions"),select=document.createElement("select");for(const status of transitions){const option=element("option","",status);option.value=status;select.append(option);}const update=element("button","primary-button","Update");update.type="button";update.addEventListener("click",async()=>{update.disabled=true;try{await request("/seller/order-items/"+encodeURIComponent(order.item_id)+"/fulfillment",{method:"PATCH",body:JSON.stringify({status:select.value})});await loadSellerOrders();}catch(error){$("sellerMessage").textContent=error.message;update.disabled=false;}});controls.append(select,update);row.append(controls);}
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Seller orders: "+error.message));}
  }
  async function loadSellerApplications() {
    const box=$("sellerApplicationsList");box.replaceChildren(element("p","muted","Loading applications…"));
    try{
      const result=await request("/seller/applications");box.replaceChildren();
      if(!(result.applications||[]).length)box.append(element("p","muted","No seller applications."));
      for(const seller of result.applications||[]){
        const row=element("article","seller-row"),info=element("div","cart-info");
        info.append(element("strong","",seller.shop_name+" · "+seller.status),element("small","", "User ID "+seller.user_id+" · "+seller.contact_email+" · "+seller.contact_phone),element("small","",seller.description||"No shop description"));
        row.append(info);
        if(["pending","rejected","suspended"].includes(seller.status)){
          for(const status of ["approved","rejected"]){const button=element("button",status==="approved"?"primary-button":"",status==="approved"?"Approve":"Reject");button.type="button";button.addEventListener("click",async()=>{button.disabled=true;try{await request("/seller/applications/"+encodeURIComponent(seller.user_id),{method:"PATCH",body:JSON.stringify({status})});await loadSellerApplications();}catch(error){$("sellerMessage").textContent=error.message;button.disabled=false;}});row.append(button);}
        }
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Cannot load seller applications: "+error.message));}
  }
  async function loadProducts() {
    const grid=$("productGrid"); grid.replaceChildren(element("p","muted","Loading products…"));
    const query=new URLSearchParams();
    if($("productSearch").value.trim())query.set("q",$("productSearch").value.trim());
    if($("categoryFilter").value)query.set("category",$("categoryFilter").value);
    query.set("sort",$("productSort").value);
    try{
      const result=await request("/products?"+query.toString());
      state.products=result.products||[];
      const select=$("categoryFilter"),selected=select.value;
      const categories=result.categories||[...new Set(state.products.map(p=>p.category||"General"))];
      select.replaceChildren(element("option","","All categories"));select.options[0].value="";
      for(const category of categories){const option=element("option","",category);option.value=category;select.append(option);}
      if(categories.includes(selected))select.value=selected;
      renderProducts();
    }catch(error){grid.replaceChildren(element("p","muted","Could not load products: "+error.message));}
  }
  async function loadWishlist(){
    const box=$("wishlistList");
    if(!token()){state.wishlist=[];box.replaceChildren(element("p","muted","Sign in to save and view favourites."));return;}
    try{
      const result=await request("/wishlist");state.wishlist=result.products||[];box.replaceChildren();
      if(!state.wishlist.length)box.append(element("p","muted","No saved favourites yet."));
      for(const product of state.wishlist){
        const row=element("div","wishlist-row");const info=element("div","cart-info");
        info.append(element("strong","",product.name),element("small","",money(product.price_minor,product.currency)+" · "+(product.category||"General")));
        const remove=element("button","","Remove");remove.type="button";remove.addEventListener("click",async()=>{remove.disabled=true;try{await request("/wishlist/"+encodeURIComponent(product.id),{method:"PUT",body:JSON.stringify({saved:false})});await loadWishlist();renderProducts();}catch(error){remove.disabled=false;$("checkoutMessage").textContent=error.message;}});
        const add=element("button","primary-button","Add to cart");add.type="button";add.disabled=Number(product.stock_quantity)<1;add.addEventListener("click",async()=>{add.disabled=true;try{await addToCart(product);}catch(error){$("checkoutMessage").textContent=error.message;}finally{add.disabled=Number(product.stock_quantity)<1;}});
        row.append(info,add,remove);box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Could not load favourites: "+error.message));}
  }
  function updateCheckoutAvailability() {
    const hasCart=state.cart.length>0;
    const currency=state.cart[0]?.currency;
    const sameCurrency=hasCart&&state.cart.every(item=>item.currency===currency);
    const needsShipping=state.cart.some(item=>item.requires_shipping!==false);
    $("shippingAddressWrap").hidden=!needsShipping;
    const addressId=$("shippingAddressSelect").value;
    $("checkoutButton").disabled=!hasCart||!sameCurrency||(needsShipping&&!addressId);
    $("shippingAddressHint").textContent=needsShipping
      ? (state.addresses.length ? (addressId ? "Delivery address selected. The order will keep a snapshot for this purchase." : "Select a delivery address before checkout.") : "Add a delivery address above before purchasing physical products.")
      : "This cart contains digital/non-shipping products only.";
  }
  async function loadAddresses() {
    const box=$("addressesList"), select=$("shippingAddressSelect");
    if(!token()){state.addresses=[];box.replaceChildren(element("p","muted","Sign in to manage delivery addresses."));select.replaceChildren(element("option","","Sign in to select an address"));select.options[0].value="";updateCheckoutAvailability();return;}
    try{
      const result=await request("/addresses");state.addresses=result.addresses||[];
      const previous=select.value;select.replaceChildren(element("option","","Select a saved address"));select.options[0].value="";
      for(const address of state.addresses){const option=element("option","",address.label+" — "+address.city+", "+address.country+(address.is_default?" (default)":""));option.value=String(address.id);select.append(option);}
      if(state.addresses.some(address=>String(address.id)===previous))select.value=previous;
      else {const preferred=state.addresses.find(address=>address.is_default)||state.addresses[0];if(preferred)select.value=String(preferred.id);}
      box.replaceChildren();
      if(!state.addresses.length)box.append(element("p","muted","No saved delivery addresses yet."));
      for(const address of state.addresses){
        const row=element("article","address-card"),info=element("div","cart-info");
        info.append(element("strong","",address.label+(address.is_default?" · Default":"")),element("small","",address.recipient_name+" · "+address.phone),element("small","",[address.address_line1,address.address_line2,address.city,address.region,address.country,address.postal_code].filter(Boolean).join(", ")));
        const actions=element("div","address-actions");
        if(!address.is_default){const makeDefault=element("button","","Make default");makeDefault.type="button";makeDefault.addEventListener("click",async()=>{makeDefault.disabled=true;try{await request("/addresses/"+encodeURIComponent(address.id)+"/default",{method:"PUT"});await loadAddresses();}catch(error){$("addressMessage").textContent=error.message;makeDefault.disabled=false;}});actions.append(makeDefault);}
        const remove=element("button","","Delete");remove.type="button";remove.addEventListener("click",async()=>{remove.disabled=true;try{await request("/addresses/"+encodeURIComponent(address.id),{method:"DELETE"});await loadAddresses();}catch(error){$("addressMessage").textContent=error.message;remove.disabled=false;}});actions.append(remove);
        row.append(info,actions);box.append(row);
      }
      updateCheckoutAvailability();
    }catch(error){box.replaceChildren(element("p","muted","Could not load addresses: "+error.message));}
  }
  async function loadCart() {
    const box=$("cartItems");
    if(!token()){state.cart=[];box.replaceChildren(element("p","muted","Sign in to load and save your cart."));$("cartCount").textContent="0 items";$("cartTotal").textContent="—";$("checkoutButton").disabled=true;return;}
    try{
      const result=await request("/cart");state.cart=result.items||[];box.replaceChildren();let total=0;
      if(!state.cart.length)box.append(element("p","muted","Your cart is empty. Add something from the catalogue."));
      for(const item of state.cart){
        total+=Number(item.line_total_minor||0);const row=element("div","cart-row");const info=element("div","cart-info");
        info.append(element("strong","",item.name),element("small","",money(item.price_minor,item.currency)+" each · "+money(item.line_total_minor,item.currency)));
        const controls=element("div","cart-controls");const qty=document.createElement("input");qty.type="number";qty.min="0";qty.max="99";qty.step="1";qty.value=String(item.quantity);qty.setAttribute("aria-label","Quantity for "+item.name);
        const update=element("button","","Update");update.type="button";update.addEventListener("click",async()=>{const quantity=Number(qty.value);if(!Number.isInteger(quantity)||quantity<0||quantity>99){$("checkoutMessage").textContent="Quantity must be from 0 to 99.";return;}update.disabled=true;try{await request("/cart/items/"+encodeURIComponent(item.product_id),{method:"PUT",body:JSON.stringify({quantity})});await loadCart();}catch(error){$("checkoutMessage").textContent=error.message;}finally{update.disabled=false;}});
        controls.append(qty,update);row.append(info,controls);box.append(row);
      }
      $("cartCount").textContent=state.cart.reduce((sum,item)=>sum+Number(item.quantity),0)+" items";
      const currency=state.cart[0]?.currency;
      $("cartTotal").textContent=currency&&state.cart.every(item=>item.currency===currency)?money(total,currency):(state.cart.length?"Mixed currencies":"—");
      updateCheckoutAvailability();
    }catch(error){box.replaceChildren(element("p","muted","Could not load cart: "+error.message));$("checkoutButton").disabled=true;}
  }
  async function loadOrders(){
    const box=$("ordersList");if(!token()){box.replaceChildren(element("p","muted","Sign in to view orders."));return;}
    box.replaceChildren(element("p","muted","Loading orders…"));
    try{const result=await request("/orders");state.orders=result.orders||[];box.replaceChildren();if(!state.orders.length){box.append(element("p","muted","No orders yet."));return;}
      for(const order of state.orders){const row=element("div","order-row");const info=element("div","cart-info");info.append(element("strong","","Order #"+order.id),element("small","",new Date(order.created_at).toLocaleString()+" · "+money(order.total_minor,order.currency)));
        row.append(info,element("span","status "+String(order.status),order.status));
        const detailsButton=element("button","","Order details");detailsButton.type="button";
        detailsButton.addEventListener("click",async()=>{detailsButton.disabled=true;try{const detail=await request("/orders/"+encodeURIComponent(order.id));const panel=element("div","order-details-panel");panel.append(element("strong","","Items"));for(const item of detail.items||[])panel.append(element("p","",item.product_name+" × "+item.quantity+" — "+money(item.line_total_minor,order.currency)));const address=detail.order.shipping_address;if(address)panel.append(element("p","", "Ship to: "+[address.recipient_name,address.phone,address.address_line1,address.address_line2,address.city,address.region,address.country].filter(Boolean).join(", ")));row.after(panel);}catch(error){$("checkoutMessage").textContent=error.message;}finally{detailsButton.disabled=false;}});row.append(detailsButton);
        if(order.status==="pending"&&order.checkout_url&&order.checkout_url.startsWith("https://")){const link=element("a","","Resume checkout");link.href=order.checkout_url;link.rel="noopener noreferrer";link.target="_blank";row.append(link);}
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Could not load orders: "+error.message));}
  }
  $("sellerApplicationForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget),message=$("sellerMessage");message.textContent="Submitting seller application…";
    const body={shopName:String(form.get("shopName")||"").trim(),description:String(form.get("description")||"").trim(),contactEmail:String(form.get("contactEmail")||"").trim(),contactPhone:String(form.get("contactPhone")||"").trim()};
    try{const result=await request("/seller/apply",{method:"POST",body:JSON.stringify(body)});message.textContent="Application saved. Status: "+result.seller.status+".";await loadSellerProfile();await Promise.all([loadSellerProducts(),loadSellerOrders()]);}
    catch(error){message.textContent=error.message;}
  });
  $("sellerRefreshButton").addEventListener("click",async()=>{await loadSellerProfile();await Promise.all([loadSellerProducts(),loadSellerOrders()]);});
  $("sellerProductsButton").addEventListener("click",loadSellerProducts);
  $("sellerOrdersButton").addEventListener("click",loadSellerOrders);
  $("sellerApplicationsButton").addEventListener("click",loadSellerApplications);
  $("shippingAddressSelect").addEventListener("change",updateCheckoutAvailability);
  $("addressForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget),message=$("addressMessage");message.textContent="Saving address…";
    const body={label:String(form.get("label")||"").trim(),recipientName:String(form.get("recipientName")||"").trim(),phone:String(form.get("phone")||"").trim(),country:String(form.get("country")||"").trim(),region:String(form.get("region")||"").trim(),city:String(form.get("city")||"").trim(),addressLine1:String(form.get("addressLine1")||"").trim(),addressLine2:String(form.get("addressLine2")||"").trim(),postalCode:String(form.get("postalCode")||"").trim(),isDefault:form.get("isDefault")==="on"};
    try{await request("/addresses",{method:"POST",body:JSON.stringify(body)});message.textContent="Address saved to your account.";event.currentTarget.reset();await loadAddresses();}
    catch(error){message.textContent=error.message;}
  });
  $("addressesButton").addEventListener("click",loadAddresses);
  $("checkoutButton").addEventListener("click",async()=>{
    if(!token()){$("checkoutMessage").textContent="Sign in first to check out.";return;}
    $("checkoutButton").disabled=true;$("checkoutMessage").textContent="Creating hosted checkout…";
    try{const result=await request("/checkout",{method:"POST",body:JSON.stringify({items:state.cart.map(item=>({productId:Number(item.product_id),quantity:Number(item.quantity)})),addressId:$("shippingAddressSelect").value?Number($("shippingAddressSelect").value):null})});
      if(!result.checkoutUrl||!result.checkoutUrl.startsWith("https://"))throw new Error("The server did not return a valid hosted checkout URL.");
      window.location.assign(result.checkoutUrl);
    }catch(error){$("checkoutMessage").textContent=error.message;$("checkoutButton").disabled=false;}
  });
  $("productForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);const message=$("adminMessage");message.textContent="Creating product…";
    const body={name:String(form.get("name")||"").trim(),category:String(form.get("category")||"General").trim(),requiresShipping:form.get("requiresShipping")==="on",description:String(form.get("description")||"").trim(),priceMinor:Number(form.get("priceMinor")),currency:String(form.get("currency")||"RWF"),stockQuantity:Number(form.get("stockQuantity")),imageUrl:String(form.get("imageUrl")||"").trim()||null,sku:String(form.get("sku")||"").trim()||null};
    try{const result=await request("/products",{method:"POST",body:JSON.stringify(body)});message.textContent="Product created: "+result.product.name;event.currentTarget.reset();await loadProducts();}
    catch(error){message.textContent=error.message;}
  });
  $("productSearch").addEventListener("input",()=>{clearTimeout(window.marketSearchTimer);window.marketSearchTimer=setTimeout(loadProducts,180);});
  $("categoryFilter").addEventListener("change",loadProducts);
  $("productSort").addEventListener("change",loadProducts);
  $("reloadButton").addEventListener("click",async()=>{showAuthNotice();await Promise.all([loadProducts(),loadCart(),loadWishlist(),loadAddresses()]);if(token())await loadOrders();});
  $("wishlistButton").addEventListener("click",loadWishlist);
  $("ordersButton").addEventListener("click",loadOrders);
  showAuthNotice();loadProducts();loadCart();loadWishlist();loadAddresses();loadSellerProfile();loadSellerProducts();loadSellerOrders();if(token())loadOrders();
})();