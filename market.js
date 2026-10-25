"use strict";
(() => {
  const API = "https://nkwasibwe-irhcf.onrender.com/api/commerce";
  const TOKEN_KEY = "nkwasibwe_auth_token";
  const $ = id => document.getElementById(id);
  const state = { products: [], cart: [], orders: [], wishlist: [], addresses: [], seller: null, couponCode: "", quote: null };
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
  async function loadMarketplaceStatus() {
    const box=$("marketReadiness");
    try{
      const status=await request("/status");const notes=[];
      if(!status.payments?.checkoutReady)notes.push("Hosted checkout needs Render settings "+(status.payments?.missingCheckoutSettings||["FLW_SECRET_KEY","FLW_REDIRECT_URL"]).join(" and ")+".");
      if(!status.payments?.webhookReady)notes.push("Payment verification webhook needs FLW_SECRET_HASH.");
      if(!(status.shipping?.configuredCountries||[]).length)notes.push("Physical-product checkout is blocked until COMMERCE_SHIPPING_RATES_JSON has country/currency rates.");
      if(!status.tax?.valid)notes.push("Tax configuration is invalid; set COMMERCE_TAX_BPS between 0 and 3000.");
      else if(!status.tax?.explicitlyConfigured)notes.push("Tax currently defaults to 0 basis points; configure the legally appropriate rate before real sales.");
      if(status.sellerPayouts?.automatedTransfers===false)notes.push("Seller balances are account-separated, but payouts still require an external provider transfer and admin-recorded reference.");
      box.textContent=notes.length?"Marketplace setup checklist: "+notes.join(" "):"Payment configuration detected. Complete provider sandbox tests before accepting real payments.";
      box.setAttribute("data-ready",status.payments?.checkoutReady&&status.payments?.webhookReady?"true":"false");
    }catch(error){box.textContent="Could not check marketplace setup: "+error.message;}
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
  async function uploadProductImage(productId, file) {
    if(!file||!file.size)throw new Error("Choose an image file first.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Only JPEG, PNG and WebP images are supported.");
    if(file.size>2*1024*1024)throw new Error("Product images must be 2 MiB or smaller.");
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(new Error("Could not read the image file."));reader.readAsDataURL(file);});
    const comma=dataUrl.indexOf(",");if(comma<0)throw new Error("Could not encode the image file.");
    return request("/products/"+encodeURIComponent(productId)+"/image",{method:"PUT",body:JSON.stringify({mimeType:file.type,dataBase64:dataUrl.slice(comma+1)})});
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
      const imageUrl=product.has_image_upload?API+"/products/"+encodeURIComponent(product.id)+"/image":String(product.image_url||"");
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
        const edit=element("button","","Edit details");edit.type="button";edit.addEventListener("click",()=>{const existing=box.querySelector('form[data-product-edit="'+product.id+'"]');if(existing){existing.remove();return;}const form=element("form","product-edit-form");form.dataset.productEdit=String(product.id);const addField=(labelText,name,value,type="text")=>{const label=element("label","",labelText);const input=type==="textarea"?document.createElement("textarea"):document.createElement("input");input.name=name;if(type!=="textarea")input.type=type;if(type==="textarea")input.rows=3;input.value=value==null?"":String(value);label.append(input);form.append(label);return input;};addField("Product name","name",product.name);addField("SKU (optional)","sku",product.sku||"");addField("Description","description",product.description||"","textarea");addField("Category","category",product.category||"General");addField("Price (minor units)","priceMinor",product.price_minor,"number");const currencyLabel=element("label","","Currency");const currencySelect=document.createElement("select");currencySelect.name="currency";for(const currency of ["RWF","USD","EUR","GBP","KES","UGX","TZS","NGN","ZAR"]){const option=element("option","",currency);option.value=currency;option.selected=currency===product.currency;currencySelect.append(option);}currencyLabel.append(currencySelect);form.append(currencyLabel);addField("Available stock","stockQuantity",product.stock_quantity,"number");addField("External HTTPS image URL (optional)","imageUrl",product.image_url||"","url");const shippingLabel=element("label","product-checkbox","Requires shipping");const shipping=document.createElement("input");shipping.type="checkbox";shipping.name="requiresShipping";shipping.checked=product.requires_shipping!==false;shippingLabel.append(shipping);form.append(shippingLabel);const save=element("button","primary-button","Save product changes");save.type="submit";const cancel=element("button","","Cancel");cancel.type="button";cancel.addEventListener("click",()=>form.remove());form.append(save,cancel);form.addEventListener("submit",async event=>{event.preventDefault();save.disabled=true;const data=new FormData(form);const body={name:String(data.get("name")||"").trim(),sku:String(data.get("sku")||"").trim()||null,description:String(data.get("description")||""),category:String(data.get("category")||"").trim(),priceMinor:Number(data.get("priceMinor")),currency:String(data.get("currency")||product.currency),stockQuantity:Number(data.get("stockQuantity")),imageUrl:String(data.get("imageUrl")||"").trim()||null,requiresShipping:shipping.checked};try{await request("/products/"+encodeURIComponent(product.id),{method:"PATCH",body:JSON.stringify(body)});$("sellerMessage").textContent="Product details saved.";await Promise.all([loadSellerProducts(),loadProducts()]);}catch(error){$("sellerMessage").textContent=error.message;save.disabled=false;}});row.after(form);});
        const imageInput=document.createElement("input");imageInput.type="file";imageInput.accept="image/jpeg,image/png,image/webp";imageInput.setAttribute("aria-label","Upload image for "+product.name);
        const upload=element("button","","Upload image");upload.type="button";upload.addEventListener("click",async()=>{upload.disabled=true;try{await uploadProductImage(product.id,imageInput.files?.[0]);$("sellerMessage").textContent="Image saved for "+product.name+".";await Promise.all([loadSellerProducts(),loadProducts()]);}catch(error){$("sellerMessage").textContent=error.message;upload.disabled=false;}});
        const toggle=element("button","",product.active?"Hide product":"Publish product");toggle.type="button";
        toggle.addEventListener("click",async()=>{toggle.disabled=true;try{await request("/products/"+encodeURIComponent(product.id),{method:"PATCH",body:JSON.stringify({active:!product.active})});await Promise.all([loadSellerProducts(),loadProducts()]);}catch(error){$("sellerMessage").textContent=error.message;toggle.disabled=false;}});
        row.append(info,edit,imageInput,upload,toggle);box.append(row);
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
        if(order.tracking_number)info.append(element("small","", "Tracking: "+(order.tracking_carrier||"Carrier")+" · "+order.tracking_number));
        const transitions=({pending:["processing","cancelled"],processing:["shipped","cancelled"],shipped:["delivered"],delivered:[],cancelled:[]})[order.fulfillment_status]||[];
        row.append(info);
        if(transitions.length){const controls=element("div","seller-order-actions"),select=document.createElement("select");for(const status of transitions){const option=element("option","",status);option.value=status;select.append(option);}let carrierInput=null,trackingInput=null;if(transitions.includes("shipped")){carrierInput=document.createElement("input");carrierInput.placeholder="Carrier / delivery method";carrierInput.maxLength=120;carrierInput.setAttribute("aria-label","Carrier or delivery method");trackingInput=document.createElement("input");trackingInput.placeholder="Tracking / reference number";trackingInput.maxLength=200;trackingInput.setAttribute("aria-label","Tracking or delivery reference");controls.append(carrierInput,trackingInput);}const update=element("button","primary-button","Update");update.type="button";update.addEventListener("click",async()=>{const body={status:select.value};if(body.status==="shipped"){body.trackingCarrier=carrierInput?.value.trim()||"";body.trackingNumber=trackingInput?.value.trim()||"";if(body.trackingCarrier.length<2||body.trackingNumber.length<3){$("sellerMessage").textContent="Enter carrier and tracking/reference details before marking an order shipped.";return;}}update.disabled=true;try{await request("/seller/order-items/"+encodeURIComponent(order.item_id)+"/fulfillment",{method:"PATCH",body:JSON.stringify(body)});await loadSellerOrders();}catch(error){$("sellerMessage").textContent=error.message;update.disabled=false;}});controls.append(select,update);row.append(controls);}
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Seller orders: "+error.message));}
  }
  async function loadSellerPayouts() {
    const balancesBox=$("sellerBalancesList"),requestsBox=$("sellerPayoutRequestsList");
    if(!token()){balancesBox.replaceChildren(element("p","muted","Sign in to view earnings."));requestsBox.replaceChildren();return;}
    try{
      const result=await request("/seller/payouts");balancesBox.replaceChildren();requestsBox.replaceChildren();
      if(!(result.balances||[]).length)balancesBox.append(element("p","muted","No seller earnings recorded yet."));
      for(const balance of result.balances||[]){const row=element("article","seller-row"),info=element("div","cart-info");info.append(element("strong","",balance.currency+" balance"),element("small","", "Earned: "+money(balance.total_earned,balance.currency)+" · Paid: "+money(balance.total_paid,balance.currency)),element("small","", "Reserved in pending/approved requests: "+money(balance.reserved,balance.currency)),element("strong","", "Available: "+money(balance.available,balance.currency)));row.append(info);balancesBox.append(row);}
      if(!(result.payoutRequests||[]).length)requestsBox.append(element("p","muted","No payout requests yet."));
      for(const payout of result.payoutRequests||[]){const row=element("article","seller-row"),info=element("div","cart-info");info.append(element("strong","",money(payout.amount_minor,payout.currency)+" · "+payout.status),element("small","", "Reference: "+payout.destination_reference),element("small","",payout.admin_note||""));if(payout.provider_transfer_reference)info.append(element("small","", "Transfer reference: "+payout.provider_transfer_reference));row.append(info);requestsBox.append(row);}
    }catch(error){balancesBox.replaceChildren(element("p","muted","Earnings/payouts: "+error.message));requestsBox.replaceChildren();}
  }
  async function loadAdminPayoutRequests() {
    const box=$("payoutRequestsList");box.replaceChildren(element("p","muted","Loading payout requests…"));
    try{
      const result=await request("/payout-requests");box.replaceChildren();
      if(!(result.payoutRequests||[]).length)box.append(element("p","muted","No seller payout requests."));
      for(const payout of result.payoutRequests||[]){const row=element("article","seller-row"),info=element("div","cart-info");info.append(element("strong","",payout.shop_name+" · "+money(payout.amount_minor,payout.currency)+" · "+payout.status),element("small","", "Seller account "+payout.seller_user_id+" · beneficiary reference "+payout.destination_reference));if(payout.provider_transfer_reference)info.append(element("small","", "Transfer reference: "+payout.provider_transfer_reference));row.append(info);
        const action=async(status,providerTransferReference)=>{try{await request("/payout-requests/"+encodeURIComponent(payout.id),{method:"PATCH",body:JSON.stringify({status,providerTransferReference:providerTransferReference||null})});await loadAdminPayoutRequests();}catch(error){$("payoutMessage").textContent=error.message;}};
        if(payout.status==="pending"){for(const status of ["approved","rejected"]){const button=element("button",status==="approved"?"primary-button":"",status==="approved"?"Approve":"Reject");button.type="button";button.addEventListener("click",()=>action(status));row.append(button);}}
        else if(payout.status==="approved"){const button=element("button","primary-button","Mark paid");button.type="button";button.addEventListener("click",()=>{const reference=window.prompt("Enter the transfer reference after completing the transfer in the payment provider:");if(reference&&reference.trim())action("paid",reference.trim());});row.append(button);}
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Payout administration: "+error.message));}
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
    const quoteValid=!!state.quote&&Number.isSafeInteger(Number(state.quote.totalMinor))&&Number(state.quote.totalMinor)>0;
    $("checkoutButton").disabled=!hasCart||!sameCurrency||!quoteValid||(needsShipping&&!addressId);
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
      updateCheckoutAvailability();await loadQuote();
    }catch(error){box.replaceChildren(element("p","muted","Could not load addresses: "+error.message));}
  }
  async function loadQuote() {
    const currency=state.cart[0]?.currency;
    const subtotal=state.cart.reduce((sum,item)=>sum+Number(item.line_total_minor||0),0);
    if(!token()||!state.cart.length||!currency||!state.cart.every(item=>item.currency===currency)){
      state.quote=null;$("cartSubtotal").textContent=state.cart.length?"Mixed currencies": "—";$("cartDiscount").textContent="—";$("cartShipping").textContent="—";$("cartTax").textContent="—";$("cartTotal").textContent=state.cart.length?"Mixed currencies":"—";updateCheckoutAvailability();return;
    }
    try{
      const result=await request("/quote",{method:"POST",body:JSON.stringify({items:state.cart.map(item=>({productId:Number(item.product_id),quantity:Number(item.quantity)})),addressId:$("shippingAddressSelect").value?Number($("shippingAddressSelect").value):null,couponCode:state.couponCode||null})});
      state.quote=result;$("cartSubtotal").textContent=money(result.subtotalMinor,result.currency);$("cartDiscount").textContent=result.discountMinor?("−"+money(result.discountMinor,result.currency)):"—";$("cartShipping").textContent=money(result.shippingMinor,result.currency);$("cartTax").textContent=money(result.taxMinor,result.currency);$("cartTotal").textContent=money(result.totalMinor,result.currency);
      $("couponMessage").textContent=(state.couponCode?(result.discountMinor?"Coupon "+state.couponCode+" applied.":"Coupon is valid, but no discount was applied. "):"")+(result.shippingCountry?"Shipping to "+result.shippingCountry+".":"");
    }catch(error){
      state.quote=null;$("cartSubtotal").textContent=money(subtotal,currency);$("cartDiscount").textContent="—";$("cartShipping").textContent="—";$("cartTax").textContent="—";$("cartTotal").textContent=money(subtotal,currency);
      $("couponMessage").textContent=error.message;
    }
    updateCheckoutAvailability();
  }
  async function loadCart() {
    const box=$("cartItems");
    if(!token()){state.cart=[];box.replaceChildren(element("p","muted","Sign in to load and save your cart."));$("cartCount").textContent="0 items";$("cartSubtotal").textContent="—";$("cartDiscount").textContent="—";$("cartShipping").textContent="—";$("cartTax").textContent="—";$("cartTotal").textContent="—";$("checkoutButton").disabled=true;return;}
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
      $("cartSubtotal").textContent=currency&&state.cart.every(item=>item.currency===currency)?money(total,currency):(state.cart.length?"Mixed currencies":"—");
      $("cartDiscount").textContent="—";$("cartTotal").textContent=currency&&state.cart.every(item=>item.currency===currency)?money(total,currency):(state.cart.length?"Mixed currencies":"—");
      await loadQuote();
    }catch(error){box.replaceChildren(element("p","muted","Could not load cart: "+error.message));$("checkoutButton").disabled=true;}
  }
  async function loadOrders(){
    const box=$("ordersList");if(!token()){box.replaceChildren(element("p","muted","Sign in to view orders."));return;}
    box.replaceChildren(element("p","muted","Loading orders…"));
    try{const result=await request("/orders");state.orders=result.orders||[];box.replaceChildren();if(!state.orders.length){box.append(element("p","muted","No orders yet."));return;}
      for(const order of state.orders){const row=element("div","order-row");const info=element("div","cart-info");info.append(element("strong","","Order #"+order.id),element("small","",new Date(order.created_at).toLocaleString()+" · "+money(order.total_minor,order.currency)));
        row.append(info,element("span","status "+String(order.status),order.status));
        const detailsButton=element("button","","Order details");detailsButton.type="button";
        detailsButton.addEventListener("click",async()=>{detailsButton.disabled=true;try{const detail=await request("/orders/"+encodeURIComponent(order.id));box.querySelector('[data-order-details="'+order.id+'"]')?.remove();const panel=element("div","order-details-panel");panel.dataset.orderDetails=String(order.id);panel.append(element("strong","","Items"));panel.append(element("p","", "Subtotal: "+money(detail.order.subtotal_minor,order.currency)+(Number(detail.order.discount_minor||0)>0?" · Coupon "+detail.order.coupon_code+" discount: −"+money(detail.order.discount_minor,order.currency):"")+" · Shipping: "+money(detail.order.shipping_minor||0,order.currency)+" · Tax: "+money(detail.order.tax_minor||0,order.currency)));for(const item of detail.items||[]){panel.append(element("p","",item.product_name+" × "+item.quantity+" — "+money(item.line_total_minor,order.currency)+(item.fulfillment_status?" · "+item.fulfillment_status:"")));if(item.tracking_number)panel.append(element("p","muted","Tracking: "+(item.tracking_carrier||"Carrier")+" · "+item.tracking_number+(item.shipped_at?" · shipped "+new Date(item.shipped_at).toLocaleString():"")+(item.delivered_at?" · delivered "+new Date(item.delivered_at).toLocaleString():"")));}const address=detail.order.shipping_address;if(address)panel.append(element("p","", "Ship to: "+[address.recipient_name,address.phone,address.address_line1,address.address_line2,address.city,address.region,address.country].filter(Boolean).join(", ")));if(order.status==="paid"){const refund=await request("/orders/"+encodeURIComponent(order.id)+"/refund-request");if(refund.refundRequest){panel.append(element("p","", "Refund / return request status: "+refund.refundRequest.status));if(refund.refundRequest.admin_note)panel.append(element("p","",refund.refundRequest.admin_note));}else{const form=element("form","refund-request-form");const label=element("label","","Request return / refund");const reason=document.createElement("textarea");reason.name="reason";reason.rows=3;reason.minLength=5;reason.maxLength=2000;reason.required=true;reason.placeholder="Explain the issue and what you are requesting";label.append(reason);const submit=element("button","primary-button","Submit request");submit.type="submit";const message=element("p","muted","A request is reviewed by the platform; it does not automatically refund the payment.");form.append(label,submit,message);form.addEventListener("submit",async event=>{event.preventDefault();submit.disabled=true;try{const saved=await request("/orders/"+encodeURIComponent(order.id)+"/refund-request",{method:"POST",body:JSON.stringify({reason:reason.value.trim()})});message.textContent="Request submitted: "+saved.refundRequest.status+".";submit.disabled=true;}catch(error){message.textContent=error.message;submit.disabled=false;}});panel.append(form);}}row.after(panel);}catch(error){$("checkoutMessage").textContent=error.message;}finally{detailsButton.disabled=false;}});row.append(detailsButton);
        if(["paid","refunded"].includes(order.status)){const receiptButton=element("button","","Print receipt");receiptButton.type="button";receiptButton.addEventListener("click",async()=>{const receiptWindow=window.open("about:blank","_blank");if(!receiptWindow){$("checkoutMessage").textContent="Allow pop-ups to open the receipt.";return;}receiptWindow.document.write("<p>Loading receipt…</p>");try{const response=await fetch(API+"/orders/"+encodeURIComponent(order.id)+"/receipt",{headers:{Authorization:"Bearer "+token()}});if(!response.ok)throw new Error("Receipt could not be loaded ("+response.status+").");const html=await response.text();receiptWindow.document.open();receiptWindow.document.write(html);receiptWindow.document.close();}catch(error){receiptWindow.document.body.textContent=error.message;}});row.append(receiptButton);}
        if(order.status==="pending"&&order.checkout_url&&order.checkout_url.startsWith("https://")){const link=element("a","","Resume checkout");link.href=order.checkout_url;link.rel="noopener noreferrer";link.target="_blank";row.append(link);}
        box.append(row);
      }
    }catch(error){box.replaceChildren(element("p","muted","Could not load orders: "+error.message));}
  }
  $("applyCouponButton").addEventListener("click",async()=>{state.couponCode=$("couponCodeInput").value.trim().toUpperCase();await loadQuote();});
  $("couponCodeInput").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();$("applyCouponButton").click();}});
  $("couponForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget),message=$("couponAdminMessage");message.textContent="Creating coupon…";
    const body={code:String(form.get("code")||"").trim().toUpperCase(),description:String(form.get("description")||"").trim(),discountType:String(form.get("discountType")||"percent"),discountValue:Number(form.get("discountValue")),currency:String(form.get("currency")||"RWF"),minSubtotalMinor:Number(form.get("minSubtotalMinor")||0),startsAt:form.get("startsAt")?new Date(String(form.get("startsAt"))).toISOString():null,expiresAt:form.get("expiresAt")?new Date(String(form.get("expiresAt"))).toISOString():null};
    try{const result=await request("/coupons",{method:"POST",body:JSON.stringify(body)});message.textContent="Coupon created: "+result.coupon.code;event.currentTarget.reset();await loadCoupons();}
    catch(error){message.textContent=error.message;}
  });
  async function loadCoupons(){const box=$("couponsList");box.replaceChildren(element("p","muted","Loading coupons…"));try{const result=await request("/coupons");box.replaceChildren();if(!(result.coupons||[]).length)box.append(element("p","muted","No coupons created."));for(const coupon of result.coupons||[]){const row=element("article","seller-row"),info=element("div","cart-info");info.append(element("strong","",coupon.code+" · "+(coupon.discount_type==="percent"?coupon.discount_value+"%":money(coupon.discount_value,coupon.currency))),element("small","",coupon.description+" · "+coupon.currency+" · "+coupon.redeemed_count+" redeemed · "+(coupon.active?"active":"inactive")));const toggle=element("button","",coupon.active?"Deactivate":"Activate");toggle.type="button";toggle.addEventListener("click",async()=>{toggle.disabled=true;try{await request("/coupons/"+encodeURIComponent(coupon.id),{method:"PATCH",body:JSON.stringify({active:!coupon.active})});await loadCoupons();}catch(error){$("couponAdminMessage").textContent=error.message;toggle.disabled=false;}});row.append(info,toggle);box.append(row);}}catch(error){box.replaceChildren(element("p","muted","Coupon management: "+error.message));}}
  async function loadRefundRequests(){const box=$("refundRequestsList");box.replaceChildren(element("p","muted","Loading refund requests…"));try{const result=await request("/refund-requests");box.replaceChildren();if(!(result.refundRequests||[]).length)box.append(element("p","muted","No refund/return requests."));for(const item of result.refundRequests||[]){const row=element("article","seller-row"),info=element("div","cart-info");info.append(element("strong","", "Order #"+item.order_id+" · "+item.status+" · "+money(item.total_minor,item.currency)),element("small","", "User "+item.user_id+" · "+item.reason));row.append(info);const action=async(status,providerRefundReference)=>{try{await request("/refund-requests/"+encodeURIComponent(item.id),{method:"PATCH",body:JSON.stringify({status,providerRefundReference:providerRefundReference||null})});await loadRefundRequests();}catch(error){$("couponAdminMessage").textContent=error.message;}};if(item.status==="pending"){for(const status of ["approved","rejected"]){const button=element("button",status==="approved"?"primary-button":"",status==="approved"?"Approve":"Reject");button.type="button";button.addEventListener("click",()=>action(status));row.append(button);}}else if(item.status==="approved"){const button=element("button","primary-button","Mark refunded");button.type="button";button.addEventListener("click",()=>{const ref=window.prompt("Enter the refund reference from the payment provider after completing the refund externally:");if(ref&&ref.trim())action("refunded",ref.trim());});row.append(button);}if(item.provider_refund_reference)info.append(element("small","", "Refund ref: "+item.provider_refund_reference));box.append(row);}}catch(error){box.replaceChildren(element("p","muted","Refund management: "+error.message));}}
  $("couponsButton").addEventListener("click",loadCoupons);
  $("refundRequestsButton").addEventListener("click",loadRefundRequests);
  $("sellerPayoutForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget),message=$("payoutMessage");message.textContent="Submitting payout request…";
    const body={amountMinor:Number(form.get("amountMinor")),currency:String(form.get("currency")||"RWF"),destinationReference:String(form.get("destinationReference")||"").trim()};
    try{const result=await request("/seller/payout-requests",{method:"POST",body:JSON.stringify(body)});message.textContent="Payout request #"+result.payoutRequest.id+" submitted for review.";event.currentTarget.reset();await loadSellerPayouts();}
    catch(error){message.textContent=error.message;}
  });
  $("sellerPayoutsButton").addEventListener("click",loadSellerPayouts);
  $("payoutRequestsButton").addEventListener("click",loadAdminPayoutRequests);
  $("sellerApplicationForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget),message=$("sellerMessage");message.textContent="Submitting seller application…";
    const body={shopName:String(form.get("shopName")||"").trim(),description:String(form.get("description")||"").trim(),contactEmail:String(form.get("contactEmail")||"").trim(),contactPhone:String(form.get("contactPhone")||"").trim()};
    try{const result=await request("/seller/apply",{method:"POST",body:JSON.stringify(body)});message.textContent="Application saved. Status: "+result.seller.status+".";await loadSellerProfile();await Promise.all([loadSellerProducts(),loadSellerOrders(),loadSellerPayouts()]);}
    catch(error){message.textContent=error.message;}
  });
  $("sellerRefreshButton").addEventListener("click",async()=>{await loadSellerProfile();await Promise.all([loadSellerProducts(),loadSellerOrders(),loadSellerPayouts()]);});
  $("sellerProductsButton").addEventListener("click",loadSellerProducts);
  $("sellerOrdersButton").addEventListener("click",loadSellerOrders);
  $("sellerApplicationsButton").addEventListener("click",loadSellerApplications);
  $("shippingAddressSelect").addEventListener("change",async()=>{updateCheckoutAvailability();await loadQuote();});
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
    try{const result=await request("/checkout",{method:"POST",body:JSON.stringify({items:state.cart.map(item=>({productId:Number(item.product_id),quantity:Number(item.quantity)})),addressId:$("shippingAddressSelect").value?Number($("shippingAddressSelect").value):null,couponCode:state.couponCode||null})});
      if(!result.checkoutUrl||!result.checkoutUrl.startsWith("https://"))throw new Error("The server did not return a valid hosted checkout URL.");
      window.location.assign(result.checkoutUrl);
    }catch(error){$("checkoutMessage").textContent=error.message;$("checkoutButton").disabled=false;}
  });
  $("productForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);const message=$("adminMessage");message.textContent="Creating product…";
    const body={name:String(form.get("name")||"").trim(),category:String(form.get("category")||"General").trim(),requiresShipping:form.get("requiresShipping")==="on",description:String(form.get("description")||"").trim(),priceMinor:Number(form.get("priceMinor")),currency:String(form.get("currency")||"RWF"),stockQuantity:Number(form.get("stockQuantity")),imageUrl:String(form.get("imageUrl")||"").trim()||null,sku:String(form.get("sku")||"").trim()||null};
    try{const result=await request("/products",{method:"POST",body:JSON.stringify(body)});const imageFile=form.get("imageFile");let imageWarning="";if(imageFile&&imageFile.size){try{await uploadProductImage(result.product.id,imageFile);}catch(error){imageWarning=" Product was created, but image upload failed: "+error.message;}}message.textContent="Product created: "+result.product.name+imageWarning;event.currentTarget.reset();await Promise.all([loadProducts(),loadSellerProducts()]);}
    catch(error){message.textContent=error.message;}
  });
  $("productSearch").addEventListener("input",()=>{clearTimeout(window.marketSearchTimer);window.marketSearchTimer=setTimeout(loadProducts,180);});
  $("categoryFilter").addEventListener("change",loadProducts);
  $("productSort").addEventListener("change",loadProducts);
  $("reloadButton").addEventListener("click",async()=>{showAuthNotice();await Promise.all([loadProducts(),loadCart(),loadWishlist(),loadAddresses()]);if(token())await loadOrders();});
  $("wishlistButton").addEventListener("click",loadWishlist);
  $("ordersButton").addEventListener("click",loadOrders);
  showAuthNotice();loadMarketplaceStatus();loadProducts();loadCart();loadWishlist();loadAddresses();loadSellerProfile();loadSellerProducts();loadSellerOrders();loadSellerPayouts();if(token())loadOrders();
})();